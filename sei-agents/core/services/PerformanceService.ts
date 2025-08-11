import { Logger } from '../../utils/logger';

export interface PerformanceMetrics {
  entityId: string;
  entityType: 'AGENT' | 'PORTFOLIO' | 'STRATEGY';
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
  sortinoRatio: number;
  averageWin: number;
  averageLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  timeRange: string;
  lastUpdated: Date;
}

export interface PerformancePeriod {
  period: string;
  return: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface BenchmarkComparison {
  entityReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  correlation: number;
  trackingError: number;
  informationRatio: number;
  benchmark: string;
}

export interface RiskMetrics {
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
  cvar95: number; // Conditional Value at Risk 95%
  cvar99: number; // Conditional Value at Risk 99%
  skewness: number;
  kurtosis: number;
  downsideDeviation: number;
  upsideDeviation: number;
}

export interface DrawdownAnalysis {
  currentDrawdown: number;
  maxDrawdown: number;
  maxDrawdownDate: Date;
  recoveryTime: number; // days to recover from max drawdown
  drawdownPeriods: DrawdownPeriod[];
}

export interface DrawdownPeriod {
  startDate: Date;
  endDate: Date;
  recoveryDate?: Date;
  depth: number;
  duration: number;
  recoveryTime?: number;
}

export class PerformanceService {
  private logger = new Logger('PerformanceService');
  private metricsCache: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockMetrics: PerformanceMetrics[] = [
      {
        entityId: 'agent-1',
        entityType: 'AGENT',
        totalReturn: 0.125,
        annualizedReturn: 0.156,
        volatility: 0.18,
        sharpeRatio: 1.24,
        maxDrawdown: -0.08,
        winRate: 0.68,
        profitFactor: 1.85,
        calmarRatio: 1.95,
        sortinoRatio: 1.67,
        averageWin: 0.025,
        averageLoss: -0.015,
        totalTrades: 245,
        winningTrades: 167,
        losingTrades: 78,
        largestWin: 0.089,
        largestLoss: -0.042,
        consecutiveWins: 12,
        consecutiveLosses: 4,
        timeRange: '6M',
        lastUpdated: new Date()
      },
      {
        entityId: 'portfolio-1',
        entityType: 'PORTFOLIO',
        totalReturn: 0.098,
        annualizedReturn: 0.123,
        volatility: 0.15,
        sharpeRatio: 1.12,
        maxDrawdown: -0.065,
        winRate: 0.72,
        profitFactor: 2.1,
        calmarRatio: 1.89,
        sortinoRatio: 1.45,
        averageWin: 0.018,
        averageLoss: -0.012,
        totalTrades: 89,
        winningTrades: 64,
        losingTrades: 25,
        largestWin: 0.067,
        largestLoss: -0.038,
        consecutiveWins: 8,
        consecutiveLosses: 3,
        timeRange: '1Y',
        lastUpdated: new Date()
      }
    ];

    mockMetrics.forEach(metrics => {
      this.metricsCache.set(`${metrics.entityId}-${metrics.entityType}`, metrics);
    });

    this.logger.info('Mock performance data initialized', { count: mockMetrics.length });
  }

  async verifyAccess(entityId: string, entityType: string, userId: string, userRole: string): Promise<void> {
    // Mock access verification - in production, check database
    if (userRole === 'admin') {
      return; // Admin can access everything
    }

    // Mock ownership check
    const mockOwnership = {
      'agent-1': 'user-123',
      'agent-2': 'user-123',
      'portfolio-1': 'user-123'
    };

    if (mockOwnership[entityId] !== userId) {
      throw new Error('Access denied: You do not own this entity');
    }

    this.logger.info('Access verified', { entityId, entityType, userId });
  }

  async getMetrics(entityId: string, entityType: string): Promise<PerformanceMetrics> {
    const key = `${entityId}-${entityType}`;
    let metrics = this.metricsCache.get(key);

    if (!metrics) {
      // Generate mock metrics if not found
      metrics = await this.generateMockMetrics(entityId, entityType);
      this.metricsCache.set(key, metrics);
    }

    this.logger.info('Performance metrics retrieved', { entityId, entityType });
    return metrics;
  }

