import { Logger } from '../../utils/logger';

export interface Payment {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'SUBSCRIPTION' | 'FEE' | 'REFUND';
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  method: 'CRYPTO' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD';
  description?: string;
  txHash?: string;
  blockchainNetwork?: string;
  walletAddress?: string;
  bankDetails?: BankDetails;
  cardDetails?: CardDetails;
  fees: PaymentFee[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface BankDetails {
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS';
}

export interface CardDetails {
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardType: 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER';
  cardholderName: string;
}

export interface PaymentFee {
  type: 'NETWORK' | 'PROCESSING' | 'PLATFORM' | 'CONVERSION';
  amount: number;
  currency: string;
  description: string;
}

export interface PaymentFilter {
  status?: string;
  type?: string;
  currency?: string;
  method?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentStats {
  totalVolume: number;
  totalCount: number;
  averageAmount: number;
  successRate: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byCurrency: Record<string, number>;
}

export class PaymentService {
  private logger = new Logger('PaymentService');
  private payments: Map<string, Payment> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockPayments: Payment[] = [
      {
        id: 'payment-1',
        userId: 'user-123',
        type: 'DEPOSIT',
        amount: 1000,
        currency: 'USDC',
        status: 'COMPLETED',
        method: 'CRYPTO',
        description: 'Initial deposit',
        txHash: '0x1234...abcd',
        blockchainNetwork: 'SEI',
        walletAddress: '0xabcd...1234',
        fees: [
          {
            type: 'NETWORK',
            amount: 2.5,
            currency: 'SEI',
            description: 'Network transaction fee'
          }
        ],
        metadata: { source: 'web_app' },
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        updatedAt: new Date(Date.now() - 86400000 + 3600000), // 1 day ago + 1 hour
        completedAt: new Date(Date.now() - 86400000 + 3600000)
      },
      {
        id: 'payment-2',
        userId: 'user-123',
        type: 'WITHDRAWAL',
        amount: 250,
        currency: 'ETH',
        status: 'PROCESSING',
        method: 'CRYPTO',
        description: 'Partial withdrawal',
        walletAddress: '0xefgh...5678',
        blockchainNetwork: 'ETHEREUM',
        fees: [
          {
            type: 'NETWORK',
            amount: 0.008,
            currency: 'ETH',
            description: 'Network gas fee'
          },
          {
            type: 'PROCESSING',
            amount: 2.5,
            currency: 'USD',
            description: 'Processing fee'
          }
        ],
        metadata: { source: 'mobile_app' },
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        updatedAt: new Date(Date.now() - 1800000) // 30 minutes ago
      },
      {
        id: 'payment-3',
        userId: 'user-456',
        type: 'SUBSCRIPTION',
        amount: 29.99,
        currency: 'USD',
        status: 'COMPLETED',
        method: 'CREDIT_CARD',
        description: 'Monthly Pro subscription',
        cardDetails: {
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
          cardType: 'VISA',
          cardholderName: 'John Doe'
        },
        fees: [
          {
            type: 'PROCESSING',
            amount: 0.89,
            currency: 'USD',
            description: 'Credit card processing fee'
          }
        ],
        metadata: { 
          subscriptionId: 'sub-123',
          plan: 'pro',
          billingCycle: 'monthly'
        },
        createdAt: new Date(Date.now() - 1209600000), // 14 days ago
        updatedAt: new Date(Date.now() - 1209600000 + 300000), // 14 days ago + 5 minutes
        completedAt: new Date(Date.now() - 1209600000 + 300000)
      }
    ];

    mockPayments.forEach(payment => this.payments.set(payment.id, payment));
    this.logger.info('Mock payment data initialized', { count: mockPayments.length });
  }

  async findByUserId(userId: string, filter?: PaymentFilter): Promise<Payment[]> {
    let userPayments = Array.from(this.payments.values())
      .filter(payment => payment.userId === userId);

    if (filter) {
      if (filter.status) {
        userPayments = userPayments.filter(p => p.status === filter.status);
      }
      if (filter.type) {
        userPayments = userPayments.filter(p => p.type === filter.type);
      }
      if (filter.currency) {
        userPayments = userPayments.filter(p => p.currency === filter.currency);
      }
      if (filter.method) {
        userPayments = userPayments.filter(p => p.method === filter.method);
      }
      if (filter.dateFrom) {
        userPayments = userPayments.filter(p => p.createdAt >= filter.dateFrom);
      }
      if (filter.dateTo) {
        userPayments = userPayments.filter(p => p.createdAt <= filter.dateTo);
      }
      if (filter.minAmount) {
        userPayments = userPayments.filter(p => p.amount >= filter.minAmount);
      }
      if (filter.maxAmount) {
        userPayments = userPayments.filter(p => p.amount <= filter.maxAmount);
      }
    }

    // Sort by creation date (newest first)
    userPayments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    this.logger.info('User payments retrieved', { userId, count: userPayments.length, filter });
    return userPayments;
  }

  async findById(id: string): Promise<Payment | null> {
    const payment = this.payments.get(id);
    
    if (payment) {
      this.logger.info('Payment found', { id, userId: payment.userId, amount: payment.amount });
    } else {
      this.logger.warn('Payment not found', { id });
    }
    
    return payment || null;
  }

  async create(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    const payment: Payment = {
      ...paymentData,
      id: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Calculate fees based on payment type and method
    if (payment.fees.length === 0) {
      payment.fees = this.calculateFees(payment);
    }

    this.payments.set(payment.id, payment);
    
    this.logger.info('Payment created', { 
      id: payment.id, 
      userId: payment.userId, 
      type: payment.type,
      amount: payment.amount,
      currency: payment.currency
    });

    // Simulate async processing for certain payment methods
    if (payment.method === 'BANK_TRANSFER' || payment.method === 'CRYPTO') {
      setTimeout(() => this.processPaymentAsync(payment.id), 5000);
    }

    return payment;
  }

  private calculateFees(payment: Payment): PaymentFee[] {
    const fees: PaymentFee[] = [];

    switch (payment.method) {
      case 'CRYPTO':
        fees.push({
          type: 'NETWORK',
          amount: payment.currency === 'ETH' ? 0.005 : 1.5,
          currency: payment.currency === 'ETH' ? 'ETH' : 'SEI',
          description: 'Blockchain network fee'
        });
        break;

      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        fees.push({
          type: 'PROCESSING',
          amount: Math.max(0.30, payment.amount * 0.029),
          currency: payment.currency,
          description: 'Card processing fee'
        });
        break;

      case 'BANK_TRANSFER':
        fees.push({
          type: 'PROCESSING',
          amount: payment.amount > 10000 ? 25 : 5,
          currency: 'USD',
          description: 'Wire transfer fee'
        });
        break;
    }

    // Platform fee for certain transaction types
    if (payment.type === 'WITHDRAWAL' && payment.amount > 1000) {
      fees.push({
        type: 'PLATFORM',
        amount: payment.amount * 0.001,
        currency: payment.currency,
        description: 'Platform withdrawal fee'
      });
    }

    return fees;
  }

  private async processPaymentAsync(paymentId: string): Promise<void> {
    const payment = this.payments.get(paymentId);
    if (!payment || payment.status !== 'PENDING') {
      return;
    }

    // Simulate processing time and potential failures
    const shouldFail = Math.random() < 0.05; // 5% failure rate

    if (shouldFail) {
      payment.status = 'FAILED';
      payment.metadata.failureReason = 'Insufficient funds';
    } else {
      payment.status = 'COMPLETED';
      payment.completedAt = new Date();
      
      // Generate transaction hash for crypto payments
      if (payment.method === 'CRYPTO' && !payment.txHash) {
        payment.txHash = '0x' + Math.random().toString(16).substr(2, 64);
      }
    }

    payment.updatedAt = new Date();
    this.payments.set(paymentId, payment);

    this.logger.info('Payment processed asynchronously', { 
      paymentId, 
      status: payment.status,
      txHash: payment.txHash 
    });
  }

  async process(id: string): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'PENDING') {
      throw new Error(`Payment is in ${payment.status} status and cannot be processed`);
    }

    // Simulate processing logic
    const now = new Date();
    const processedPayment: Payment = {
      ...payment,
      status: 'PROCESSING',
      updatedAt: now
    };

    this.payments.set(id, processedPayment);

    this.logger.info('Payment processing started', { id, userId: payment.userId });

    // Complete processing after a short delay
    setTimeout(async () => {
      const finalPayment = this.payments.get(id);
      if (finalPayment && finalPayment.status === 'PROCESSING') {
        finalPayment.status = 'COMPLETED';
        finalPayment.completedAt = new Date();
        finalPayment.updatedAt = new Date();
        
        if (finalPayment.method === 'CRYPTO' && !finalPayment.txHash) {
          finalPayment.txHash = '0x' + Math.random().toString(16).substr(2, 64);
        }

        this.payments.set(id, finalPayment);
        this.logger.info('Payment completed', { id, txHash: finalPayment.txHash });
      }
    }, 2000);

    return processedPayment;
  }

  async refund(id: string): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'COMPLETED') {
      throw new Error('Only completed payments can be refunded');
    }

