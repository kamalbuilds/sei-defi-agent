import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requirePermission } from '../../middleware/authentication';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { AgentService } from '../../../core/services/AgentService';
import { Logger } from '../../../utils/logger';

const router = express.Router();
const logger = new Logger('AgentRoutes');
const agentService = new AgentService();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/agents:
 *   get:
 *     summary: Get user's agents
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ARBITRAGE, MARKET_MAKER, SENTIMENT_ANALYZER, RISK_MANAGER, PORTFOLIO_OPTIMIZER, YIELD_FARMER, NFT_TRADER]
 *         description: Filter by agent type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, TESTING, DEPLOYED, PAUSED, ERROR]
 *         description: Filter by agent status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of agents to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of agents to skip
 *     responses:
 *       200:
 *         description: List of agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 */
router.get('/', [
  query('type').optional().isIn(['ARBITRAGE', 'MARKET_MAKER', 'SENTIMENT_ANALYZER', 'RISK_MANAGER', 'PORTFOLIO_OPTIMIZER', 'YIELD_FARMER', 'NFT_TRADER']),
  query('status').optional().isIn(['DRAFT', 'TESTING', 'DEPLOYED', 'PAUSED', 'ERROR']),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, status, limit = 20, offset = 0 } = req.query;
    const userId = req.user.role === 'admin' ? req.query.userId : req.user.id;

    const filter = {
      ...(type && { type }),
      ...(status && { status }),
      userId
    };

    const result = await agentService.findMany(filter, { limit, offset });

    res.json({
      agents: result.agents,
      total: result.total,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Failed to fetch agents', { error: (error as any).message, userId: req.user.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/agents/{id}:
 *   get:
 *     summary: Get agent by ID
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       404:
 *         description: Agent not found
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
    const agent = await agentService.findById(id);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    if (agent.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(agent);
  } catch (error) {
    logger.error('Failed to fetch agent', { error: (error as any).message, agentId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/agents:
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
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
 *               - type
 *               - config
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               type:
 *                 type: string
 *                 enum: [ARBITRAGE, MARKET_MAKER, SENTIMENT_ANALYZER, RISK_MANAGER, PORTFOLIO_OPTIMIZER, YIELD_FARMER, NFT_TRADER]
 *               config:
 *                 type: object
 *                 description: Agent configuration parameters
 *     responses:
 *       201:
 *         description: Agent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       400:
 *         description: Invalid input
 */
router.post('/', [
  rateLimitMiddleware('agent_creation', 10, 60), // 10 creations per minute
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 characters'),
  body('type').isIn(['ARBITRAGE', 'MARKET_MAKER', 'SENTIMENT_ANALYZER', 'RISK_MANAGER', 'PORTFOLIO_OPTIMIZER', 'YIELD_FARMER', 'NFT_TRADER']),
  body('config').isObject().withMessage('Config must be a valid JSON object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, type, config } = req.body;

    const agentData = {
      name,
      type,
      config,
      userId: req.user.id,
      status: 'DRAFT',
      version: '1.0.0'
    };

    const agent = await agentService.create(agentData);

    logger.info('Agent created', { agentId: agent.id, userId: req.user.id, type });

    res.status(201).json(agent);
  } catch (error) {
    logger.error('Failed to create agent', { error: (error as any).message, userId: req.user.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/agents/{id}:
 *   put:
 *     summary: Update agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
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
 *               config:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [DRAFT, TESTING, DEPLOYED, PAUSED, ERROR]
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       404:
 *         description: Agent not found
 */
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ min: 3, max: 100 }),
  body('config').optional().isObject(),
  body('status').optional().isIn(['DRAFT', 'TESTING', 'DEPLOYED', 'PAUSED', 'ERROR'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const existingAgent = await agentService.findById(id);
    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    if (existingAgent.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const agent = await agentService.update(id, updates);

    logger.info('Agent updated', { agentId: id, userId: req.user.id, updates: Object.keys(updates) });

    res.json(agent);
  } catch (error) {
    logger.error('Failed to update agent', { error: (error as any).message, agentId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/agents/{id}/deploy:
 *   post:
 *     summary: Deploy agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent deployed successfully
 *       400:
 *         description: Agent cannot be deployed
 *       404:
 *         description: Agent not found
 */
router.post('/:id/deploy', [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    const agent = await agentService.findById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    if (agent.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (agent.status !== 'TESTING') {
      return res.status(400).json({ error: 'Agent must be in TESTING status to deploy' });
    }

    const deployedAgent = await agentService.deploy(id);

    logger.info('Agent deployed', { agentId: id, userId: req.user.id });

    res.json(deployedAgent);
  } catch (error) {
    logger.error('Failed to deploy agent', { error: (error as any).message, agentId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/agents/{id}/pause:
 *   post:
 *     summary: Pause agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent paused successfully
 *       400:
 *         description: Agent cannot be paused
 *       404:
 *         description: Agent not found
 */
router.post('/:id/pause', [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    const agent = await agentService.findById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    if (agent.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (agent.status !== 'DEPLOYED') {
      return res.status(400).json({ error: 'Only deployed agents can be paused' });
    }

    const pausedAgent = await agentService.pause(id);

    logger.info('Agent paused', { agentId: id, userId: req.user.id });

    res.json(pausedAgent);
  } catch (error) {
    logger.error('Failed to pause agent', { error: (error as any).message, agentId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/agents/{id}/performance:
 *   get:
 *     summary: Get agent performance metrics
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [HOUR, DAY, WEEK, MONTH, QUARTER, YEAR, ALL]
 *           default: WEEK
 *         description: Time range for performance data
 *     responses:
 *       200:
 *         description: Agent performance metrics
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
    const { timeRange = 'WEEK' } = req.query;

    const agent = await agentService.findById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    if (agent.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const performance = await agentService.getPerformance(id, timeRange as string);

    res.json(performance);
  } catch (error) {
    logger.error('Failed to fetch agent performance', { error: (error as any).message, agentId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/agents/{id}:
 *   delete:
 *     summary: Delete agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       204:
 *         description: Agent deleted successfully
 *       400:
 *         description: Agent cannot be deleted
 *       404:
 *         description: Agent not found
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

    const agent = await agentService.findById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check ownership
    if (agent.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (agent.status === 'DEPLOYED') {
      return res.status(400).json({ error: 'Cannot delete deployed agent. Please pause it first.' });
    }

    await agentService.delete(id);

    logger.info('Agent deleted', { agentId: id, userId: req.user.id });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete agent', { error: (error as any).message, agentId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;