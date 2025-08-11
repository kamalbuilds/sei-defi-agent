import { EventEmitter } from 'events';
import { Agent, AgentMessage, PriceData, MessageType, AgentType } from '../../types';
import { Logger } from '../../utils/logger';
import { MetricsCollector } from '../../infrastructure/monitoring/metrics';
import { YeiFinanceIntegration } from '../../protocols/yeiFinance';
import { DragonSwapIntegration } from '../../protocols/dragonSwap';
import { SymphonyIntegration } from '../../protocols/symphony';
import { CitrexIntegration } from '../../protocols/citrex';
import { ethers } from 'ethers';
const formatUnits = ethers.formatUnits;
const parseUnits = ethers.parseUnits;

export interface ArbitrageConfig {
  minProfitThreshold: number; // Minimum profit percentage
  maxGasPrice: bigint;
  maxSlippage: number;
  maxPositionSize: bigint;
  flashLoanProviders: string[];
  monitoredPairs: string[];
  executionDelay: number; // MEV protection delay
}

export interface FlashLoanOpportunity {
  id: string;
  asset: string;
  amount: bigint;
  profitEstimate: bigint;
  gasEstimate: bigint;
  profitPercentage: number;
  executionPlan: ArbitrageStep[];
  confidence: number;
}

export interface ArbitrageStep {
  protocol: string;
  action: 'swap' | 'lend' | 'borrow' | 'liquidate';
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  expectedOut: bigint;
  gasLimit: number;
}

export interface PriceDiscrepancy {
  tokenA: string;
  tokenB: string;
  priceA: bigint;
  priceB: bigint;
  priceDifference: bigint;
  percentage: number;
  volumeAvailable: bigint;
  exchanges: string[];
}

export class ArbitrageHunter extends EventEmitter implements Agent {
  public readonly id: string;
  public readonly type = AgentType.ARBITRAGE;
  public status = 'IDLE' as any;
  public capabilities = ['price_discovery', 'mev_extraction', 'cross_protocol', 'execution', 'flash_loans'];
  public config: any;
  public resources: any = {};
  public createdAt = Date.now();
  public lastHeartbeat = new Date();
  public performanceMetrics = {
    tasksCompleted: 0,
    averageLatency: 0,
    errorRate: 0,
    efficiency: 1.0,
    profitGenerated: BigInt(0),
    successfulArbitrages: 0
  };

  private logger: Logger;
  private metrics: MetricsCollector;
  private yeiFinance: YeiFinanceIntegration;
  private dragonSwap: DragonSwapIntegration;
  private symphony: SymphonyIntegration;
  private citrex: CitrexIntegration;
  
  // Market monitoring
  private priceFeeds: Map<string, PriceData[]> = new Map();
  private activeOpportunities: Map<string, FlashLoanOpportunity> = new Map();
  private executionHistory: ArbitrageExecution[] = [];
  
  // MEV protection and execution
  private pendingTransactions: Map<string, any> = new Map();
  private blacklistedMempools: Set<string> = new Set();
  private gasTracker: GasTracker;
  
  // Machine Learning components
  private pricePredictor: PricePredictor;
  private opportunityScorer: OpportunityScorer;
  private executionOptimizer: ExecutionOptimizer;

  constructor(
    id: string,
    config: ArbitrageConfig,
    protocolIntegrations: {
      yeiFinance: YeiFinanceIntegration;
      dragonSwap: DragonSwapIntegration;
      symphony: SymphonyIntegration;
      citrex: CitrexIntegration;
    }
  ) {
    super();
    this.id = id;
    this.config = config;
    this.logger = new Logger(`ArbitrageHunter-${id}`);
    this.metrics = new MetricsCollector();
    
    this.yeiFinance = protocolIntegrations.yeiFinance;
    this.dragonSwap = protocolIntegrations.dragonSwap;
    this.symphony = protocolIntegrations.symphony;
    this.citrex = protocolIntegrations.citrex;
    
    // Initialize specialized components
    this.gasTracker = new GasTracker();
    this.pricePredictor = new PricePredictor();
    this.opportunityScorer = new OpportunityScorer();
    this.executionOptimizer = new ExecutionOptimizer();
  }

  async initialize(): Promise<void> {
    try {
      this.status = 'ACTIVE' as any;
      
      // Initialize metrics collection
      await this.metrics.initialize();
      
      // Initialize ML components
      await this.pricePredictor.initialize();
      await this.opportunityScorer.initialize();
      await this.executionOptimizer.initialize();
      
      // Start market monitoring
      await this.startPriceMonitoring();
      await this.startOpportunityScanning();
      
      // Initialize gas tracking
      this.gasTracker.startTracking();
      
      this.logger.info('Arbitrage Hunter initialized successfully');
      
    } catch (error) {
      this.status = 'ERROR' as any;
      this.logger.error('Failed to initialize Arbitrage Hunter:', error);
      throw error;
    }
  }