    // Create refund payment
    const refundPayment: Payment = {
      ...payment,
      id: `refund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'REFUND',
      status: 'COMPLETED',
      description: `Refund for payment ${id}`,
      metadata: {
        ...payment.metadata,
        originalPaymentId: id,
        refundType: 'full'
      },
      fees: [], // No fees for refunds
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date()
    };

    this.payments.set(refundPayment.id, refundPayment);

    // Update original payment
    const updatedPayment: Payment = {
      ...payment,
      metadata: {
        ...payment.metadata,
        refunded: true,
        refundPaymentId: refundPayment.id
      },
      updatedAt: new Date()
    };

    this.payments.set(id, updatedPayment);

    this.logger.info('Payment refunded', { 
      originalId: id, 
      refundId: refundPayment.id,
      amount: refundPayment.amount
    });

    return refundPayment;
  }

  async cancel(id: string): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'COMPLETED') {
      throw new Error('Completed payments cannot be cancelled');
    }

    const cancelledPayment: Payment = {
      ...payment,
      status: 'CANCELLED',
      updatedAt: new Date(),
      metadata: {
        ...payment.metadata,
        cancelledAt: new Date(),
        cancelReason: 'User requested cancellation'
      }
    };

    this.payments.set(id, cancelledPayment);
    this.logger.info('Payment cancelled', { id, userId: payment.userId });

    return cancelledPayment;
  }

  async getPaymentStats(userId: string, timeRange?: string): Promise<PaymentStats> {
    let userPayments = Array.from(this.payments.values())
      .filter(payment => payment.userId === userId);

    // Apply time range filter
    if (timeRange) {
      const now = new Date();
      let cutoffDate: Date;

      switch (timeRange) {
        case '24h':
          cutoffDate = new Date(now.getTime() - 86400000);
          break;
        case '7d':
          cutoffDate = new Date(now.getTime() - 604800000);
          break;
        case '30d':
          cutoffDate = new Date(now.getTime() - 2592000000);
          break;
        case '90d':
          cutoffDate = new Date(now.getTime() - 7776000000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      userPayments = userPayments.filter(p => p.createdAt >= cutoffDate);
    }

    const stats: PaymentStats = {
      totalVolume: userPayments.reduce((sum, p) => sum + p.amount, 0),
      totalCount: userPayments.length,
      averageAmount: 0,
      successRate: 0,
      byStatus: {},
      byType: {},
      byCurrency: {}
    };

    if (stats.totalCount > 0) {
      stats.averageAmount = stats.totalVolume / stats.totalCount;
      
      const completedPayments = userPayments.filter(p => p.status === 'COMPLETED');
      stats.successRate = completedPayments.length / stats.totalCount;

      // Group by status
      userPayments.forEach(p => {
        stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
        stats.byType[p.type] = (stats.byType[p.type] || 0) + 1;
        stats.byCurrency[p.currency] = (stats.byCurrency[p.currency] || 0) + p.amount;
      });
    }

    this.logger.info('Payment stats calculated', { 
      userId, 
      timeRange, 
      totalVolume: stats.totalVolume,
      totalCount: stats.totalCount 
    });

    return stats;
  }

  async retryFailedPayment(id: string): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'FAILED') {
      throw new Error('Only failed payments can be retried');
    }

    const retriedPayment: Payment = {
      ...payment,
      status: 'PENDING',
      updatedAt: new Date(),
      metadata: {
        ...payment.metadata,
        retryCount: (payment.metadata.retryCount || 0) + 1,
        lastRetryAt: new Date()
      }
    };

    this.payments.set(id, retriedPayment);
    this.logger.info('Payment retry initiated', { id, retryCount: retriedPayment.metadata.retryCount });

    // Process the retried payment
    return this.process(id);
  }
}