import { Logger } from '../../utils/logger';

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  userId: string;
  currency: string;
  totalValue: number;
  cashBalance: number;
  investedAmount: number;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  riskLevel: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'VERY_AGGRESSIVE';
  strategy?: string;
  allocations: Allocation[];
  performance?: PortfolioPerformance;
  settings: PortfolioSettings;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Allocation {
  id: string;
  portfolioId: string;
  assetId: string;
  symbol: string;
  assetType: 'CRYPTO' | 'STOCK' | 'BOND' | 'COMMODITY' | 'REAL_ESTATE' | 'CASH';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  value: number;
  weight: number; // Percentage of total portfolio
  targetWeight?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  lastUpdated: Date;
}

export interface PortfolioSettings {
  autoRebalance: boolean;
  rebalanceThreshold: number; // Percentage deviation to trigger rebalance
  rebalanceFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  allowedAssets: string[];
  maxAllocationPerAsset: number;
  stopLossEnabled: boolean;
  stopLossPercentage?: number;
  takeProfitEnabled: boolean;
  takeProfitPercentage?: number;
  dividendReinvestment: boolean;
  taxOptimization: boolean;
}

export interface PortfolioPerformance {
  totalReturn: number;
  totalReturnPercent: number;
  dayReturn: number;
  dayReturnPercent: number;
  weekReturn: number;
  weekReturnPercent: number;
  monthReturn: number;
  monthReturnPercent: number;
  quarterReturn: number;
  quarterReturnPercent: number;
  yearReturn: number;
  yearReturnPercent: number;
  allTimeReturn: number;
  allTimeReturnPercent: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  bestDay: number;
  worstDay: number;
  timeRange: string;
  lastUpdated: Date;
}

export interface PortfolioHistory {
  portfolioId: string;
  dataPoints: PortfolioHistoryPoint[];
  timeRange: string;
}

export interface PortfolioHistoryPoint {
  date: Date;
  totalValue: number;
  cashBalance: number;
  investedAmount: number;
  dayReturn: number;
  dayReturnPercent: number;
  allocations: { [symbol: string]: number };
}

export interface RebalanceStrategy {
  name: string;
  description: string;
  type: 'EQUAL_WEIGHT' | 'TARGET_ALLOCATION' | 'RISK_PARITY' | 'MOMENTUM' | 'MEAN_REVERSION';
  parameters: Record<string, any>;
}

export interface RebalanceResult {
  portfolioId: string;
  strategy: string;
  trades: RebalanceTrade[];
  expectedCost: number;
  projectedImprovement: number;
  riskImpact: number;
  executedAt: Date;
}

export interface RebalanceTrade {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  currentPrice: number;
  estimatedCost: number;
  reason: string;
}

