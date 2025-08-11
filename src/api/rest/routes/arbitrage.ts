import express from 'express';
import { query, param, body, validationResult } from 'express-validator';
import { authMiddleware, requirePermission } from '../../middleware/authentication';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { ArbitrageService } from '../../../core/services/ArbitrageService';
import { Logger } from '../../../utils/logger';

const router = express.Router();
const logger = new Logger('ArbitrageRoutes');
const arbitrageService = new ArbitrageService();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/arbitrage/opportunities:
 *   get:
 *     summary: Get current arbitrage opportunities
 *     tags: [Arbitrage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: minProfitMargin
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         description: Minimum profit margin percentage
 *       - in: query
 *         name: maxGasEstimate
 *         schema:
 *           type: number
 *         description: Maximum gas estimate in USD
 *       - in: query
 *         name: exchanges
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by specific exchanges
 *       - in: query
 *         name: tokens
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by specific tokens
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of opportunities to return
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [profitMargin, estimatedProfit, confidence, gasEstimate]
 *           default: profitMargin
 *         description: Sort opportunities by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of arbitrage opportunities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 opportunities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ArbitrageOpportunity'
 *                 total:
 *                   type: integer
 *                 filters:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/opportunities', [
  requirePermission('VIEW_ARBITRAGE'),
  query('minProfitMargin').optional().isFloat({ min: 0, max: 100 }),
  query('maxGasEstimate').optional().isFloat({ min: 0 }),
  query('exchanges').optional().isArray(),
  query('tokens').optional().isArray(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy').optional().isIn(['profitMargin', 'estimatedProfit', 'confidence', 'gasEstimate']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      minProfitMargin,
      maxGasEstimate,
      exchanges,
      tokens,
      limit = 20,
      sortBy = 'profitMargin',
      sortOrder = 'desc'
    } = req.query;

    const filter = {
      ...(minProfitMargin && { minProfitMargin: Number(minProfitMargin) }),
      ...(maxGasEstimate && { maxGasEstimate: Number(maxGasEstimate) }),
      ...(exchanges && { exchanges: Array.isArray(exchanges) ? exchanges : [exchanges] }),
      ...(tokens && { tokens: Array.isArray(tokens) ? tokens : [tokens] })
    };

    const options = {
      limit: Number(limit),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const opportunities = await arbitrageService.findOpportunities(filter, options);

    res.json({
      opportunities,
      total: opportunities.length,
      filters: filter,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch arbitrage opportunities', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/arbitrage/opportunities/{id}:
 *   get:
 *     summary: Get specific arbitrage opportunity
 *     tags: [Arbitrage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Opportunity ID
 *     responses:
 *       200:
 *         description: Arbitrage opportunity details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArbitrageOpportunity'
 *       404:
 *         description: Opportunity not found
 */
router.get('/opportunities/:id', [
  requirePermission('VIEW_ARBITRAGE'),
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const opportunity = await arbitrageService.findOpportunityById(id);

    if (!opportunity) {
      return res.status(404).json({ error: 'Arbitrage opportunity not found' });
    }

    res.json(opportunity);
  } catch (error) {
    logger.error('Failed to fetch arbitrage opportunity', { 
      error: (error as any).message, 
      opportunityId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/arbitrage/execute:
 *   post:
 *     summary: Execute arbitrage opportunity
 *     tags: [Arbitrage]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - opportunityId
 *               - amount
 *             properties:
 *               opportunityId:
 *                 type: string
 *                 description: Arbitrage opportunity ID
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 description: Amount to trade
 *               maxSlippage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 50
 *                 default: 3
 *                 description: Maximum acceptable slippage percentage
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *                 description: If true, simulates execution without actual trade
 *     responses:
 *       200:
 *         description: Arbitrage execution initiated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArbitrageExecution'
 *       400:
 *         description: Invalid execution parameters
 *       404:
 *         description: Opportunity not found or expired
 */
router.post('/execute', [
  requirePermission('EXECUTE_ARBITRAGE'),
  rateLimitMiddleware('arbitrage_execution', 10, 60), // 10 executions per minute
  body('opportunityId').isUUID().withMessage('Valid opportunity ID required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('maxSlippage').optional().isFloat({ min: 0, max: 50 }).withMessage('Max slippage must be 0-50%'),
  body('dryRun').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { opportunityId, amount, maxSlippage = 3, dryRun = false } = req.body;

    // Verify opportunity exists and is still valid
    const opportunity = await arbitrageService.findOpportunityById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Arbitrage opportunity not found' });
    }

    if (new Date() > opportunity.expiresAt) {
      return res.status(400).json({ error: 'Arbitrage opportunity has expired' });
    }

    const executionData = {
      opportunityId,
      amount,
      maxSlippage,
      dryRun,
      userId: req.user.id,
      executedAt: new Date()
    };

    const execution = await arbitrageService.execute(executionData);

    logger.info('Arbitrage execution initiated', { 
      executionId: execution.id,
      opportunityId,
      amount,
      userId: req.user.id,
      dryRun
    });

    res.json(execution);
  } catch (error) {
    logger.error('Failed to execute arbitrage', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/arbitrage/history:
 *   get:
 *     summary: Get arbitrage execution history
 *     tags: [Arbitrage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, EXECUTING, COMPLETED, FAILED, CANCELLED]
 *         description: Filter by execution status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for history range
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for history range
 *       - in: query
 *         name: minProfit
 *         schema:
 *           type: number
 *         description: Minimum profit filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: List of arbitrage executions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 executions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ArbitrageExecution'
 *                 total:
 *                   type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalProfit:
 *                       type: number
 *                     successRate:
 *                       type: number
 *                     averageProfit:
 *                       type: number
 */
router.get('/history', [
  requirePermission('VIEW_ARBITRAGE'),
  query('status').optional().isIn(['PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('minProfit').optional().isFloat(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      status,
      dateFrom,
      dateTo,
      minProfit,
      limit = 20,
      offset = 0
    } = req.query;

    const filter = {
      ...(status && { status }),
      ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
      ...(dateTo && { dateTo: new Date(dateTo as string) }),
      ...(minProfit && { minProfit: Number(minProfit) }),
      userId: req.user.role === 'admin' ? req.query.userId : req.user.id
    };

    const result = await arbitrageService.getHistory(filter, { 
      limit: Number(limit), 
      offset: Number(offset) 
    });

    res.json({
      executions: result.executions,
      total: result.total,
      summary: result.summary,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Failed to fetch arbitrage history', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/arbitrage/executions/{id}:
 *   get:
 *     summary: Get arbitrage execution details
 *     tags: [Arbitrage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Execution ID
 *     responses:
 *       200:
 *         description: Execution details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArbitrageExecution'
 *       404:
 *         description: Execution not found
 */
router.get('/executions/:id', [
  requirePermission('VIEW_ARBITRAGE'),
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const execution = await arbitrageService.findExecutionById(id);

    if (!execution) {
      return res.status(404).json({ error: 'Arbitrage execution not found' });
    }

    // Check ownership for non-admin users
    if (req.user.role !== 'admin' && execution.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(execution);
  } catch (error) {
    logger.error('Failed to fetch arbitrage execution', { 
      error: (error as any).message, 
      executionId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/arbitrage/executions/{id}/cancel:
 *   post:
 *     summary: Cancel pending arbitrage execution
 *     tags: [Arbitrage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Execution ID
 *     responses:
 *       200:
 *         description: Execution cancelled successfully
 *       400:
 *         description: Execution cannot be cancelled
 *       404:
 *         description: Execution not found
 */
router.post('/executions/:id/cancel', [
  requirePermission('EXECUTE_ARBITRAGE'),
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const execution = await arbitrageService.findExecutionById(id);

    if (!execution) {
      return res.status(404).json({ error: 'Arbitrage execution not found' });
    }

    // Check ownership for non-admin users
    if (req.user.role !== 'admin' && execution.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (execution.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending executions can be cancelled' });
    }

    const cancelledExecution = await arbitrageService.cancelExecution(id);

    logger.info('Arbitrage execution cancelled', { 
      executionId: id, 
      userId: req.user.id 
    });

    res.json(cancelledExecution);
  } catch (error) {
    logger.error('Failed to cancel arbitrage execution', { 
      error: (error as any).message, 
      executionId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/arbitrage/analytics:
 *   get:
 *     summary: Get arbitrage analytics and statistics
 *     tags: [Arbitrage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [DAY, WEEK, MONTH, QUARTER, YEAR]
 *           default: MONTH
 *         description: Time range for analytics
 *     responses:
 *       200:
 *         description: Arbitrage analytics data
 */
router.get('/analytics', [
  requirePermission('VIEW_ARBITRAGE'),
  query('timeRange').optional().isIn(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { timeRange = 'MONTH' } = req.query;
    const userId = req.user.role === 'admin' ? req.query.userId : req.user.id;

    const analytics = await arbitrageService.getAnalytics(userId as string, timeRange as string);

    res.json(analytics);
  } catch (error) {
    logger.error('Failed to fetch arbitrage analytics', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;