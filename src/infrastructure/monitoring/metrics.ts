// Monitoring and Metrics Implementation
import { logger } from '../../utils/logger';

interface Metrics {
  agentsActive: number;
  transactionsProcessed: number;
  totalVolume: string;
  errors: number;
  uptime: number;
}

interface TransactionMetric {
  protocol: string;
  action: string;
  market?: string;
  side?: string;
  size?: string;
  leverage?: string;
  price?: string;
  margin?: string;
  gasUsed?: string;
  duration?: number;
  pnl?: string;
  amount?: string;
  timestamp: number;
  success: boolean;
}

interface ErrorMetric {
  protocol: string;
  action: string;
  error: Error;
  timestamp: number;
}

interface LatencyMetric {
  operation: string;
  duration: number;
  timestamp: number;
  protocol?: string;
}

interface ValueMetric {
  name: string;
  value: number | string;
  protocol?: string;
  timestamp: number;
}

interface ProtocolMetrics {
  transactions: TransactionMetric[];
  errors: ErrorMetric[];
  latencies: LatencyMetric[];
  values: ValueMetric[];
  successRate: number;
  averageLatency: number;
  totalVolume: string;
  errorCount: number;
}

const metrics: Metrics = {
  agentsActive: 0,
  transactionsProcessed: 0,
  totalVolume: '0',
  errors: 0,
  uptime: Date.now()
};