export class PortfolioService {
  private logger = new Logger('PortfolioService');
  private portfolios: Map<string, Portfolio> = new Map();
  private history: Map<string, PortfolioHistory> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockPortfolios: Portfolio[] = [
      {
        id: 'portfolio-1',
        name: 'Conservative DeFi Portfolio',
        description: 'Low-risk DeFi investments with focus on stable returns',
        userId: 'user-123',
        currency: 'USD',
        totalValue: 125000,
        cashBalance: 25000,
        investedAmount: 100000,
        status: 'ACTIVE',
        riskLevel: 'CONSERVATIVE',
        strategy: 'Yield Farming with Stablecoins',
        allocations: [
          {
            id: 'alloc-1',
            portfolioId: 'portfolio-1',
            assetId: 'sei-1',
            symbol: 'SEI',
            assetType: 'CRYPTO',
            quantity: 84615.38,
            averagePrice: 0.45,
            currentPrice: 0.52,
            value: 44000,
            weight: 35.2,
            targetWeight: 35.0,
            unrealizedPnL: 6538.46,
            unrealizedPnLPercent: 17.43,
            dayChange: 1320,
            dayChangePercent: 3.1,
            lastUpdated: new Date()
          },
          {
            id: 'alloc-2',
            portfolioId: 'portfolio-1',
            assetId: 'usdc-1',
            symbol: 'USDC',
            assetType: 'CRYPTO',
            quantity: 30000,
            averagePrice: 1.00,
            currentPrice: 1.00,
            value: 30000,
            weight: 24.0,
            targetWeight: 25.0,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            dayChange: 30,
            dayChangePercent: 0.1,
            lastUpdated: new Date()
          },
          {
            id: 'alloc-3',
            portfolioId: 'portfolio-1',
            assetId: 'eth-1',
            symbol: 'ETH',
            assetType: 'CRYPTO',
            quantity: 10.2,
            averagePrice: 2300,
            currentPrice: 2456.78,
            value: 25059.16,
            weight: 20.05,
            targetWeight: 20.0,
            unrealizedPnL: 1599.16,
            unrealizedPnLPercent: 6.82,
            dayChange: -461.22,
            dayChangePercent: -1.81,
            lastUpdated: new Date()
          },
          {
            id: 'alloc-4',
            portfolioId: 'portfolio-1',
            assetId: 'sol-1',
            symbol: 'SOL',
            assetType: 'CRYPTO',
            quantity: 203.05,
            averagePrice: 89.50,
            currentPrice: 98.45,
            value: 19990.37,
            weight: 15.99,
            targetWeight: 15.0,
            unrealizedPnL: 1817.95,
            unrealizedPnLPercent: 10.00,
            dayChange: 878.20,
            dayChangePercent: 4.59,
            lastUpdated: new Date()
          }
        ],
        settings: {
          autoRebalance: true,
          rebalanceThreshold: 5.0,
          rebalanceFrequency: 'MONTHLY',
          allowedAssets: ['SEI', 'USDC', 'ETH', 'SOL', 'ATOM'],
          maxAllocationPerAsset: 40.0,
          stopLossEnabled: true,
          stopLossPercentage: 15.0,
          takeProfitEnabled: false,
          dividendReinvestment: true,
          taxOptimization: true
        },
        metadata: {
          createdBy: 'web_app',
          lastRebalance: new Date(Date.now() - 2592000000), // 30 days ago
          riskScore: 3.5,
          diversificationScore: 8.2
        },
        createdAt: new Date(Date.now() - 7776000000), // 90 days ago
        updatedAt: new Date()
      }
    ];

    mockPortfolios.forEach(portfolio => {
      portfolio.performance = this.calculatePerformance(portfolio);
      this.portfolios.set(portfolio.id, portfolio);
      this.generateHistoryData(portfolio.id);
    });

