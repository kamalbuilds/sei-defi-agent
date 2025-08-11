import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, requirePermission } from '../../middleware/authentication';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { PaymentService } from '../../../core/services/PaymentService';
import { Logger } from '../../../utils/logger';

const router = express.Router();
const logger = new Logger('PaymentRoutes');
const paymentService = new PaymentService();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get user's payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SUBSCRIPTION, TRANSACTION_FEE, PROFIT_SHARE, WITHDRAWAL, DEPOSIT]
 *         description: Filter by payment type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED]
 *         description: Filter by payment status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for payment range
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for payment range
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *         description: Minimum payment amount
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *         description: Maximum payment amount
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
 *         description: List of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 total:
 *                   type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalAmount:
 *                       type: number
 *                     pendingAmount:
 *                       type: number
 *                     completedAmount:
 *                       type: number
 */
router.get('/', [
  query('type').optional().isIn(['SUBSCRIPTION', 'TRANSACTION_FEE', 'PROFIT_SHARE', 'WITHDRAWAL', 'DEPOSIT']),
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('minAmount').optional().isFloat({ min: 0 }),
  query('maxAmount').optional().isFloat({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      type,
      status,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      limit = 20,
      offset = 0
    } = req.query;

    const userId = req.user.role === 'admin' ? req.query.userId : req.user.id;

    const filter = {
      ...(type && { type }),
      ...(status && { status }),
      ...(dateFrom && { dateFrom: new Date(dateFrom as string) }),
      ...(dateTo && { dateTo: new Date(dateTo as string) }),
      ...(minAmount && { minAmount: Number(minAmount) }),
      ...(maxAmount && { maxAmount: Number(maxAmount) }),
      userId
    };

    const result = await paymentService.findByUserId(userId as string, filter, { 
      limit: Number(limit), 
      offset: Number(offset) 
    });

    res.json({
      payments: result.payments,
      total: result.total,
      summary: result.summary,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Failed to fetch payments', { error: (error as any).message, userId: req.user.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
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
    const payment = await paymentService.findById(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check ownership for non-admin users
    if (req.user.role !== 'admin' && payment.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(payment);
  } catch (error) {
    logger.error('Failed to fetch payment', { error: (error as any).message, paymentId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - currency
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [SUBSCRIPTION, TRANSACTION_FEE, PROFIT_SHARE, WITHDRAWAL, DEPOSIT]
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 3
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               metadata:
 *                 type: object
 *                 description: Additional payment metadata
 *     responses:
 *       201:
 *         description: Payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Invalid payment data
 */
router.post('/', [
  rateLimitMiddleware('payment_creation', 20, 60), // 20 payments per minute
  body('type').isIn(['SUBSCRIPTION', 'TRANSACTION_FEE', 'PROFIT_SHARE', 'WITHDRAWAL', 'DEPOSIT']),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('description').optional().isLength({ max: 500 }),
  body('metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, amount, currency, description, metadata } = req.body;

    // Validate withdrawal permissions for large amounts
    if (type === 'WITHDRAWAL' && amount > 10000) {
      if (!req.user.permissions?.includes('LARGE_WITHDRAWAL')) {
        return res.status(403).json({ error: 'Large withdrawal permission required' });
      }
    }

    const paymentData = {
      type,
      amount,
      currency: currency.toUpperCase(),
      description,
      metadata,
      userId: req.user.id,
      status: 'PENDING'
    };

    const payment = await paymentService.create(paymentData);

    logger.info('Payment created', { 
      paymentId: payment.id, 
      type, 
      amount, 
      currency, 
      userId: req.user.id 
    });

    res.status(201).json(payment);
  } catch (error) {
    logger.error('Failed to create payment', { error: (error as any).message, userId: req.user.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments/{id}/process:
 *   post:
 *     summary: Process a pending payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Payment cannot be processed
 *       404:
 *         description: Payment not found
 */
router.post('/:id/process', [
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const payment = await paymentService.findById(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check permissions - admins and payment processors can process any payment
    // Users can only process their own payments
    const canProcess = req.user.role === 'admin' || 
                      req.user.permissions?.includes('PROCESS_PAYMENTS') || 
                      payment.userId === req.user.id;

    if (!canProcess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending payments can be processed' });
    }

    const processedPayment = await paymentService.process(id);

    logger.info('Payment processed', { 
      paymentId: id, 
      amount: payment.amount,
      type: payment.type,
      processedBy: req.user.id 
    });

    res.json(processedPayment);
  } catch (error) {
    logger.error('Failed to process payment', { 
      error: (error as any).message, 
      paymentId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments/{id}/refund:
 *   post:
 *     summary: Refund a completed payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for refund
 *               partialAmount:
 *                 type: number
 *                 minimum: 0
 *                 description: Partial refund amount (full refund if not specified)
 *     responses:
 *       200:
 *         description: Payment refunded successfully
 *       400:
 *         description: Payment cannot be refunded
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Payment not found
 */
router.post('/:id/refund', [
  requirePermission('REFUND_PAYMENTS'),
  param('id').isUUID(),
  body('reason').optional().isLength({ max: 500 }),
  body('partialAmount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { reason, partialAmount } = req.body;

    const payment = await paymentService.findById(id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Only completed payments can be refunded' });
    }

    if (partialAmount && partialAmount > payment.amount) {
      return res.status(400).json({ error: 'Partial refund amount cannot exceed original amount' });
    }

    const refundData = {
      reason,
      amount: partialAmount || payment.amount,
      refundedBy: req.user.id
    };

    const refundedPayment = await paymentService.refund(id, refundData);

    logger.info('Payment refunded', { 
      paymentId: id, 
      originalAmount: payment.amount,
      refundAmount: refundData.amount,
      reason,
      refundedBy: req.user.id 
    });

    res.json(refundedPayment);
  } catch (error) {
    logger.error('Failed to refund payment', { 
      error: (error as any).message, 
      paymentId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments/{id}/cancel:
 *   post:
 *     summary: Cancel a pending payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Payment cancelled successfully
 *       400:
 *         description: Payment cannot be cancelled
 *       404:
 *         description: Payment not found
 */
router.post('/:id/cancel', [
  param('id').isUUID(),
  body('reason').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const payment = await paymentService.findById(id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check ownership for non-admin users
    if (req.user.role !== 'admin' && payment.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending payments can be cancelled' });
    }

    const cancelledPayment = await paymentService.cancel(id, reason);

    logger.info('Payment cancelled', { 
      paymentId: id, 
      reason,
      cancelledBy: req.user.id 
    });

    res.json(cancelledPayment);
  } catch (error) {
    logger.error('Failed to cancel payment', { 
      error: (error as any).message, 
      paymentId: req.params.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments/analytics:
 *   get:
 *     summary: Get payment analytics and statistics
 *     tags: [Payments]
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
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [type, status, currency, day, week, month]
 *           default: type
 *         description: Group analytics by field
 *     responses:
 *       200:
 *         description: Payment analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalAmount:
 *                       type: number
 *                     totalCount:
 *                       type: integer
 *                     averageAmount:
 *                       type: number
 *                     successRate:
 *                       type: number
 *                 breakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                 trends:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/analytics', [
  query('timeRange').optional().isIn(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']),
  query('groupBy').optional().isIn(['type', 'status', 'currency', 'day', 'week', 'month'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { timeRange = 'MONTH', groupBy = 'type' } = req.query;
    const userId = req.user.role === 'admin' ? req.query.userId : req.user.id;

    const analytics = await paymentService.getAnalytics(
      userId as string, 
      timeRange as string, 
      groupBy as string
    );

    res.json(analytics);
  } catch (error) {
    logger.error('Failed to fetch payment analytics', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;