export class MetricsCollector {
  private transactions: Map<string, TransactionMetric[]> = new Map();
  private errors: Map<string, ErrorMetric[]> = new Map();
  private latencies: Map<string, LatencyMetric[]> = new Map();
  private values: Map<string, ValueMetric[]> = new Map();
  private initialized: boolean = false;
  private readonly MAX_STORED_METRICS = 10000; // Prevent memory leaks
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // Auto-initialize if not done manually
    if (!this.initialized) {
      this.initialize().catch(err => {
        logger.error('Failed to auto-initialize MetricsCollector:', err);
      });
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize storage maps
      this.transactions.clear();
      this.errors.clear();
      this.latencies.clear();
      this.values.clear();

      // Start cleanup timer
      this.startCleanupTimer();

      this.initialized = true;
      logger.info('📊 MetricsCollector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MetricsCollector:', error);
      throw error;
    }
  }

  /**
   * Record a transaction with full details
   */
  recordTransaction(data: Omit<TransactionMetric, 'timestamp' | 'success'>): void {
    const metric: TransactionMetric = {
      ...data,
      timestamp: Date.now(),
      success: true
    };

    this.storeMetric('transactions', data.protocol, metric);
    
    // Update global metrics
    metrics.transactionsProcessed++;
    
    // Update total volume if size or amount provided
    if (data.size || data.amount) {
      const volume = parseFloat(data.size || data.amount || '0');
      if (!isNaN(volume)) {
        const currentVolume = parseFloat(metrics.totalVolume) || 0;
        metrics.totalVolume = (currentVolume + volume).toString();
      }
    }

    logger.debug(`Transaction recorded: ${data.protocol}:${data.action}`);
  }

  /**
   * Record an error with context
   */
  recordError(protocol: string, action: string, error: Error): void {
    const metric: ErrorMetric = {
      protocol,
      action,
      error,
      timestamp: Date.now()
    };

    this.storeMetric('errors', protocol, metric);
    
    // Update global error count
    metrics.errors++;

    logger.warn(`Error recorded: ${protocol}:${action} - ${(error as any).message}`);
  }

  /**
   * Record operation latency
   */
  recordLatency(operation: string, duration: number, protocol?: string): void {
    const metric: LatencyMetric = {
      operation,
      duration,
      protocol,
      timestamp: Date.now()
    };

    const key = protocol || 'global';
    this.storeMetric('latencies', key, metric);

    logger.debug(`Latency recorded: ${operation} - ${duration}ms`);
  }

  /**
   * Record success operation
   */
  recordSuccess(protocol: string, action: string, data?: Record<string, any>): void {
    const metric: TransactionMetric = {
      protocol,
      action,
      timestamp: Date.now(),
      success: true,
      ...data
    };

    this.storeMetric('transactions', protocol, metric);
    metrics.transactionsProcessed++;

    logger.debug(`Success recorded: ${protocol}:${action}`);
  }

  /**
   * Record a custom value metric
   */
  recordValue(name: string, value: number | string, protocol?: string): void {
    const metric: ValueMetric = {
      name,
      value,
      protocol,
      timestamp: Date.now()
    };

    const key = protocol || 'global';
    this.storeMetric('values', key, metric);

    logger.debug(`Value recorded: ${name} = ${value}`);
  }

  /**
   * Get all metrics (legacy method)
   */
  getMetrics(): Metrics {
    return { ...metrics };
  }

  /**
   * Get protocol-specific metrics
   */
  getProtocolMetrics(protocol: string): ProtocolMetrics {
    const transactions = this.transactions.get(protocol) || [];
    const errors = this.errors.get(protocol) || [];
    const latencies = this.latencies.get(protocol) || [];
    const values = this.values.get(protocol) || [];

    // Calculate success rate
    const totalOperations = transactions.length + errors.length;
    const successRate = totalOperations > 0 ? (transactions.length / totalOperations) * 100 : 100;

    // Calculate average latency
    const protocolLatencies = latencies.filter(l => !l.protocol || l.protocol === protocol);
    const averageLatency = protocolLatencies.length > 0
      ? protocolLatencies.reduce((sum, l) => sum + l.duration, 0) / protocolLatencies.length
      : 0;

    // Calculate total volume for protocol
    const totalVolume = transactions
      .reduce((sum, t) => {
        const size = parseFloat(t.size || t.amount || '0');
        return sum + (isNaN(size) ? 0 : size);
      }, 0)
      .toString();

    return {
      transactions,
      errors,
      latencies: protocolLatencies,
      values,
      successRate,
      averageLatency,
      totalVolume,
      errorCount: errors.length
    };
  }

  /**
   * Get metrics for all protocols
   */
  getAllProtocolMetrics(): Record<string, ProtocolMetrics> {
    const protocols = new Set([
      ...this.transactions.keys(),
      ...this.errors.keys(),
      ...this.latencies.keys(),
      ...this.values.keys()
    ]);

    const result: Record<string, ProtocolMetrics> = {};
    
    for (const protocol of protocols) {
      if (protocol !== 'global') {
        result[protocol] = this.getProtocolMetrics(protocol);
      }
    }

    return result;
  }

  /**
   * Get summary statistics
   */
  getSummaryStats(): {
    totalTransactions: number;
    totalErrors: number;
    overallSuccessRate: number;
    activeProtocols: number;
    averageLatency: number;
    totalVolume: string;
    uptime: number;
  } {
    const allTransactions = Array.from(this.transactions.values()).flat();
    const allErrors = Array.from(this.errors.values()).flat();
    const allLatencies = Array.from(this.latencies.values()).flat();
    
    const totalOperations = allTransactions.length + allErrors.length;
    const overallSuccessRate = totalOperations > 0 
      ? (allTransactions.length / totalOperations) * 100 
      : 100;

    const averageLatency = allLatencies.length > 0
      ? allLatencies.reduce((sum, l) => sum + l.duration, 0) / allLatencies.length
      : 0;

    const activeProtocols = new Set([
      ...this.transactions.keys(),
      ...this.errors.keys()
    ]).size;

    return {
      totalTransactions: allTransactions.length,
      totalErrors: allErrors.length,
      overallSuccessRate,
      activeProtocols,
      averageLatency,
      totalVolume: metrics.totalVolume,
      uptime: Math.floor((Date.now() - metrics.uptime) / 1000)
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.transactions.clear();
    this.errors.clear();
    this.latencies.clear();
    this.values.clear();
    
    // Reset global metrics
    metrics.transactionsProcessed = 0;
    metrics.totalVolume = '0';
    metrics.errors = 0;
    metrics.uptime = Date.now();

    logger.info('All metrics cleared');
  }

  /**
   * Clear metrics for specific protocol
   */
  clearProtocolMetrics(protocol: string): void {
    this.transactions.delete(protocol);
    this.errors.delete(protocol);
    this.latencies.delete(protocol);
    this.values.delete(protocol);

    logger.info(`Metrics cleared for protocol: ${protocol}`);
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): {
    global: Metrics;
    protocols: Record<string, ProtocolMetrics>;
    summary: ReturnType<MetricsCollector['getSummaryStats']>;
    exportTime: number;
  } {
    return {
      global: this.getMetrics(),
      protocols: this.getAllProtocolMetrics(),
      summary: this.getSummaryStats(),
      exportTime: Date.now()
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    logger.info('MetricsCollector shutting down');
    this.initialized = false;
  }

  /**
   * Store metric in appropriate map with size limiting
   */
  private storeMetric<T>(
    type: 'transactions' | 'errors' | 'latencies' | 'values',
    key: string,
    metric: T
  ): void {
    let map: Map<string, T[]>;
    
    switch (type) {
      case 'transactions':
        map = this.transactions as Map<string, T[]>;
        break;
      case 'errors':
        map = this.errors as Map<string, T[]>;
        break;
      case 'latencies':
        map = this.latencies as Map<string, T[]>;
        break;
      case 'values':
        map = this.values as Map<string, T[]>;
        break;
    }

    if (!map.has(key)) {
      map.set(key, []);
    }

    const metrics = map.get(key)!;
    metrics.push(metric);

    // Limit stored metrics to prevent memory issues
    if (metrics.length > this.MAX_STORED_METRICS) {
      metrics.splice(0, metrics.length - this.MAX_STORED_METRICS);
    }
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Remove metrics older than 24 hours
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;

    // Clean transactions
    for (const [key, metrics] of this.transactions.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoffTime);
      this.transactions.set(key, filtered);
      cleaned += metrics.length - filtered.length;
    }

    // Clean errors
    for (const [key, metrics] of this.errors.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoffTime);
      this.errors.set(key, filtered);
      cleaned += metrics.length - filtered.length;
    }

    // Clean latencies
    for (const [key, metrics] of this.latencies.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoffTime);
      this.latencies.set(key, filtered);
      cleaned += metrics.length - filtered.length;
    }

    // Clean values
    for (const [key, metrics] of this.values.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoffTime);
      this.values.set(key, filtered);
      cleaned += metrics.length - filtered.length;
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} old metrics`);
    }
  }
}

// Legacy functions for backward compatibility
export async function startMonitoring(): Promise<void> {
  logger.info('📊 Monitoring system initialized');
  
  // Update metrics every minute
  setInterval(() => {
    const uptimeSeconds = Math.floor((Date.now() - metrics.uptime) / 1000);
    logger.debug(`Metrics update - Uptime: ${uptimeSeconds}s, Active Agents: ${metrics.agentsActive}`);
  }, 60000);
}

export function incrementMetric(metric: keyof Omit<Metrics, 'uptime' | 'totalVolume'>): void {
  metrics[metric]++;
}

export function updateVolume(amount: string): void {
  const current = parseFloat(metrics.totalVolume) || 0;
  const add = parseFloat(amount) || 0;
  metrics.totalVolume = (current + add).toString();
}

export function getMetrics(): Metrics {
  return { ...metrics };
}

// Export a default instance for convenience
export const defaultMetricsCollector = new MetricsCollector();