  async processMessage(message: AgentMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Processing message: ${message.type} from ${message.from}`);
      
      switch (message.type) {
        case MessageType.FIND_ARBITRAGE:
          await this.handleFindArbitrage(message);
          break;
        case MessageType.EXECUTE_ARBITRAGE:
          await this.handleExecuteArbitrage(message);
          break;
        case MessageType.MONITOR_PRICES:
          await this.handleMonitorPrices(message);
          break;
        case MessageType.FLASH_LOAN_REQUEST:
          await this.handleFlashLoanRequest(message);
          break;
        case MessageType.LIQUIDATION_OPPORTUNITY:
          await this.handleLiquidationOpportunity(message);
          break;
        case MessageType.CROSS_CHAIN_ARBITRAGE:
          await this.handleCrossChainArbitrage(message);
          break;
        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
      }
      
      // Update performance metrics
      this.performanceMetrics.tasksCompleted++;
      const latency = Date.now() - startTime;
      this.performanceMetrics.averageLatency = 
        (this.performanceMetrics.averageLatency + latency) / 2;
      
      this.lastHeartbeat = new Date();
      
    } catch (error) {
      this.performanceMetrics.errorRate = 
        (this.performanceMetrics.errorRate + 1) / (this.performanceMetrics.tasksCompleted + 1);
      
      this.emit('message', {
        id: `error-${Date.now()}`,
        from: this.id,
        to: message.from,
        type: MessageType.ALERT,
        payload: { error: (error as any).message },
        timestamp: Date.now(),
        signature: 'signed'
      } as AgentMessage);
      
      this.logger.error(`Error processing message ${message.id}:`, error);
      throw error;
    }
  }

  private async handleFindArbitrage(message: AgentMessage): Promise<void> {
    const { assets, minProfit = this.config.minProfitThreshold } = message.payload;
    
    this.logger.info(`Searching for arbitrage opportunities with min profit: ${minProfit}%`);
    
    const opportunities = await this.findArbitrageOpportunities(assets, minProfit);
    
    const response: AgentMessage = {
      id: `response-${Date.now()}`,
      from: this.id,
      to: message.from,
      type: MessageType.ARBITRAGE_OPPORTUNITIES,
      payload: { opportunities },
      timestamp: Date.now(),
      signature: 'signed'
    };
    
    this.emit('message', response);
  }

  private async handleExecuteArbitrage(message: AgentMessage): Promise<void> {
    const { opportunityId, maxSlippage = this.config.maxSlippage } = message.payload;
    
    const opportunity = this.activeOpportunities.get(opportunityId);
    if (!opportunity) {
      throw new Error(`Arbitrage opportunity ${opportunityId} not found`);
    }
    
    this.logger.info(`Executing arbitrage opportunity: ${opportunityId}`);
    
    const result = await this.executeArbitrage(opportunity, maxSlippage);
    
    const response: AgentMessage = {
      id: `response-${Date.now()}`,
      from: this.id,
      to: message.from,
      type: MessageType.ARBITRAGE_EXECUTED,
      payload: result,
      timestamp: Date.now(),
      signature: 'signed'
    };
    
    this.emit('message', response);
  }

  // Core arbitrage detection methods
  async findArbitrageOpportunities(
    assets?: string[],
    minProfitThreshold?: number
  ): Promise<FlashLoanOpportunity[]> {
    const startTime = Date.now();
    const opportunities: FlashLoanOpportunity[] = [];
    
    try {
      const targetAssets = assets || this.config.monitoredPairs;
      const profitThreshold = minProfitThreshold || this.config.minProfitThreshold;
      
      // Parallel scanning across different arbitrage types
      const [priceDiscrepancies, liquidationOpps, yieldArbitrage, crossChainOpps] = await Promise.all([
        this.scanPriceDiscrepancies(targetAssets),
        this.scanLiquidationOpportunities(),
        this.scanYieldArbitrage(targetAssets),
        this.scanCrossChainArbitrage(targetAssets)
      ]);
      
      // Process price discrepancies
      for (const discrepancy of priceDiscrepancies) {
        if (discrepancy.percentage >= profitThreshold) {
          const opportunity = await this.buildFlashLoanOpportunity(
            'price_discrepancy',
            discrepancy
          );
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
      
      // Process liquidation opportunities
      for (const liquidation of liquidationOpps) {
        if (liquidation.profitPercentage >= profitThreshold) {
          const opportunity = await this.buildFlashLoanOpportunity(
            'liquidation',
            liquidation
          );
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
      
      // Process yield arbitrage
      for (const yieldOpp of yieldArbitrage) {
        if (yieldOpp.profitPercentage >= profitThreshold) {
          const opportunity = await this.buildFlashLoanOpportunity(
            'yield_arbitrage',
            yieldOpp
          );
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
      
      // Process cross-chain opportunities
      for (const crossChain of crossChainOpps) {
        if (crossChain.profitPercentage >= profitThreshold) {
          const opportunity = await this.buildFlashLoanOpportunity(
            'cross_chain',
            crossChain
          );
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
      
      // Score and rank opportunities
      const scoredOpportunities = await this.scoreOpportunities(opportunities);
      
      // Store active opportunities
      scoredOpportunities.forEach(opp => {
        this.activeOpportunities.set(opp.id, opp);
      });
      
      // Clean up old opportunities
      this.cleanupExpiredOpportunities();
      
      this.logger.info(
        `Found ${scoredOpportunities.length} arbitrage opportunities ` +
        `in ${Date.now() - startTime}ms`
      );
      
      return scoredOpportunities;
      
    } catch (error) {
      this.logger.error('Failed to find arbitrage opportunities:', error);
      throw error;
    }
  }

  private async scanPriceDiscrepancies(assets: string[]): Promise<PriceDiscrepancy[]> {
    const discrepancies: PriceDiscrepancy[] = [];
    
    for (const asset of assets) {
      try {
        // Get prices from different protocols
        const [dragonPrice, yeiPrice, symphonyPrice] = await Promise.all([
          this.dragonSwap.getMarketPrice(asset, 'USDC'),
          this.yeiFinance.getMarketData(asset),
          this.symphony.estimateSwapOutput(1313, asset, 'USDC', parseUnits('1', 18))
        ]);
        
        const prices = [
          { price: dragonPrice, exchange: 'DragonSwap' },
          { price: yeiPrice ? BigInt(0) : BigInt(0), exchange: 'YEI' }, // Simplified
          { price: symphonyPrice, exchange: 'Symphony' }
        ].filter(p => p.price > BigInt(0));
        
        // Find max and min prices
        if (prices.length >= 2) {
          prices.sort((a, b) => a.price < b.price ? -1 : 1);
          const minPrice = prices[0];
          const maxPrice = prices[prices.length - 1];
          
          const priceDifference = maxPrice.price - minPrice.price;
          const percentage = Number(priceDifference * BigInt(10000) / minPrice.price) / 100;
          
          if (percentage > 1.0) { // Minimum 1% difference
            discrepancies.push({
              tokenA: asset,
              tokenB: 'USDC',
              priceA: minPrice.price,
              priceB: maxPrice.price,
              priceDifference,
              percentage,
              volumeAvailable: parseUnits('10000', 18), // Simplified
              exchanges: [minPrice.exchange, maxPrice.exchange]
            });
          }
        }
        
      } catch (error) {
        this.logger.error(`Failed to scan prices for ${asset}:`, error);
      }
    }
    
    return discrepancies;
  }

  private async scanLiquidationOpportunities(): Promise<any[]> {
    const opportunities: any[] = [];
    
    try {
      // Scan YEI Finance for under-collateralized positions
      const yeiOpportunities = await this.yeiFinance.findLiquidationOpportunities();
      opportunities.push(...yeiOpportunities.map(opp => ({ ...opp, protocol: 'YEI' })));
      
      // Scan Citrex for liquidatable perpetual positions
      const citrexOpportunities = await this.citrex.findLiquidationOpportunities();
      opportunities.push(...citrexOpportunities.map(opp => ({ ...opp, protocol: 'Citrex' })));
      
    } catch (error) {
      this.logger.error('Failed to scan liquidation opportunities:', error);
    }
    
    return opportunities;
  }

  private async scanYieldArbitrage(assets: string[]): Promise<any[]> {
    const opportunities: any[] = [];
    
    for (const asset of assets) {
      try {
        // Compare lending rates across protocols
        const [yeiRate, symphonyRate] = await Promise.all([
          this.yeiFinance.getOptimalSupplyAPY().then(rates => 
            rates.find(r => r.asset === asset)?.apy || 0
          ),
          // Get Symphony rates (simplified)
          5.0
        ]);
        
        const rateDifference = Math.abs(yeiRate - symphonyRate);
        
        if (rateDifference > 2.0) { // 2% difference
          opportunities.push({
            asset,
            higherRateProtocol: yeiRate > symphonyRate ? 'YEI' : 'Symphony',
            lowerRateProtocol: yeiRate > symphonyRate ? 'Symphony' : 'YEI',
            rateDifference,
            profitPercentage: rateDifference,
            amount: parseUnits('50000', 18) // Max amount for yield arbitrage
          });
        }
        
      } catch (error) {
        this.logger.error(`Failed to scan yield arbitrage for ${asset}:`, error);
      }
    }
    
    return opportunities;
  }

  private async scanCrossChainArbitrage(assets: string[]): Promise<any[]> {
    const opportunities: any[] = [];
    
    for (const asset of assets) {
      try {
        const crossChainOpps = await this.symphony.findCrossChainArbitrage(asset);
        opportunities.push(...crossChainOpps);
        
      } catch (error) {
        this.logger.error(`Failed to scan cross-chain arbitrage for ${asset}:`, error);
      }
    }
    
    return opportunities;
  }

  // Flash loan opportunity building
  private async buildFlashLoanOpportunity(
    type: string,
    opportunityData: any
  ): Promise<FlashLoanOpportunity | null> {
    try {
      const opportunityId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      let executionPlan: ArbitrageStep[];
      let asset: string;
      let amount: bigint;
      let profitEstimate: bigint;
      
      switch (type) {
        case 'price_discrepancy':
          ({ executionPlan, asset, amount, profitEstimate } = await this.buildPriceArbitragePlan(opportunityData));
          break;
        case 'liquidation':
          ({ executionPlan, asset, amount, profitEstimate } = await this.buildLiquidationPlan(opportunityData));
          break;
        case 'yield_arbitrage':
          ({ executionPlan, asset, amount, profitEstimate } = await this.buildYieldArbitragePlan(opportunityData));
          break;
        case 'cross_chain':
          ({ executionPlan, asset, amount, profitEstimate } = await this.buildCrossChainPlan(opportunityData));
          break;
        default:
          return null;
      }
      
      // Estimate gas costs
      const gasEstimate = this.estimateExecutionGas(executionPlan);
      const gasCost = gasEstimate * this.gasTracker.getCurrentGasPrice();
      
      // Calculate net profit
      const netProfit = profitEstimate - gasCost;
      const profitPercentage = Number(netProfit * BigInt(10000) / amount) / 100;
      
      if (netProfit <= BigInt(0)) {
        return null; // Not profitable after gas costs
      }
      
      const opportunity: FlashLoanOpportunity = {
        id: opportunityId,
        asset,
        amount,
        profitEstimate: netProfit,
        gasEstimate: gasCost,
        profitPercentage,
        executionPlan,
        confidence: this.calculateOpportunityConfidence(type, opportunityData)
      };
      
      return opportunity;
      
    } catch (error) {
      this.logger.error(`Failed to build ${type} opportunity:`, error);
      return null;
    }
  }

  private async buildPriceArbitragePlan(discrepancy: PriceDiscrepancy): Promise<{
    executionPlan: ArbitrageStep[];
    asset: string;
    amount: bigint;
    profitEstimate: bigint;
  }> {
    const amount = this.calculateOptimalArbitrageAmount(discrepancy);
    
    const executionPlan: ArbitrageStep[] = [
      {
        protocol: 'FlashLoan',
        action: 'borrow',
        tokenIn: 'USDC',
        tokenOut: 'USDC',
        amountIn: amount,
        expectedOut: amount,
        gasLimit: 100000
      },
      {
        protocol: discrepancy.exchanges[0], // Buy low
        action: 'swap',
        tokenIn: 'USDC',
        tokenOut: discrepancy.tokenA,
        amountIn: amount,
        expectedOut: (amount * BigInt(10**18)) / discrepancy.priceA,
        gasLimit: 150000
      },
      {
        protocol: discrepancy.exchanges[1], // Sell high
        action: 'swap',
        tokenIn: discrepancy.tokenA,
        tokenOut: 'USDC',
        amountIn: (amount * BigInt(10**18)) / discrepancy.priceA,
        expectedOut: (amount * BigInt(10**18) * discrepancy.priceB) / (discrepancy.priceA * BigInt(10**18)),
        gasLimit: 150000
      }
    ];
    
    const profitEstimate = executionPlan[2].expectedOut - amount;
    
    return {
      executionPlan,
      asset: discrepancy.tokenA,
      amount,
      profitEstimate
    };
  }

  private async buildLiquidationPlan(liquidation: any): Promise<{
    executionPlan: ArbitrageStep[];
    asset: string;
    amount: bigint;
    profitEstimate: bigint;
  }> {
    const amount = liquidation.debtValue || parseUnits('1000', 18);
    const collateralAmount = liquidation.collateralValue || parseUnits('1200', 18);
    const liquidationBonus = collateralAmount > amount ? collateralAmount - amount : BigInt(0); // Simplified
    
    const executionPlan: ArbitrageStep[] = [
      {
        protocol: 'FlashLoan',
        action: 'borrow',
        tokenIn: liquidation.debtAsset || 'USDC',
        tokenOut: liquidation.debtAsset || 'USDC',
        amountIn: amount,
        expectedOut: amount,
        gasLimit: 100000
      },
      {
        protocol: liquidation.protocol,
        action: 'liquidate',
        tokenIn: liquidation.debtAsset || 'USDC',
        tokenOut: liquidation.collateralAsset || 'SEI',
        amountIn: amount,
        expectedOut: collateralAmount,
        gasLimit: 300000
      },
      {
        protocol: 'DragonSwap',
        action: 'swap',
        tokenIn: liquidation.collateralAsset || 'SEI',
        tokenOut: liquidation.debtAsset || 'USDC',
        amountIn: collateralAmount,
        expectedOut: amount + liquidationBonus,
        gasLimit: 150000
      }
    ];
    
    return {
      executionPlan,
      asset: liquidation.debtAsset || 'USDC',
      amount,
      profitEstimate: liquidationBonus
    };
  }

  private async buildYieldArbitragePlan(yieldOpp: any): Promise<{
    executionPlan: ArbitrageStep[];
    asset: string;
    amount: bigint;
    profitEstimate: bigint;
  }> {
    const amount = yieldOpp.amount;
    const annualizedProfit = (amount * BigInt(Math.floor(yieldOpp.rateDifference * 100))) / BigInt(10000);
    const dailyProfit = annualizedProfit / BigInt(365);
    
    const executionPlan: ArbitrageStep[] = [
      {
        protocol: 'FlashLoan',
        action: 'borrow',
        tokenIn: yieldOpp.asset,
        tokenOut: yieldOpp.asset,
        amountIn: amount,
        expectedOut: amount,
        gasLimit: 100000
      },
      {
        protocol: yieldOpp.higherRateProtocol,
        action: 'lend',
        tokenIn: yieldOpp.asset,
        tokenOut: `a${yieldOpp.asset}`, // Interest-bearing token
        amountIn: amount,
        expectedOut: amount,
        gasLimit: 200000
      },
      {
        protocol: yieldOpp.lowerRateProtocol,
        action: 'borrow',
        tokenIn: `a${yieldOpp.asset}`,
        tokenOut: yieldOpp.asset,
        amountIn: amount,
        expectedOut: amount,
        gasLimit: 200000
      }
    ];
    
    return {
      executionPlan,
      asset: yieldOpp.asset,
      amount,
      profitEstimate: dailyProfit
    };
  }

  private async buildCrossChainPlan(crossChain: any): Promise<{
    executionPlan: ArbitrageStep[];
    asset: string;
    amount: bigint;
    profitEstimate: bigint;
  }> {
    const amount = crossChain.requiredAmount || parseUnits('5000', 18);
    const profitEstimate = (amount * BigInt(Math.floor(crossChain.profitPercentage * 100))) / BigInt(10000);
    
    const executionPlan: ArbitrageStep[] = [
      {
        protocol: 'FlashLoan',
        action: 'borrow',
        tokenIn: 'USDC',
        tokenOut: 'USDC',
        amountIn: amount,
        expectedOut: amount,
        gasLimit: 100000
      },
      {
        protocol: 'DragonSwap',
        action: 'swap',
        tokenIn: 'USDC',
        tokenOut: crossChain.asset || 'SEI',
        amountIn: amount,
        expectedOut: (amount * BigInt(10**18)) / crossChain.priceDifference,
        gasLimit: 150000
      },
      {
        protocol: 'Symphony',
        action: 'swap',
        tokenIn: crossChain.asset || 'SEI',
        tokenOut: 'USDC',
        amountIn: (amount * BigInt(10**18)) / crossChain.priceDifference,
        expectedOut: amount + profitEstimate,
        gasLimit: 250000
      }
    ];
    
    return {
      executionPlan,
      asset: crossChain.asset || 'SEI',
      amount,
      profitEstimate
    };
  }

  // Execution methods
  async executeArbitrage(
    opportunity: FlashLoanOpportunity,
    maxSlippage: number = this.config.maxSlippage
  ): Promise<ArbitrageExecution> {
    const startTime = Date.now();
    
    try {
      this.logger.info(
        `Executing arbitrage ${opportunity.id}: ` +
        `${formatUnits(opportunity.amount, 18)} ${opportunity.asset} ` +
        `for ${opportunity.profitPercentage.toFixed(2)}% profit`
      );
      
      // Pre-execution validation
      await this.validateOpportunity(opportunity);
      
      // MEV protection delay
      if (this.config.executionDelay > 0) {
        await this.sleep(this.config.executionDelay);
      }
      
      // Execute flash loan with callback
      const txHash = await this.executeFlashLoan(
        opportunity.asset,
        opportunity.amount,
        opportunity.executionPlan
      );
      
      // Monitor execution
      const result = await this.monitorExecution(txHash, opportunity);
      
      // Update metrics
      this.updateExecutionMetrics(result);
      
      // Store execution history
      this.executionHistory.push(result);
      
      // Clean up
      this.activeOpportunities.delete(opportunity.id);
      
      this.logger.info(
        `Arbitrage executed successfully: ${txHash}, ` +
        `Profit: ${formatUnits(result.actualProfit, 18)} ${opportunity.asset}`
      );
      
      return result;
      
    } catch (error) {
      this.logger.error(`Arbitrage execution failed for ${opportunity.id}:`, error);
      
      const failedExecution: ArbitrageExecution = {
        opportunityId: opportunity.id,
        txHash: '',
        success: false,
        error: (error as any).message,
        gasUsed: BigInt(0),
        actualProfit: BigInt(0),
        duration: Date.now() - startTime
      };
      
      this.executionHistory.push(failedExecution);
      throw error;
    }
  }

  private async executeFlashLoan(
    asset: string,
    amount: bigint,
    executionPlan: ArbitrageStep[]
  ): Promise<string> {
    // Choose best flash loan provider based on fees
    const provider = await this.selectBestFlashLoanProvider(asset, amount);
    
    switch (provider) {
      case 'YEI':
        return await this.yeiFinance.executeFlashLoan(
          [asset],
          [amount],
          [0], // No debt mode for arbitrage
          this.getFlashLoanCallbackAddress(),
          this.encodeExecutionPlan(executionPlan)
        );
      default:
        throw new Error(`Unsupported flash loan provider: ${provider}`);
    }
  }

  private async selectBestFlashLoanProvider(
    asset: string,
    amount: bigint
  ): Promise<string> {
    const providers = this.config.flashLoanProviders;
    let bestProvider = providers[0];
    let lowestFee = Infinity;
    
    for (const provider of providers) {
      try {
        let fee = 0;
        
        switch (provider) {
          case 'YEI':
            // Get YEI flash loan fee
            fee = 0.0009; // 0.09%
            break;
          default:
            continue;
        }
        
        if (fee < lowestFee) {
          lowestFee = fee;
          bestProvider = provider;
        }
      } catch (error) {
        this.logger.error(`Failed to get fee from ${provider}:`, error);
      }
    }
    
    return bestProvider;
  }

  // Utility methods
  private calculateOptimalArbitrageAmount(discrepancy: PriceDiscrepancy): bigint {
    // Consider available liquidity, gas costs, and price impact
    const maxAmount = discrepancy.volumeAvailable / BigInt(2); // Use half of available liquidity
    const gasConstrainedAmount = this.calculateGasConstrainedAmount(discrepancy.percentage);
    
    return maxAmount < gasConstrainedAmount ? maxAmount : gasConstrainedAmount;
  }

  private calculateGasConstrainedAmount(profitPercentage: number): bigint {
    // Calculate amount where gas costs don't eat into profits too much
    const estimatedGasCost = this.gasTracker.getCurrentGasPrice() * BigInt(500000); // Estimated gas for full arbitrage
    const minAmount = (estimatedGasCost * BigInt(1000)) / BigInt(Math.floor(profitPercentage * 10)); // 10x gas cost minimum
    
    return minAmount < this.config.maxPositionSize ? minAmount : this.config.maxPositionSize;
  }

  private estimateExecutionGas(executionPlan: ArbitrageStep[]): bigint {
    return BigInt(executionPlan.reduce((total, step) => total + step.gasLimit, 100000)); // Base gas
  }

  private calculateOpportunityConfidence(type: string, data: any): number {
    // ML-based confidence scoring
    let baseConfidence = 0.5;
    
    switch (type) {
      case 'price_discrepancy':
        baseConfidence = Math.min(0.95, 0.3 + (data.percentage / 10));
        break;
      case 'liquidation':
        baseConfidence = data.healthFactor < 1.0 ? 0.9 : 0.6;
        break;
      case 'yield_arbitrage':
        baseConfidence = Math.min(0.8, 0.4 + (data.rateDifference / 20));
        break;
      case 'cross_chain':
        baseConfidence = 0.7; // Cross-chain has more execution risk
        break;
    }
    
    // Adjust for market volatility and gas prices
    const gasAdjustment = this.gasTracker.isHighGasPeriod() ? -0.1 : 0;
    const volatilityAdjustment = this.getMarketVolatility() > 0.5 ? -0.15 : 0;
    
    return Math.max(0.1, Math.min(0.95, baseConfidence + gasAdjustment + volatilityAdjustment));
  }

  private async scoreOpportunities(
    opportunities: FlashLoanOpportunity[]
  ): Promise<FlashLoanOpportunity[]> {
    // Use ML model to score and rank opportunities
    const scoredOpportunities = await this.opportunityScorer.scoreOpportunities(opportunities);
    
    return scoredOpportunities
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Keep top 10 opportunities
  }

  private async validateOpportunity(opportunity: FlashLoanOpportunity): Promise<void> {
    // Re-validate opportunity before execution
    const _currentGasPrice = this.gasTracker.getCurrentGasPrice();
    const currentGasCost = opportunity.gasEstimate;
    
    if (currentGasCost > opportunity.gasEstimate * BigInt(2)) {
      throw new Error('Gas price too high for profitable execution');
    }
    
    // Check if liquidity is still available
    for (const step of opportunity.executionPlan) {
      if (step.action === 'swap') {
        await this.validateSwapLiquidity(step);
      }
    }
  }

  private async validateSwapLiquidity(step: ArbitrageStep): Promise<void> {
    // Validate that liquidity is still available for the swap
    try {
      switch (step.protocol) {
        case 'DragonSwap':
          const amountOut = await this.dragonSwap.getAmountsOut(
            step.amountIn,
            [step.tokenIn, step.tokenOut]
          );
          if (amountOut[1] < step.expectedOut * BigInt(95) / BigInt(100)) {
            throw new Error('Insufficient liquidity or high slippage');
          }
          break;
        // Add other protocol validations
      }
    } catch (error) {
      throw new Error(`Liquidity validation failed for ${step.protocol}: ${(error as any).message}`);
    }
  }

  private async monitorExecution(
    txHash: string,
    opportunity: FlashLoanOpportunity
  ): Promise<ArbitrageExecution> {
    // Monitor transaction execution and calculate actual results
    // This would involve parsing transaction receipts and events
    
    return {
      opportunityId: opportunity.id,
      txHash,
      success: true,
      gasUsed: opportunity.gasEstimate,
      actualProfit: opportunity.profitEstimate,
      duration: 30000 // 30 seconds
    };
  }

  private updateExecutionMetrics(result: ArbitrageExecution): void {
    if (result.success) {
      this.performanceMetrics.successfulArbitrages++;
      this.performanceMetrics.profitGenerated += result.actualProfit;
    }
  }

  private cleanupExpiredOpportunities(): void {
    const now = Date.now();
    const expirationTime = 300000; // 5 minutes
    
    for (const [id] of this.activeOpportunities) {
      if (now - parseInt(id.split('-')[1]) > expirationTime) {
        this.activeOpportunities.delete(id);
      }
    }
  }

  // Monitoring methods
  private async startPriceMonitoring(): Promise<void> {
    setInterval(async () => {
      try {
        await this.updatePriceFeeds();
      } catch (error) {
        this.logger.error('Error in price monitoring:', error);
      }
    }, 1000); // Update every second
  }

  private async startOpportunityScanning(): Promise<void> {
    setInterval(async () => {
      try {
        await this.findArbitrageOpportunities();
      } catch (error) {
        this.logger.error('Error in opportunity scanning:', error);
      }
    }, 10000); // Scan every 10 seconds
  }

  private async updatePriceFeeds(): Promise<void> {
    for (const asset of this.config.monitoredPairs) {
      try {
        const price = await this.dragonSwap.getMarketPrice(asset, 'USDC');
        const priceData: PriceData = {
          asset,
          price,
          timestamp: Date.now(),
          source: 'DragonSwap'
        };
        
        const history = this.priceFeeds.get(asset) || [];
        history.push(priceData);
        
        // Keep only last 1000 price points
        if (history.length > 1000) {
          history.splice(0, history.length - 1000);
        }
        
        this.priceFeeds.set(asset, history);
        
      } catch (error) {
        this.logger.error(`Failed to update price feed for ${asset}:`, error);
      }
    }
  }

  private getMarketVolatility(): number {
    // Calculate market volatility based on price feeds
    let totalVolatility = 0;
    let assetCount = 0;
    
    for (const [, prices] of this.priceFeeds) {
      if (prices.length >= 20) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
          const return_ = Number(prices[i].price - prices[i-1].price) / Number(prices[i-1].price);
          returns.push(return_);
        }
        
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance);
        
        totalVolatility += volatility;
        assetCount++;
      }
    }
    
    return assetCount > 0 ? totalVolatility / assetCount : 0;
  }

  // Helper methods for message handling
  private async handleMonitorPrices(message: AgentMessage): Promise<void> {
    const { assets } = message.payload;
    
    // Update monitored pairs if requested
    if (assets) {
      this.config.monitoredPairs = [...this.config.monitoredPairs, ...assets];
    }
    
    await this.updatePriceFeeds();
    
    const response: AgentMessage = {
      id: `response-${Date.now()}`,
      from: this.id,
      to: message.from,
      type: MessageType.PRICE_DATA,
      payload: { priceFeeds: Object.fromEntries(this.priceFeeds) },
      timestamp: Date.now(),
      signature: 'signed'
    };
    
    this.emit('message', response);
  }

  private async handleFlashLoanRequest(message: AgentMessage): Promise<void> {
    const { asset, amount, executionData } = message.payload;
    
    try {
      const txHash = await this.executeFlashLoan(
        asset,
        BigInt(amount),
        JSON.parse(executionData)
      );
      
      const response: AgentMessage = {
        id: `response-${Date.now()}`,
        from: this.id,
        to: message.from,
        type: MessageType.FLASH_LOAN_EXECUTED,
        payload: { txHash, success: true },
        timestamp: Date.now(),
        signature: 'signed'
      };
      
      this.emit('message', response);
      
    } catch (error) {
      const response: AgentMessage = {
        id: `response-${Date.now()}`,
        from: this.id,
        to: message.from,
        type: MessageType.FLASH_LOAN_FAILED,
        payload: { error: (error as any).message, success: false },
        timestamp: Date.now(),
        signature: 'signed'
      };
      
      this.emit('message', response);
    }
  }

  private async handleLiquidationOpportunity(message: AgentMessage): Promise<void> {
    const { protocol, user, collateralAsset, debtAsset } = message.payload;
    
    try {
      let txHash: string;
      
      switch (protocol) {
        case 'YEI':
          txHash = await this.yeiFinance.liquidate(
            collateralAsset,
            debtAsset,
            user,
            parseUnits('1000', 18) // Max liquidation amount
          );
          break;
        case 'Citrex':
          // Handle Citrex liquidation
          txHash = 'citrex-liquidation-tx';
          break;
        default:
          throw new Error(`Unsupported liquidation protocol: ${protocol}`);
      }
      
      const response: AgentMessage = {
        id: `response-${Date.now()}`,
        from: this.id,
        to: message.from,
        type: MessageType.LIQUIDATION_EXECUTED,
        payload: { txHash, success: true },
        timestamp: Date.now(),
        signature: 'signed'
      };
      
      this.emit('message', response);
      
    } catch (error) {
      const response: AgentMessage = {
        id: `response-${Date.now()}`,
        from: this.id,
        to: message.from,
        type: MessageType.LIQUIDATION_FAILED,
        payload: { error: (error as any).message, success: false },
        timestamp: Date.now(),
        signature: 'signed'
      };
      
      this.emit('message', response);
    }
  }

  private async handleCrossChainArbitrage(message: AgentMessage): Promise<void> {
    const { asset, fromChain, toChain, amount } = message.payload;
    
    try {
      const crossChainOpportunities = await this.symphony.findCrossChainArbitrage(asset);
      
      const relevantOpp = crossChainOpportunities.find(
        opp => opp.fromChain === fromChain && opp.toChain === toChain
      );
      
      if (relevantOpp && relevantOpp.profitPercentage > this.config.minProfitThreshold) {
        // Execute cross-chain arbitrage
        const swapParams = {
          fromChain,
          toChain,
          tokenIn: asset,
          tokenOut: 'USDC',
          amountIn: BigInt(amount),
          recipient: 'arbitrage-contract-address',
          slippageTolerance: this.config.maxSlippage
        };
        
        const txHash = await this.symphony.executeCrossChainSwap(swapParams);
        
        const response: AgentMessage = {
          id: `response-${Date.now()}`,
          from: this.id,
          to: message.from,
          type: MessageType.CROSS_CHAIN_ARBITRAGE_EXECUTED,
          payload: { txHash, success: true, profitEstimate: relevantOpp.priceDifference },
          timestamp: Date.now(),
          signature: 'signed'
        };
        
        this.emit('message', response);
      } else {
        throw new Error('No profitable cross-chain arbitrage opportunity found');
      }
      
    } catch (error) {
      const response: AgentMessage = {
        id: `response-${Date.now()}`,
        from: this.id,
        to: message.from,
        type: MessageType.CROSS_CHAIN_ARBITRAGE_FAILED,
        payload: { error: (error as any).message, success: false },
        timestamp: Date.now(),
        signature: 'signed'
      };
      
      this.emit('message', response);
    }
  }

  // Utility methods
  private getFlashLoanCallbackAddress(): string {
    // Return the address of the flash loan callback contract
    return 'flash-loan-callback-contract-address';
  }

  private encodeExecutionPlan(executionPlan: ArbitrageStep[]): string {
    // Encode the execution plan for the flash loan callback
    return JSON.stringify(executionPlan);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  async getActiveOpportunities(): Promise<FlashLoanOpportunity[]> {
    return Array.from(this.activeOpportunities.values());
  }

  async getExecutionHistory(limit: number = 50): Promise<ArbitrageExecution[]> {
    return this.executionHistory.slice(-limit);
  }

  async getPerformanceStats(): Promise<{
    totalExecutions: number;
    successRate: number;
    totalProfit: string;
    averageProfit: string;
    gasEfficiency: number;
  }> {
    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(e => e.success).length;
    const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;
    const totalProfit = this.performanceMetrics.profitGenerated;
    const averageProfit = totalExecutions > 0 ? totalProfit / BigInt(totalExecutions) : BigInt(0);
    
    return {
      totalExecutions,
      successRate,
      totalProfit: formatUnits(totalProfit, 18),
      averageProfit: formatUnits(averageProfit, 18),
      gasEfficiency: this.performanceMetrics.efficiency
    };
  }

  async shutdown(): Promise<void> {
    this.status = 'IDLE' as any;
    await this.metrics.shutdown();
    this.gasTracker.stopTracking();
    this.logger.info('Arbitrage Hunter shut down');
  }
}

// Supporting classes
interface ArbitrageExecution {
  opportunityId: string;
  txHash: string;
  success: boolean;
  error?: string;
  gasUsed: bigint;
  actualProfit: bigint;
  duration: number;
}

class GasTracker {
  private currentGasPrice: bigint = parseUnits('20', 9); // 20 gwei
  private gasHistory: { price: bigint; timestamp: number }[] = [];
  private tracking = false;
  
  startTracking(): void {
    this.tracking = true;
    this.updateGasPrice();
    
    setInterval(() => {
      if (this.tracking) {
        this.updateGasPrice();
      }
    }, 15000); // Update every 15 seconds
  }
  
  stopTracking(): void {
    this.tracking = false;
  }
  
  private async updateGasPrice(): Promise<void> {
    // In production, this would fetch from gas price APIs
    // For now, simulate gas price fluctuations
    const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
    this.currentGasPrice = BigInt(Math.floor(Number(this.currentGasPrice) * (1 + variation)));
    
    this.gasHistory.push({
      price: this.currentGasPrice,
      timestamp: Date.now()
    });
    
    // Keep only last 100 data points
    if (this.gasHistory.length > 100) {
      this.gasHistory.splice(0, this.gasHistory.length - 100);
    }
  }
  
  getCurrentGasPrice(): bigint {
    return this.currentGasPrice;
  }
  
  isHighGasPeriod(): boolean {
    if (this.gasHistory.length < 20) return false;
    
    const recent = this.gasHistory.slice(-20);
    const average = recent.reduce((sum, g) => sum + Number(g.price), 0) / recent.length;
    
    return Number(this.currentGasPrice) > average * 1.5;
  }
}

class PricePredictor {
  async initialize(): Promise<void> {
    // Initialize ML model for price prediction
  }
  
  async predictPriceMovement(asset: string, timeHorizon: number): Promise<number> {
    // Implement price prediction logic
    return Math.random() - 0.5; // Simplified
  }
}

class OpportunityScorer {
  async initialize(): Promise<void> {
    // Initialize ML model for opportunity scoring
  }
  
  async scoreOpportunities(opportunities: FlashLoanOpportunity[]): Promise<FlashLoanOpportunity[]> {
    // Score opportunities using ML model
    return opportunities; // Simplified
  }
}

class ExecutionOptimizer {
  async initialize(): Promise<void> {
    // Initialize execution optimization algorithms
  }
  
  async optimizeExecutionPlan(plan: ArbitrageStep[]): Promise<ArbitrageStep[]> {
    // Optimize execution plan for gas efficiency and success probability
    return plan; // Simplified
  }
}

export default ArbitrageHunter;