    this.logger.info('Mock portfolio data initialized', { count: mockPortfolios.length });
  }

  private calculatePerformance(portfolio: Portfolio): PortfolioPerformance {
    const performance: PortfolioPerformance = {
      totalReturn: portfolio.totalValue - portfolio.investedAmount,
      totalReturnPercent: ((portfolio.totalValue - portfolio.investedAmount) / portfolio.investedAmount) * 100,
      dayReturn: 0,
      dayReturnPercent: 0,
      weekReturn: 0,
      weekReturnPercent: 0,
      monthReturn: 0,
      monthReturnPercent: 0,
      quarterReturn: 0,
      quarterReturnPercent: 0,
      yearReturn: 0,
      yearReturnPercent: 0,
      allTimeReturn: 0,
      allTimeReturnPercent: 0,
      volatility: 15.2,
      sharpeRatio: 1.34,
      maxDrawdown: -8.5,
      winRate: 0.68,
      bestDay: 3.2,
      worstDay: -2.8,
      timeRange: 'ALL',
      lastUpdated: new Date()
    };

    // Calculate day return from allocations
    performance.dayReturn = portfolio.allocations.reduce((sum, alloc) => sum + alloc.dayChange, 0);
    performance.dayReturnPercent = (performance.dayReturn / portfolio.totalValue) * 100;

    // Mock other time period returns
    performance.weekReturn = performance.dayReturn * 3.2;
    performance.weekReturnPercent = performance.dayReturnPercent * 3.2;
    performance.monthReturn = performance.totalReturn * 0.6;
    performance.monthReturnPercent = performance.totalReturnPercent * 0.6;
    performance.quarterReturn = performance.totalReturn * 0.8;
    performance.quarterReturnPercent = performance.totalReturnPercent * 0.8;
    performance.yearReturn = performance.totalReturn * 1.2;
    performance.yearReturnPercent = performance.totalReturnPercent * 1.2;
    performance.allTimeReturn = performance.totalReturn;
    performance.allTimeReturnPercent = performance.totalReturnPercent;

    return performance;
  }

  private generateHistoryData(portfolioId: string): void {
    const dataPoints: PortfolioHistoryPoint[] = [];
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) return;

    const startValue = portfolio.investedAmount;
    const currentValue = portfolio.totalValue;

    // Generate 90 days of history
    for (let i = 89; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Simulate gradual value growth with some volatility
      const progress = (89 - i) / 89;
      const baseValue = startValue + (currentValue - startValue) * progress;
      const volatility = 0.02; // 2% daily volatility
      const randomChange = (Math.random() - 0.5) * volatility;
      const dayValue = baseValue * (1 + randomChange);

      const dayReturn = i === 89 ? 0 : dayValue - dataPoints[dataPoints.length - 1]?.totalValue || 0;
      const dayReturnPercent = i === 89 ? 0 : (dayReturn / (dayValue - dayReturn)) * 100;

      // Generate allocation data
      const allocations: { [symbol: string]: number } = {};
      portfolio.allocations.forEach(alloc => {
        allocations[alloc.symbol] = (alloc.weight / 100) * dayValue;
      });

      dataPoints.push({
        date,
        totalValue: Math.max(dayValue, startValue * 0.7), // Ensure minimum value
        cashBalance: portfolio.cashBalance,
        investedAmount: portfolio.investedAmount,
        dayReturn,
        dayReturnPercent,
        allocations
      });
    }

    this.history.set(portfolioId, {
      portfolioId,
      dataPoints,
      timeRange: '90D'
    });
  }

  async findByUserId(userId: string): Promise<Portfolio[]> {
    const userPortfolios = Array.from(this.portfolios.values())
      .filter(portfolio => portfolio.userId === userId);

    // Update performance data
    userPortfolios.forEach(portfolio => {
      portfolio.performance = this.calculatePerformance(portfolio);
      portfolio.updatedAt = new Date();
    });

    this.logger.info('User portfolios retrieved', { userId, count: userPortfolios.length });
    return userPortfolios;
  }

  async findById(id: string): Promise<Portfolio | null> {
    const portfolio = this.portfolios.get(id);
    
    if (portfolio) {
      // Update performance data
      portfolio.performance = this.calculatePerformance(portfolio);
      portfolio.updatedAt = new Date();
      this.portfolios.set(id, portfolio);
      
      this.logger.info('Portfolio found', { id, name: portfolio.name, value: portfolio.totalValue });
    } else {
      this.logger.warn('Portfolio not found', { id });
    }
    
    return portfolio || null;
  }

  async create(portfolioData: Omit<Portfolio, 'id' | 'allocations' | 'performance' | 'createdAt' | 'updatedAt'>): Promise<Portfolio> {
    const portfolio: Portfolio = {
      ...portfolioData,
      id: `portfolio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      allocations: [],
      performance: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    portfolio.performance = this.calculatePerformance(portfolio);
    this.portfolios.set(portfolio.id, portfolio);
    this.generateHistoryData(portfolio.id);

    this.logger.info('Portfolio created', { 
      id: portfolio.id, 
      name: portfolio.name, 
      userId: portfolio.userId 
    });

    return portfolio;
  }

  async update(id: string, updates: Partial<Portfolio>): Promise<Portfolio> {
    const existingPortfolio = this.portfolios.get(id);
    if (!existingPortfolio) {
      throw new Error('Portfolio not found');
    }

    const updatedPortfolio: Portfolio = {
      ...existingPortfolio,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    // Recalculate performance if allocations changed
    if (updates.allocations || updates.totalValue || updates.investedAmount) {
      updatedPortfolio.performance = this.calculatePerformance(updatedPortfolio);
    }

    this.portfolios.set(id, updatedPortfolio);
    this.logger.info('Portfolio updated', { id, updates: Object.keys(updates) });

    return updatedPortfolio;
  }

  async delete(id: string): Promise<void> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    if (portfolio.status === 'ACTIVE' && portfolio.totalValue > 0) {
      throw new Error('Cannot delete active portfolio with assets. Please liquidate first.');
    }

    this.portfolios.delete(id);
    this.history.delete(id);
    this.logger.info('Portfolio deleted', { id, name: portfolio.name });
  }

  async calculateValue(id: string, currency?: string): Promise<number> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    let totalValue = portfolio.totalValue;

    // Mock currency conversion
    if (currency && currency !== portfolio.currency) {
      const conversionRate = this.getMockConversionRate(portfolio.currency, currency);
      totalValue = totalValue * conversionRate;
    }

    this.logger.info('Portfolio value calculated', { 
      id, 
      value: totalValue, 
      currency: currency || portfolio.currency 
    });

    return totalValue;
  }

  private getMockConversionRate(from: string, to: string): number {
    // Mock conversion rates
    const rates: { [key: string]: { [key: string]: number } } = {
      'USD': { 'EUR': 0.85, 'GBP': 0.73, 'JPY': 110 },
      'EUR': { 'USD': 1.18, 'GBP': 0.86, 'JPY': 129 },
      'GBP': { 'USD': 1.37, 'EUR': 1.16, 'JPY': 150 }
    };

    return rates[from]?.[to] || 1;
  }

  async getHistory(id: string, timeRange: string = '90D'): Promise<PortfolioHistory | null> {
    let history = this.history.get(id);
    
    if (!history) {
      this.generateHistoryData(id);
      history = this.history.get(id);
    }

    if (history) {
      // Filter data based on time range
      const now = new Date();
      let cutoffDate: Date;

      switch (timeRange) {
        case '1D':
          cutoffDate = new Date(now.getTime() - 86400000);
          break;
        case '7D':
          cutoffDate = new Date(now.getTime() - 604800000);
          break;
        case '30D':
          cutoffDate = new Date(now.getTime() - 2592000000);
          break;
        case '90D':
          cutoffDate = new Date(now.getTime() - 7776000000);
          break;
        case '1Y':
          cutoffDate = new Date(now.getTime() - 31536000000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      const filteredHistory: PortfolioHistory = {
        ...history,
        dataPoints: history.dataPoints.filter(point => point.date >= cutoffDate),
        timeRange
      };

      this.logger.info('Portfolio history retrieved', { 
        id, 
        timeRange, 
        dataPoints: filteredHistory.dataPoints.length 
      });

      return filteredHistory;
    }

    this.logger.warn('Portfolio history not found', { id });
    return null;
  }

  async rebalance(id: string, strategy: string): Promise<Portfolio> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    this.logger.info('Starting portfolio rebalance', { id, strategy });

    // Mock rebalancing logic
    const rebalancedAllocations = [...portfolio.allocations];
    
    switch (strategy) {
      case 'EQUAL_WEIGHT':
        this.applyEqualWeightRebalance(rebalancedAllocations);
        break;
      case 'TARGET_ALLOCATION':
        this.applyTargetAllocationRebalance(rebalancedAllocations);
        break;
      case 'RISK_PARITY':
        this.applyRiskParityRebalance(rebalancedAllocations);
        break;
      default:
        this.applyTargetAllocationRebalance(rebalancedAllocations);
    }

    const rebalancedPortfolio: Portfolio = {
      ...portfolio,
      allocations: rebalancedAllocations,
      updatedAt: new Date(),
      metadata: {
        ...portfolio.metadata,
        lastRebalance: new Date(),
        lastRebalanceStrategy: strategy
      }
    };

    rebalancedPortfolio.performance = this.calculatePerformance(rebalancedPortfolio);
    this.portfolios.set(id, rebalancedPortfolio);

    this.logger.info('Portfolio rebalanced', { id, strategy });
    return rebalancedPortfolio;
  }

  private applyEqualWeightRebalance(allocations: Allocation[]): void {
    const equalWeight = 100 / allocations.length;
    allocations.forEach(allocation => {
      allocation.targetWeight = equalWeight;
      allocation.weight = equalWeight;
      allocation.lastUpdated = new Date();
    });
  }

  private applyTargetAllocationRebalance(allocations: Allocation[]): void {
    allocations.forEach(allocation => {
      if (allocation.targetWeight) {
        const deviation = allocation.weight - allocation.targetWeight;
        // Move 50% towards target
        allocation.weight = allocation.weight - (deviation * 0.5);
        allocation.lastUpdated = new Date();
      }
    });
  }

  private applyRiskParityRebalance(allocations: Allocation[]): void {
    // Mock risk parity - inverse volatility weighting
    const volatilities = {
      'SEI': 0.75,
      'ETH': 0.65,
      'USDC': 0.05,
      'SOL': 0.80,
      'ATOM': 0.70
    };

    const inverseVols = allocations.map(alloc => 1 / (volatilities[alloc.symbol] || 0.5));
    const totalInverseVol = inverseVols.reduce((sum, iv) => sum + iv, 0);

    allocations.forEach((allocation, index) => {
      allocation.weight = (inverseVols[index] / totalInverseVol) * 100;
      allocation.lastUpdated = new Date();
    });
  }

  async getPerformance(id: string): Promise<PortfolioPerformance | null> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      return null;
    }

    const performance = this.calculatePerformance(portfolio);
    this.logger.info('Portfolio performance calculated', { 
      id, 
      totalReturn: performance.totalReturn,
      totalReturnPercent: performance.totalReturnPercent 
    });

    return performance;
  }

  async getAllocations(id: string): Promise<Allocation[]> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    // Update current prices and values (mock)
    const updatedAllocations = portfolio.allocations.map(allocation => ({
      ...allocation,
      currentPrice: allocation.currentPrice * (1 + (Math.random() - 0.5) * 0.01), // ±0.5% price movement
      lastUpdated: new Date()
    }));

    // Recalculate values and weights
    const totalValue = updatedAllocations.reduce((sum, alloc) => {
      alloc.value = alloc.quantity * alloc.currentPrice;
      return sum + alloc.value;
    }, 0);

    updatedAllocations.forEach(allocation => {
      allocation.weight = (allocation.value / totalValue) * 100;
      allocation.unrealizedPnL = allocation.value - (allocation.quantity * allocation.averagePrice);
      allocation.unrealizedPnLPercent = (allocation.unrealizedPnL / (allocation.quantity * allocation.averagePrice)) * 100;
    });

    // Update portfolio
    const updatedPortfolio = { ...portfolio, allocations: updatedAllocations, totalValue };
    this.portfolios.set(id, updatedPortfolio);

    this.logger.info('Portfolio allocations retrieved', { id, count: updatedAllocations.length });
    return updatedAllocations;
  }

  async addAllocation(portfolioId: string, symbol: string, quantity: number, price: number): Promise<Allocation> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const allocation: Allocation = {
      id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      portfolioId,
      assetId: `${symbol.toLowerCase()}-1`,
      symbol,
      assetType: 'CRYPTO',
      quantity,
      averagePrice: price,
      currentPrice: price,
      value: quantity * price,
      weight: 0, // Will be calculated
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      dayChange: 0,
      dayChangePercent: 0,
      lastUpdated: new Date()
    };

    portfolio.allocations.push(allocation);
    portfolio.totalValue += allocation.value;
    portfolio.investedAmount += allocation.value;

    // Recalculate weights
    portfolio.allocations.forEach(alloc => {
      alloc.weight = (alloc.value / portfolio.totalValue) * 100;
    });

    portfolio.updatedAt = new Date();
    this.portfolios.set(portfolioId, portfolio);

    this.logger.info('Allocation added to portfolio', { 
      portfolioId, 
      symbol, 
      quantity, 
      value: allocation.value 
    });

    return allocation;
  }

  async removeAllocation(portfolioId: string, allocationId: string): Promise<void> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const allocationIndex = portfolio.allocations.findIndex(alloc => alloc.id === allocationId);
    if (allocationIndex === -1) {
      throw new Error('Allocation not found');
    }

    const allocation = portfolio.allocations[allocationIndex];
    portfolio.totalValue -= allocation.value;
    portfolio.cashBalance += allocation.value;
    portfolio.allocations.splice(allocationIndex, 1);

    // Recalculate weights
    if (portfolio.totalValue > 0) {
      portfolio.allocations.forEach(alloc => {
        alloc.weight = (alloc.value / portfolio.totalValue) * 100;
      });
    }

    portfolio.updatedAt = new Date();
    this.portfolios.set(portfolioId, portfolio);

    this.logger.info('Allocation removed from portfolio', { 
      portfolioId, 
      allocationId, 
      symbol: allocation.symbol 
    });
  }
}