import express from 'express';
import { query, body, validationResult } from 'express-validator';
import { authMiddleware, requirePermission } from '../../middleware/authentication';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { AnalyticsService } from '../../../core/services/AnalyticsService';
import { MarketDataService } from '../../../core/services/MarketDataService';
import { PerformanceService } from '../../../core/services/PerformanceService';
import { Logger } from '../../../utils/logger';

const router = express.Router();
const logger = new Logger('AnalyticsRoutes');
const analyticsService = new AnalyticsService();
const marketDataService = new MarketDataService();
const performanceService = new PerformanceService();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/analytics/portfolio:
 *   post:
 *     summary: Analyze portfolio performance and composition
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - portfolioId
 *             properties:
 *               portfolioId:
 *                 type: string
 *                 description: Portfolio ID to analyze
 *               timeRange:
 *                 type: string
 *                 enum: [HOUR, DAY, WEEK, MONTH, QUARTER, YEAR, ALL]
 *                 default: MONTH
 *               benchmarkAsset:
 *                 type: string
 *                 description: Asset to use as benchmark (e.g., BTC, ETH)
 *               includeProjections:
 *                 type: boolean
 *                 default: false
 *                 description: Include future performance projections
 *     responses:
 *       200:
 *         description: Portfolio analysis results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 performance:
 *                   type: object
 *                 riskMetrics:
 *                   type: object
 *                 assetAllocation:
 *                   type: object
 *                 benchmarkComparison:
 *                   type: object
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post('/portfolio', [
  rateLimitMiddleware('analytics_portfolio', 30, 60), // 30 analyses per minute
  body('portfolioId').isUUID().withMessage('Valid portfolio ID required'),
  body('timeRange').optional().isIn(['HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL']),
  body('benchmarkAsset').optional().isString(),
  body('includeProjections').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      portfolioId,
      timeRange = 'MONTH',
      benchmarkAsset,
      includeProjections = false
    } = req.body;

    const params = {
      portfolioId,
      timeRange,
      benchmarkAsset,
      includeProjections,
      userId: req.user.id,
      userRole: req.user.role
    };

    const analysis = await analyticsService.analyzePortfolio(params);

    logger.info('Portfolio analysis completed', { 
      portfolioId, 
      timeRange, 
      userId: req.user.id 
    });

    res.json(analysis);
  } catch (error) {
    logger.error('Failed to analyze portfolio', { 
      error: (error as any).message, 
      portfolioId: req.body.portfolioId 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/market-sentiment:
 *   get:
 *     summary: Get market sentiment analysis
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: symbols
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Asset symbols to analyze (max 20)
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [HOUR, DAY, WEEK, MONTH]
 *           default: DAY
 *       - in: query
 *         name: sources
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [social, news, technical, onchain]
 *         description: Sentiment data sources
 *     responses:
 *       200:
 *         description: Market sentiment analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overallSentiment:
 *                   type: object
 *                 assetSentiments:
 *                   type: array
 *                 sentimentTrends:
 *                   type: array
 *                 keyDrivers:
 *                   type: array
 *                 confidence:
 *                   type: number
 */
router.get('/market-sentiment', [
  requirePermission('VIEW_MARKET_ANALYTICS'),
  rateLimitMiddleware('analytics_sentiment', 20, 60), // 20 requests per minute
  query('symbols').optional().isArray(),
  query('timeRange').optional().isIn(['HOUR', 'DAY', 'WEEK', 'MONTH']),
  query('sources').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      symbols = [],
      timeRange = 'DAY',
      sources = ['social', 'news', 'technical', 'onchain']
    } = req.query;

    // Limit symbols for performance
    if (Array.isArray(symbols) && symbols.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 symbols allowed' });
    }

    const params = {
      symbols: Array.isArray(symbols) ? symbols : [symbols].filter(Boolean),
      timeRange,
      sources: Array.isArray(sources) ? sources : [sources].filter(Boolean),
      userId: req.user.id,
      userRole: req.user.role
    };

    const sentiment = await analyticsService.analyzeSentiment(params);

    logger.info('Market sentiment analysis completed', { 
      symbolCount: params.symbols.length, 
      timeRange, 
      userId: req.user.id 
    });

    res.json(sentiment);
  } catch (error) {
    logger.error('Failed to analyze market sentiment', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/risk-assessment:
 *   post:
 *     summary: Perform risk assessment analysis
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entityType
 *               - entityId
 *             properties:
 *               entityType:
 *                 type: string
 *                 enum: [portfolio, agent, strategy]
 *               entityId:
 *                 type: string
 *               riskFactors:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [market, liquidity, counterparty, operational, regulatory]
 *               timeHorizon:
 *                 type: string
 *                 enum: [short, medium, long]
 *                 default: medium
 *               confidenceLevel:
 *                 type: number
 *                 minimum: 0.8
 *                 maximum: 0.99
 *                 default: 0.95
 *     responses:
 *       200:
 *         description: Risk assessment results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overallRiskScore:
 *                   type: number
 *                 riskBreakdown:
 *                   type: object
 *                 valueAtRisk:
 *                   type: object
 *                 stressTestResults:
 *                   type: array
 *                 recommendations:
 *                   type: array
 */
router.post('/risk-assessment', [
  rateLimitMiddleware('analytics_risk', 15, 60), // 15 assessments per minute
  body('entityType').isIn(['portfolio', 'agent', 'strategy']),
  body('entityId').isUUID(),
  body('riskFactors').optional().isArray(),
  body('timeHorizon').optional().isIn(['short', 'medium', 'long']),
  body('confidenceLevel').optional().isFloat({ min: 0.8, max: 0.99 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      entityType,
      entityId,
      riskFactors = ['market', 'liquidity', 'counterparty', 'operational'],
      timeHorizon = 'medium',
      confidenceLevel = 0.95
    } = req.body;

    const params = {
      entityType,
      entityId,
      riskFactors,
      timeHorizon,
      confidenceLevel,
      userId: req.user.id,
      userRole: req.user.role
    };

    const riskAssessment = await analyticsService.assessRisk(params);

    logger.info('Risk assessment completed', { 
      entityType, 
      entityId, 
      riskScore: riskAssessment.overallRiskScore,
      userId: req.user.id 
    });

    res.json(riskAssessment);
  } catch (error) {
    logger.error('Failed to assess risk', { 
      error: (error as any).message, 
      entityType: req.body.entityType,
      entityId: req.body.entityId 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/performance-attribution:
 *   post:
 *     summary: Analyze performance attribution
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - portfolioId
 *             properties:
 *               portfolioId:
 *                 type: string
 *               benchmarkId:
 *                 type: string
 *               timeRange:
 *                 type: string
 *                 enum: [WEEK, MONTH, QUARTER, YEAR]
 *                 default: MONTH
 *               attributionModel:
 *                 type: string
 *                 enum: [brinson, factor, sector]
 *                 default: brinson
 *     responses:
 *       200:
 *         description: Performance attribution analysis
 */
router.post('/performance-attribution', [
  rateLimitMiddleware('analytics_attribution', 20, 60),
  body('portfolioId').isUUID(),
  body('benchmarkId').optional().isUUID(),
  body('timeRange').optional().isIn(['WEEK', 'MONTH', 'QUARTER', 'YEAR']),
  body('attributionModel').optional().isIn(['brinson', 'factor', 'sector'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      portfolioId,
      benchmarkId,
      timeRange = 'MONTH',
      attributionModel = 'brinson'
    } = req.body;

    const params = {
      portfolioId,
      benchmarkId,
      timeRange,
      attributionModel,
      userId: req.user.id,
      userRole: req.user.role
    };

    const attribution = await analyticsService.attributePerformance(params);

    logger.info('Performance attribution completed', { 
      portfolioId, 
      timeRange, 
      model: attributionModel,
      userId: req.user.id 
    });

    res.json(attribution);
  } catch (error) {
    logger.error('Failed to attribute performance', { 
      error: (error as any).message, 
      portfolioId: req.body.portfolioId 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/correlation:
 *   get:
 *     summary: Analyze asset correlations
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: assets
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *           minItems: 2
 *           maxItems: 50
 *         description: Assets to analyze correlations for
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [WEEK, MONTH, QUARTER, YEAR]
 *           default: MONTH
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [pearson, spearman, kendall]
 *           default: pearson
 *     responses:
 *       200:
 *         description: Correlation analysis results
 */
router.get('/correlation', [
  requirePermission('VIEW_MARKET_ANALYTICS'),
  rateLimitMiddleware('analytics_correlation', 15, 60),
  query('assets').isArray({ min: 2, max: 50 }),
  query('timeRange').optional().isIn(['WEEK', 'MONTH', 'QUARTER', 'YEAR']),
  query('method').optional().isIn(['pearson', 'spearman', 'kendall'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      assets,
      timeRange = 'MONTH',
      method = 'pearson'
    } = req.query;

    const params = {
      assets: Array.isArray(assets) ? assets : [assets],
      timeRange,
      method,
      userId: req.user.id,
      userRole: req.user.role
    };

    const correlations = await analyticsService.analyzeCorrelations(params);

    logger.info('Correlation analysis completed', { 
      assetCount: params.assets.length, 
      timeRange, 
      method,
      userId: req.user.id 
    });

    res.json(correlations);
  } catch (error) {
    logger.error('Failed to analyze correlations', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/volatility:
 *   get:
 *     summary: Analyze asset volatility patterns
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: assets
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Assets to analyze volatility for
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [WEEK, MONTH, QUARTER, YEAR]
 *           default: MONTH
 *       - in: query
 *         name: volatilityType
 *         schema:
 *           type: string
 *           enum: [historical, implied, realized]
 *           default: historical
 *     responses:
 *       200:
 *         description: Volatility analysis results
 */
router.get('/volatility', [
  rateLimitMiddleware('analytics_volatility', 20, 60),
  query('assets').isArray({ min: 1, max: 30 }),
  query('timeRange').optional().isIn(['WEEK', 'MONTH', 'QUARTER', 'YEAR']),
  query('volatilityType').optional().isIn(['historical', 'implied', 'realized'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      assets,
      timeRange = 'MONTH',
      volatilityType = 'historical'
    } = req.query;

    const params = {
      assets: Array.isArray(assets) ? assets : [assets],
      timeRange,
      volatilityType,
      userId: req.user.id,
      userRole: req.user.role
    };

    const volatility = await analyticsService.analyzeVolatility(params);

    logger.info('Volatility analysis completed', { 
      assetCount: params.assets.length, 
      timeRange, 
      type: volatilityType,
      userId: req.user.id 
    });

    res.json(volatility);
  } catch (error) {
    logger.error('Failed to analyze volatility', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/market-data:
 *   get:
 *     summary: Get current market data for multiple assets
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: symbols
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *           maxItems: 100
 *         description: Asset symbols to fetch data for
 *       - in: query
 *         name: includeMetrics
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include additional technical metrics
 *     responses:
 *       200:
 *         description: Market data for requested symbols
 */
router.get('/market-data', [
  rateLimitMiddleware('analytics_market_data', 60, 60),
  query('symbols').isArray({ min: 1, max: 100 }),
  query('includeMetrics').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { symbols, includeMetrics = false } = req.query;

    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    const marketData = await marketDataService.getMultipleSymbols(
      symbolArray as string[], 
      { includeMetrics }
    );

    res.json({
      data: marketData,
      timestamp: new Date().toISOString(),
      count: marketData.length
    });
  } catch (error) {
    logger.error('Failed to fetch market data', { 
      error: (error as any).message, 
      symbols: req.query.symbols 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/analytics/performance-metrics:
 *   get:
 *     summary: Get performance metrics for an entity
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity ID to get metrics for
 *       - in: query
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [AGENT, PORTFOLIO, USER]
 *         description: Type of entity
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [WEEK, MONTH, QUARTER, YEAR, ALL]
 *           default: MONTH
 *     responses:
 *       200:
 *         description: Performance metrics
 */
router.get('/performance-metrics', [
  query('entityId').isUUID(),
  query('entityType').isIn(['AGENT', 'PORTFOLIO', 'USER']),
  query('timeRange').optional().isIn(['WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { entityId, entityType, timeRange = 'MONTH' } = req.query;

    // Verify user has access to the entity
    await performanceService.verifyAccess(
      entityId as string, 
      entityType as string, 
      req.user.id, 
      req.user.role
    );

    const metrics = await performanceService.getMetrics(
      entityId as string, 
      entityType as string, 
      timeRange as string
    );

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to fetch performance metrics', { 
      error: (error as any).message, 
      entityId: req.query.entityId,
      entityType: req.query.entityType 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;