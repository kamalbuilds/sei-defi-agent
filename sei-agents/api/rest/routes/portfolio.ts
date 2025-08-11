import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../../middleware/authentication';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { PortfolioService } from '../../../core/services/PortfolioService';
import { Logger } from '../../../utils/logger';

const router = express.Router();
const logger = new Logger('PortfolioRoutes');
const portfolioService = new PortfolioService();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/portfolios:
 *   get:
 *     summary: Get user's portfolios
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of portfolios to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of portfolios to skip
 *     responses:
 *       200:
 *         description: List of portfolios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 portfolios:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Portfolio'
 *                 total:
 *                   type: integer
 */
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.role === 'admin' ? req.query.userId : req.user.id;

    const result = await portfolioService.findByUserId(userId as string, { limit, offset });

    res.json({
      portfolios: result.portfolios,
      total: result.total,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Failed to fetch portfolios', { error: (error as any).message, userId: req.user.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios/{id}:
 *   get:
 *     summary: Get portfolio by ID
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Portfolio details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 *       404:
 *         description: Portfolio not found
 */
router.get('/:id', [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const portfolio = await portfolioService.findById(id);

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check ownership
    if (portfolio.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(portfolio);
  } catch (error) {
    logger.error('Failed to fetch portfolio', { error: (error as any).message, portfolioId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios:
 *   post:
 *     summary: Create a new portfolio
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - initialAllocations
 *               - riskProfile
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               initialAllocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     assetId:
 *                       type: string
 *                     percentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     targetPercentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     rebalanceThreshold:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 50
 *               riskProfile:
 *                 type: string
 *                 enum: [CONSERVATIVE, MODERATE, AGGRESSIVE, CUSTOM]
 *               currency:
 *                 type: string
 *                 default: USD
 *     responses:
 *       201:
 *         description: Portfolio created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Portfolio'
 *       400:
 *         description: Invalid input
 */
router.post('/', [
  rateLimitMiddleware('portfolio_creation', 5, 60), // 5 creations per minute
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be max 500 characters'),
  body('initialAllocations').isArray({ min: 1 }).withMessage('At least one allocation is required'),
  body('initialAllocations.*.assetId').isUUID().withMessage('Invalid asset ID'),
  body('initialAllocations.*.percentage').isFloat({ min: 0, max: 100 }).withMessage('Percentage must be 0-100'),
  body('riskProfile').isIn(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'CUSTOM']),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, initialAllocations, riskProfile, currency = 'USD' } = req.body;

    // Validate allocations sum to 100%
    const totalPercentage = initialAllocations.reduce((sum: number, allocation: any) => sum + allocation.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return res.status(400).json({ error: 'Allocations must sum to 100%' });
    }

    const portfolioData = {
      name,
      description,
      initialAllocations,
      riskProfile,
      currency,
      userId: req.user.id
    };

    const portfolio = await portfolioService.create(portfolioData);

    logger.info('Portfolio created', { portfolioId: portfolio.id, userId: req.user.id, name });

    res.status(201).json(portfolio);
  } catch (error) {
    logger.error('Failed to create portfolio', { error: (error as any).message, userId: req.user.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios/{id}:
 *   put:
 *     summary: Update portfolio
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               allocations:
 *                 type: array
 *               riskProfile:
 *                 type: string
 *                 enum: [CONSERVATIVE, MODERATE, AGGRESSIVE, CUSTOM]
 *     responses:
 *       200:
 *         description: Portfolio updated successfully
 *       404:
 *         description: Portfolio not found
 */
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ min: 3, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('allocations').optional().isArray(),
  body('riskProfile').optional().isIn(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'CUSTOM'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const existingPortfolio = await portfolioService.findById(id);
    if (!existingPortfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check ownership
    if (existingPortfolio.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate allocations if provided
    if (updates.allocations) {
      const totalPercentage = updates.allocations.reduce((sum: number, allocation: any) => sum + allocation.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return res.status(400).json({ error: 'Allocations must sum to 100%' });
      }
    }

    const portfolio = await portfolioService.update(id, updates);

    logger.info('Portfolio updated', { portfolioId: id, userId: req.user.id, updates: Object.keys(updates) });

    res.json(portfolio);
  } catch (error) {
    logger.error('Failed to update portfolio', { error: (error as any).message, portfolioId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios/{id}/rebalance:
 *   post:
 *     summary: Rebalance portfolio
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - strategy
 *             properties:
 *               strategy:
 *                 type: string
 *                 enum: [PROPORTIONAL, THRESHOLD_BASED, TIME_BASED, VOLATILITY_WEIGHTED]
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *                 description: If true, returns rebalancing plan without executing
 *     responses:
 *       200:
 *         description: Portfolio rebalanced successfully
 *       400:
 *         description: Invalid strategy or portfolio state
 *       404:
 *         description: Portfolio not found
 */
router.post('/:id/rebalance', [
  param('id').isUUID(),
  body('strategy').isIn(['PROPORTIONAL', 'THRESHOLD_BASED', 'TIME_BASED', 'VOLATILITY_WEIGHTED']),
  body('dryRun').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { strategy, dryRun = false } = req.body;

    const portfolio = await portfolioService.findById(id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check ownership
    if (portfolio.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await portfolioService.rebalance(id, strategy, { dryRun });

    logger.info('Portfolio rebalance requested', { 
      portfolioId: id, 
      userId: req.user.id, 
      strategy, 
      dryRun 
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to rebalance portfolio', { 
      error: (error as any).message, 
      portfolioId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios/{id}/value:
 *   get:
 *     summary: Get portfolio current value
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Currency for value calculation
 *     responses:
 *       200:
 *         description: Portfolio value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: number
 *                 currency:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/:id/value', [
  param('id').isUUID(),
  query('currency').optional().isLength({ min: 3, max: 3 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { currency = 'USD' } = req.query;

    const portfolio = await portfolioService.findById(id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check ownership
    if (portfolio.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const value = await portfolioService.calculateValue(id, currency as string);

    res.json({
      value,
      currency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to calculate portfolio value', { 
      error: (error as any).message, 
      portfolioId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios/{id}/performance:
 *   get:
 *     summary: Get portfolio performance metrics
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [HOUR, DAY, WEEK, MONTH, QUARTER, YEAR, ALL]
 *           default: MONTH
 *         description: Time range for performance data
 *     responses:
 *       200:
 *         description: Portfolio performance metrics
 */
router.get('/:id/performance', [
  param('id').isUUID(),
  query('timeRange').optional().isIn(['HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { timeRange = 'MONTH' } = req.query;

    const portfolio = await portfolioService.findById(id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check ownership
    if (portfolio.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const performance = await portfolioService.getPerformance(id, timeRange as string);

    res.json(performance);
  } catch (error) {
    logger.error('Failed to fetch portfolio performance', { 
      error: (error as any).message, 
      portfolioId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios/{id}/history:
 *   get:
 *     summary: Get portfolio historical data
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [HOUR, DAY, WEEK, MONTH, QUARTER, YEAR, ALL]
 *           default: MONTH
 *         description: Time range for historical data
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [minute, hour, day, week]
 *           default: day
 *         description: Data point interval
 *     responses:
 *       200:
 *         description: Portfolio historical data
 */
router.get('/:id/history', [
  param('id').isUUID(),
  query('timeRange').optional().isIn(['HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL']),
  query('interval').optional().isIn(['minute', 'hour', 'day', 'week'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { timeRange = 'MONTH', interval = 'day' } = req.query;

    const portfolio = await portfolioService.findById(id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check ownership
    if (portfolio.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = await portfolioService.getHistory(id, timeRange as string, interval as string);

    res.json(history);
  } catch (error) {
    logger.error('Failed to fetch portfolio history', { 
      error: (error as any).message, 
      portfolioId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/portfolios/{id}:
 *   delete:
 *     summary: Delete portfolio
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       204:
 *         description: Portfolio deleted successfully
 *       404:
 *         description: Portfolio not found
 */
router.delete('/:id', [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    const portfolio = await portfolioService.findById(id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Check ownership
    if (portfolio.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await portfolioService.delete(id);

    logger.info('Portfolio deleted', { portfolioId: id, userId: req.user.id });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete portfolio', { error: (error as any).message, portfolioId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;