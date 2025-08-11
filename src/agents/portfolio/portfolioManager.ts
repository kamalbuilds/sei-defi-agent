import { EventEmitter } from 'events';
// BigNumber is no longer needed in ethers v6 - use native bigint instead
import { 
  Portfolio, 
  Asset, 
  Strategy, 
  StrategyType,
  RiskProfile,
  AgentMessage,
  MessageType 
} from '../../types';
import { logger } from '../../utils/logger';
import YeiFinanceIntegration from '../../protocols/yeiFinance';
import DragonSwapIntegration from '../../protocols/dragonSwap';
import SymphonyIntegration from '../../protocols/symphony';

export class PortfolioManagerAgent extends EventEmitter {
  private portfolios: Map<string, Portfolio>;
  private strategies: Map<string, Strategy>;
  private yeiFinance: YeiFinanceIntegration;
  private dragonSwap: DragonSwapIntegration;
  private symphony: SymphonyIntegration;
  private isActive: boolean;

  constructor(private agentId: string) {
    super();
    this.portfolios = new Map();
    this.strategies = new Map();
    this.yeiFinance = new YeiFinanceIntegration({ 
      rpcUrl: 'https://evm-rpc.sei-apis.com',
      privateKey: 'dummy-key',
      contracts: { lendingPool: '', priceOracle: '' }
    });
    this.dragonSwap = new DragonSwapIntegration({ 
      rpcUrl: 'https://evm-rpc.sei-apis.com',
      privateKey: 'dummy-key',
      contracts: { router: '', factory: '' }
    });
    this.symphony = new SymphonyIntegration({ 
      rpcUrl: 'https://evm-rpc.sei-apis.com',
      privateKey: 'dummy-key',
      contracts: { router: '' }
    });
    this.isActive = false;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadStrategies();
    this.startPortfolioMonitoring();
    logger.info(`Portfolio Manager Agent ${this.agentId} initialized`);
  }

  private async loadStrategies(): Promise<void> {
    const defaultStrategies: Strategy[] = [
      {
        id: 'yield_max',
        name: 'Maximum Yield Strategy',
        type: StrategyType.YIELD_OPTIMIZATION,
        params: {
          minReturn: 15,
          maxRisk: 30,
          timeHorizon: 30,
          rebalanceFrequency: 7,
          protocols: ['YEI', 'DragonSwap', 'Silo']
        },
        riskProfile: {
          maxLeverage: 2,
          stopLoss: 15,
          takeProfit: 50,
          maxPositionSize: BigInt('100000000000000000000000'),
          maxDrawdown: 20
        },
        active: true
      },
      {
        id: 'delta_neutral',
        name: 'Delta Neutral Farming',
        type: StrategyType.DELTA_NEUTRAL,
        params: {
          minReturn: 10,
          maxRisk: 10,
          timeHorizon: 90,
          rebalanceFrequency: 1,
          protocols: ['YEI', 'Citrex']
        },
        riskProfile: {
          maxLeverage: 1,
          stopLoss: 5,
          takeProfit: 20,
          maxPositionSize: BigInt('50000000000000000000000'),
          maxDrawdown: 10
        },
        active: true
      }
    ];

    defaultStrategies.forEach(strategy => {
      this.strategies.set(strategy.id, strategy);
    });
  }

  async createPortfolio(owner: string, initialAssets: Asset[]): Promise<string> {
    const portfolioId = `portfolio_${Date.now()}`;
    
    const portfolio: Portfolio = {
      id: portfolioId,
      owner,
      assets: initialAssets,
      totalValue: await this.calculateTotalValue(initialAssets),
      performance: {
        totalProfit: BigInt(0),
        totalLoss: BigInt(0),
        winRate: 0,
        avgReturnPerTrade: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalTransactions: 0
      },
      strategies: ['yield_max'],
      riskProfile: {
        maxLeverage: 2,
        stopLoss: 15,
        takeProfit: 50,
        maxPositionSize: BigInt('100000000000000000000000'),
        maxDrawdown: 20
      }
    };

    this.portfolios.set(portfolioId, portfolio);
    
    await this.optimizePortfolio(portfolioId);
    
    logger.info(`Portfolio ${portfolioId} created for ${owner}`);
    return portfolioId;
  }