  private async generateMockMetrics(entityId: string, entityType: string): Promise<PerformanceMetrics> {
    const baseMetrics: PerformanceMetrics = {
      entityId,
      entityType: entityType as any,
      totalReturn: Math.random() * 0.3 - 0.1, // -10% to 20%
      annualizedReturn: 0,
      volatility: Math.random() * 0.3 + 0.1, // 10% to 40%
      sharpeRatio: 0,
      maxDrawdown: -(Math.random() * 0.2 + 0.02), // -2% to -22%
      winRate: Math.random() * 0.4 + 0.5, // 50% to 90%
      profitFactor: Math.random() * 2 + 0.5, // 0.5 to 2.5
      calmarRatio: 0,
      sortinoRatio: 0,
      averageWin: Math.random() * 0.05 + 0.01,
      averageLoss: -(Math.random() * 0.03 + 0.005),
      totalTrades: Math.floor(Math.random() * 500 + 50),
      winningTrades: 0,
      losingTrades: 0,
      largestWin: Math.random() * 0.15 + 0.02,
      largestLoss: -(Math.random() * 0.1 + 0.01),
      consecutiveWins: Math.floor(Math.random() * 15 + 1),
      consecutiveLosses: Math.floor(Math.random() * 8 + 1),
      timeRange: '6M',
      lastUpdated: new Date()
    };

    // Calculate derived metrics
    baseMetrics.winningTrades = Math.floor(baseMetrics.totalTrades * baseMetrics.winRate);
    baseMetrics.losingTrades = baseMetrics.totalTrades - baseMetrics.winningTrades;
    baseMetrics.annualizedReturn = baseMetrics.totalReturn * 2; // Assume 6M period
    baseMetrics.sharpeRatio = baseMetrics.annualizedReturn / baseMetrics.volatility;
    baseMetrics.calmarRatio = baseMetrics.annualizedReturn / Math.abs(baseMetrics.maxDrawdown);
    baseMetrics.sortinoRatio = baseMetrics.sharpeRatio * 1.2; // Approximation

    return baseMetrics;
  }

  async getPerformancePeriods(entityId: string, entityType: string): Promise<PerformancePeriod[]> {
    this.logger.info('Retrieving performance periods', { entityId, entityType });

    const periods: PerformancePeriod[] = [
      {
        period: '1D',
        return: (Math.random() - 0.5) * 0.1,
        volatility: 0.25,
        sharpeRatio: 0.8,
        maxDrawdown: -0.02
      },
      {
        period: '1W',
        return: (Math.random() - 0.5) * 0.15,
        volatility: 0.22,
        sharpeRatio: 1.1,
        maxDrawdown: -0.035
      },
      {
        period: '1M',
        return: (Math.random() - 0.5) * 0.25,
        volatility: 0.20,
        sharpeRatio: 1.3,
        maxDrawdown: -0.055
      },
      {
        period: '3M',
        return: (Math.random() - 0.5) * 0.35,
        volatility: 0.18,
        sharpeRatio: 1.4,
        maxDrawdown: -0.08
      },
      {
        period: '6M',
        return: (Math.random() - 0.5) * 0.5,
        volatility: 0.17,
        sharpeRatio: 1.5,
        maxDrawdown: -0.12
      },
      {
        period: '1Y',
        return: (Math.random() - 0.5) * 0.8,
        volatility: 0.16,
        sharpeRatio: 1.6,
        maxDrawdown: -0.18
      }
    ];

    return periods;
  }

  async getBenchmarkComparison(
    entityId: string, 
    entityType: string, 
    benchmark: string = 'SPY'
  ): Promise<BenchmarkComparison> {
    this.logger.info('Generating benchmark comparison', { entityId, entityType, benchmark });

    const entityReturn = (Math.random() - 0.4) * 0.6; // Bias toward positive
    const benchmarkReturn = (Math.random() - 0.3) * 0.4;

    const comparison: BenchmarkComparison = {
      entityReturn,
      benchmarkReturn,
      alpha: entityReturn - benchmarkReturn,
      beta: 0.8 + Math.random() * 0.6, // 0.8 to 1.4
      correlation: 0.4 + Math.random() * 0.5, // 0.4 to 0.9
      trackingError: Math.random() * 0.1 + 0.02, // 2% to 12%
      informationRatio: 0,
      benchmark
    };

    comparison.informationRatio = comparison.alpha / comparison.trackingError;

    return comparison;
  }