  async optimizePortfolio(portfolioId: string): Promise<void> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) return;

    const activeStrategies = portfolio.strategies
      .map(id => this.strategies.get(id))
      .filter(s => s && s.active) as Strategy[];

    for (const strategy of activeStrategies) {
      await this.executeStrategy(portfolio, strategy);
    }

    await this.rebalancePortfolio(portfolio);
  }

  private async executeStrategy(portfolio: Portfolio, strategy: Strategy): Promise<void> {
    logger.info(`Executing ${strategy.name} for portfolio ${portfolio.id}`);

    switch (strategy.type) {
      case StrategyType.YIELD_OPTIMIZATION:
        await this.executeYieldOptimization(portfolio, strategy);
        break;
      case StrategyType.DELTA_NEUTRAL:
        await this.executeDeltaNeutral(portfolio, strategy);
        break;
      case StrategyType.ARBITRAGE:
        await this.requestArbitrageExecution(portfolio, strategy);
        break;
      default:
        logger.warn(`Unknown strategy type: ${strategy.type}`);
    }
  }

  private async executeYieldOptimization(
    portfolio: Portfolio, 
    strategy: Strategy
  ): Promise<void> {
    const opportunities = await this.findYieldOpportunities(portfolio.assets);
    
    for (const opp of opportunities) {
      if (opp.apy > strategy.params.minReturn) {
        await this.allocateToYield(portfolio, opp);
      }
    }
  }

  private async findYieldOpportunities(assets: Asset[]): Promise<any[]> {
    const opportunities = [];

    // Check YEI Finance lending rates
    const yeiRates = await this.yeiFinance.getLendingRates();
    for (const asset of assets) {
      const rate = yeiRates[asset.symbol];
      if (rate) {
        opportunities.push({
          protocol: 'YEI',
          asset: asset.symbol,
          apy: rate.supplyAPY,
          type: 'LENDING'
        });
      }
    }

    // Check DragonSwap LP opportunities
    const dragonPools = await this.dragonSwap.getTopPools();
    for (const pool of dragonPools) {
      opportunities.push({
        protocol: 'DragonSwap',
        asset: `${pool.token0}/${pool.token1}`,
        apy: pool.apy,
        type: 'LP'
      });
    }

    return opportunities.sort((a, b) => b.apy - a.apy);
  }

  private async allocateToYield(portfolio: Portfolio, opportunity: any): Promise<void> {
    const allocationAmount = this.calculateOptimalAllocation(
      portfolio,
      opportunity
    );

    if (allocationAmount > BigInt(0)) {
      logger.info(`Allocating to ${opportunity.protocol} - ${opportunity.asset}`);
      
      // Execute allocation based on opportunity type
      if (opportunity.type === 'LENDING') {
        await this.yeiFinance.deposit(opportunity.asset, allocationAmount);
      } else if (opportunity.type === 'LP') {
        await this.dragonSwap.addLiquidity(
          opportunity.asset.split('/')[0],
          opportunity.asset.split('/')[1],
          allocationAmount
        );
      }

      this.updatePortfolioAssets(portfolio, opportunity, allocationAmount);
    }
  }

  private calculateOptimalAllocation(
    portfolio: Portfolio, 
    opportunity: any
  ): bigint {
    const riskAdjustedSize = portfolio.totalValue * BigInt(20) / BigInt(100); // Max 20% per position

    const availableAsset = portfolio.assets.find(
      a => a.symbol === opportunity.asset.split('/')[0]
    );

    if (!availableAsset) return BigInt(0);

    return availableAsset.amount > riskAdjustedSize
      ? riskAdjustedSize
      : availableAsset.amount;
  }

  private async executeDeltaNeutral(
    portfolio: Portfolio,
    strategy: Strategy
  ): Promise<void> {
    // Implementation of delta-neutral strategy
    // 1. Borrow stable assets from YEI
    // 2. Provide liquidity to high-yield pools
    // 3. Hedge with perp positions on Citrex
    
    const borrowAmount = portfolio.totalValue * BigInt(50) / BigInt(100);
    
    await this.yeiFinance.borrow('USDC', borrowAmount);
    
    await this.dragonSwap.addLiquidity(
      'SEI',
      'USDC',
      borrowAmount
    );
    
    // Request hedging from execution agent
    this.emit('requestHedge', {
      portfolio: portfolio.id,
      amount: borrowAmount,
      direction: 'SHORT'
    });
  }

  private async requestArbitrageExecution(
    portfolio: Portfolio,
    strategy: Strategy
  ): Promise<void> {
    const message: AgentMessage = {
      id: `req-${Date.now()}`,
      from: this.agentId,
      to: 'arbitrage_hunter',
      type: MessageType.REQUEST,
      payload: {
        service: 'find_arbitrage',
        portfolio: portfolio.id,
        maxCapital: portfolio.totalValue / BigInt(10)
      },
      timestamp: Date.now(),
      signature: 'sig'
    };

    this.emit('sendMessage', message);
  }

  private async rebalancePortfolio(portfolio: Portfolio): Promise<void> {
    const targetAllocations = this.calculateTargetAllocations(portfolio);
    const currentAllocations = this.getCurrentAllocations(portfolio);

    for (const asset of portfolio.assets) {
      const target = targetAllocations[asset.symbol];
      const current = currentAllocations[asset.symbol];

      if (Math.abs(target - current) > 5) {
        await this.rebalanceAsset(portfolio, asset, target);
      }
    }
  }

  private calculateTargetAllocations(portfolio: Portfolio): { [key: string]: number } {
    // Implement modern portfolio theory optimization
    return {
      'SEI': 30,
      'USDC': 30,
      'WETH': 20,
      'WBTC': 20
    };
  }

  private getCurrentAllocations(portfolio: Portfolio): { [key: string]: number } {
    const allocations: { [key: string]: number } = {};
    
    for (const asset of portfolio.assets) {
      allocations[asset.symbol] = Number(asset.value * BigInt(100) / portfolio.totalValue);
    }
    
    return allocations;
  }

  private async rebalanceAsset(
    portfolio: Portfolio,
    asset: Asset,
    targetPercentage: number
  ): Promise<void> {
    const targetValue = portfolio.totalValue * BigInt(targetPercentage) / BigInt(100);
    const difference = targetValue - asset.value;

    if (difference > BigInt(0)) {
      // Buy more
      await this.symphony.swap(
        'USDC',
        asset.symbol,
        difference
      );
    } else {
      // Sell excess
      await this.symphony.swap(
        asset.symbol,
        'USDC',
        difference < BigInt(0) ? -difference : difference
      );
    }
  }

  private async calculateTotalValue(assets: Asset[]): Promise<bigint> {
    let total = BigInt(0);
    
    for (const asset of assets) {
      const price = await this.getAssetPrice(asset.symbol);
      asset.value = asset.amount * price / (BigInt(10) ** BigInt(18));
      total = total + asset.value;
    }
    
    return total;
  }

  private async getAssetPrice(symbol: string): Promise<bigint> {
    // Get price from multiple oracles and take median
    const prices = await Promise.all([
      this.yeiFinance.getPrice(symbol),
      this.symphony.getPrice(symbol)
    ]);

    return prices.sort((a, b) => 
      a > b ? 1 : -1
    )[Math.floor(prices.length / 2)];
  }

  private updatePortfolioAssets(
    portfolio: Portfolio,
    opportunity: any,
    amount: bigint
  ): void {
    // Update portfolio asset allocations
    const asset = portfolio.assets.find(
      a => a.symbol === opportunity.asset.split('/')[0]
    );
    
    if (asset) {
      asset.amount = asset.amount - amount;
      asset.protocol = opportunity.protocol;
      asset.apy = opportunity.apy;
    }
  }

  private startPortfolioMonitoring(): void {
    setInterval(async () => {
      if (!this.isActive) return;

      for (const portfolio of this.portfolios.values()) {
        await this.monitorPortfolioHealth(portfolio);
      }
    }, 60000); // Check every minute
  }

  private async monitorPortfolioHealth(portfolio: Portfolio): Promise<void> {
    const health = await this.calculatePortfolioHealth(portfolio);
    
    if (health.risk > portfolio.riskProfile.maxDrawdown) {
      logger.warn(`Portfolio ${portfolio.id} exceeds risk threshold`);
      await this.reduceRisk(portfolio);
    }

    if (health.performance < -portfolio.riskProfile.stopLoss) {
      logger.error(`Portfolio ${portfolio.id} hitting stop loss`);
      await this.emergencyExit(portfolio);
    }
  }

  private async calculatePortfolioHealth(portfolio: Portfolio): Promise<any> {
    const currentValue = await this.calculateTotalValue(portfolio.assets);
    const initialValue = portfolio.totalValue;
    
    const performance = Number((currentValue - initialValue) * BigInt(100) / initialValue);

    return {
      performance,
      risk: Math.abs(performance),
      healthScore: 100 - Math.abs(performance)
    };
  }

  private async reduceRisk(portfolio: Portfolio): Promise<void> {
    // Implement risk reduction logic
    logger.info(`Reducing risk for portfolio ${portfolio.id}`);
    
    // Close high-risk positions
    // Move to stable assets
    // Reduce leverage
  }

  private async emergencyExit(portfolio: Portfolio): Promise<void> {
    logger.error(`Emergency exit for portfolio ${portfolio.id}`);
    
    // Close all positions
    // Repay all loans
    // Convert to stable assets
    
    this.emit('emergencyExit', portfolio);
  }

  start(): void {
    this.isActive = true;
    logger.info(`Portfolio Manager Agent ${this.agentId} started`);
  }

  stop(): void {
    this.isActive = false;
    logger.info(`Portfolio Manager Agent ${this.agentId} stopped`);
  }
}