  async getRiskMetrics(entityId: string, entityType: string): Promise<RiskMetrics> {
    this.logger.info('Calculating risk metrics', { entityId, entityType });

    const riskMetrics: RiskMetrics = {
      var95: -(Math.random() * 0.08 + 0.02), // -2% to -10%
      var99: -(Math.random() * 0.15 + 0.05), // -5% to -20%
      cvar95: -(Math.random() * 0.12 + 0.03), // -3% to -15%
      cvar99: -(Math.random() * 0.20 + 0.08), // -8% to -28%
      skewness: (Math.random() - 0.5) * 2, // -1 to 1
      kurtosis: Math.random() * 5 + 1, // 1 to 6
      downsideDeviation: Math.random() * 0.15 + 0.05, // 5% to 20%
      upsideDeviation: Math.random() * 0.20 + 0.08 // 8% to 28%
    };

    return riskMetrics;
  }

  async getDrawdownAnalysis(entityId: string, entityType: string): Promise<DrawdownAnalysis> {
    this.logger.info('Analyzing drawdowns', { entityId, entityType });

    const now = new Date();
    const drawdownPeriods: DrawdownPeriod[] = [];

    // Generate mock drawdown periods
    for (let i = 0; i < 3; i++) {
      const startDate = new Date();
      startDate.setDate(now.getDate() - Math.random() * 180);
      
      const duration = Math.floor(Math.random() * 30 + 5);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + duration);
      
      const recoveryTime = Math.floor(Math.random() * 20 + 10);
      const recoveryDate = new Date(endDate);
      recoveryDate.setDate(endDate.getDate() + recoveryTime);

      drawdownPeriods.push({
        startDate,
        endDate,
        recoveryDate,
        depth: -(Math.random() * 0.15 + 0.02),
        duration,
        recoveryTime
      });
    }

    const maxDrawdownPeriod = drawdownPeriods.reduce((max, period) => 
      Math.abs(period.depth) > Math.abs(max.depth) ? period : max
    );

    const analysis: DrawdownAnalysis = {
      currentDrawdown: Math.random() < 0.3 ? -(Math.random() * 0.05) : 0,
      maxDrawdown: maxDrawdownPeriod.depth,
      maxDrawdownDate: maxDrawdownPeriod.startDate,
      recoveryTime: maxDrawdownPeriod.recoveryTime || 0,
      drawdownPeriods
    };

    return analysis;
  }

  async updateMetrics(entityId: string, entityType: string, newData: any): Promise<PerformanceMetrics> {
    const key = `${entityId}-${entityType}`;
    let metrics = this.metricsCache.get(key);

    if (!metrics) {
      metrics = await this.generateMockMetrics(entityId, entityType);
    }

    // Update metrics with new data
    const updatedMetrics: PerformanceMetrics = {
      ...metrics,
      ...newData,
      lastUpdated: new Date()
    };

    this.metricsCache.set(key, updatedMetrics);
    this.logger.info('Performance metrics updated', { entityId, entityType });

    return updatedMetrics;
  }

  async getTopPerformers(entityType: string, metric: string = 'totalReturn', limit: number = 10): Promise<PerformanceMetrics[]> {
    const allMetrics = Array.from(this.metricsCache.values())
      .filter(m => m.entityType === entityType);

    const sorted = allMetrics.sort((a, b) => {
      const aValue = a[metric as keyof PerformanceMetrics] as number;
      const bValue = b[metric as keyof PerformanceMetrics] as number;
      return bValue - aValue;
    });

    this.logger.info('Top performers retrieved', { entityType, metric, limit, total: sorted.length });
    return sorted.slice(0, limit);
  }

  async calculateCorrelation(entityId1: string, entityId2: string): Promise<number> {
    // Mock correlation calculation
    const correlation = (Math.random() - 0.5) * 2; // -1 to 1
    
    this.logger.info('Correlation calculated', { entityId1, entityId2, correlation });
    return correlation;
  }
}