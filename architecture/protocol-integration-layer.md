# Protocol Integration Layer Architecture

## Overview
The Protocol Integration Layer provides seamless connectivity to major DeFi protocols on the Sei ecosystem, enabling agents to interact with various financial primitives through standardized interfaces.

## Integration Architecture

### 1. Protocol Adapter Pattern
Each protocol integration follows a standardized adapter pattern for consistency and maintainability.

```typescript
abstract class ProtocolAdapter {
  protected provider: SeiProvider;
  protected config: ProtocolConfig;
  
  abstract async connect(): Promise<void>;
  abstract async getProtocolInfo(): Promise<ProtocolInfo>;
  abstract async executeOperation(op: ProtocolOperation): Promise<TransactionResult>;
  abstract async getPositions(wallet: string): Promise<Position[]>;
  abstract async getAvailableOperations(): Promise<Operation[]>;
}

interface ProtocolConfig {
  name: string;
  contractAddress: string;
  version: string;
  networkId: string;
  gasSettings: GasSettings;
  rateLimits: RateLimitConfig;
}
```

## Protocol Integrations

### 1. YEI Finance Integration
Advanced yield optimization and liquidity provision platform.

```typescript
class YEIFinanceAdapter extends ProtocolAdapter {
  private yeiContract: Contract;
  private vaultManager: VaultManager;
  
  async optimizeYield(
    assets: Asset[],
    strategy: YieldStrategy
  ): Promise<YieldOptimizationResult> {
    const vaults = await this.getOptimalVaults(assets);
    const allocations = await this.calculateOptimalAllocations(vaults, strategy);
    
    const transactions: Transaction[] = [];
    
    for (const allocation of allocations) {
      const tx = await this.yeiContract.deposit(
        allocation.vaultId,
        allocation.amount,
        {
          gasLimit: this.config.gasSettings.defaultGasLimit,
          gasPrice: await this.getOptimalGasPrice()
        }
      );
      
      transactions.push(tx);
    }
    
    return {
      transactions,
      expectedApy: allocations.reduce((sum, a) => sum + a.expectedApy, 0),
      riskScore: this.calculateRiskScore(allocations),
      rebalanceSchedule: this.generateRebalanceSchedule(allocations)
    };
  }
  
  async autoCompound(vaultId: string): Promise<TransactionResult> {
    const rewards = await this.yeiContract.getPendingRewards(vaultId);
    
    if (rewards.gt(this.config.minCompoundAmount)) {
      return await this.yeiContract.compound(vaultId);
    }
    
    return { skipped: true, reason: 'Insufficient rewards for compounding' };
  }
  
  private async getOptimalVaults(assets: Asset[]): Promise<YieldVault[]> {
    const allVaults = await this.yeiContract.getAllVaults();
    
    return allVaults
      .filter(vault => this.supportsAssets(vault, assets))
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 5); // Top 5 vaults
  }
}
```

### 2. DragonSwap Integration
DEX aggregation and advanced trading functionality.

```typescript
class DragonSwapAdapter extends ProtocolAdapter {
  private dragonContract: Contract;
  private routeOptimizer: RouteOptimizer;
  private slippageProtector: SlippageProtector;
  
  async executeTrade(trade: TradeRequest): Promise<TradeResult> {
    const optimalRoute = await this.routeOptimizer.findOptimalRoute(
      trade.tokenIn,
      trade.tokenOut,
      trade.amountIn
    );
    
    const slippageParams = await this.slippageProtector.calculateProtection(
      trade,
      optimalRoute
    );
    
    const transaction = await this.dragonContract.swapExactTokensForTokens(
      trade.amountIn,
      slippageParams.minAmountOut,
      optimalRoute.path,
      trade.recipient,
      trade.deadline,
      {
        gasLimit: optimalRoute.estimatedGas,
        gasPrice: await this.getOptimalGasPrice()
      }
    );
    
    return {
      transaction,
      route: optimalRoute,
      expectedOutput: optimalRoute.expectedOutput,
      slippageTolerance: slippageParams.tolerance,
      priceImpact: optimalRoute.priceImpact
    };
  }
  
  async provideLiquidity(
    tokenA: string,
    tokenB: string,
    amountA: BigNumber,
    amountB: BigNumber
  ): Promise<LiquidityResult> {
    // Get pool information
    const pool = await this.dragonContract.getPool(tokenA, tokenB);
    
    // Calculate optimal amounts
    const { optimalAmountA, optimalAmountB } = await this.calculateOptimalAmounts(
      pool,
      amountA,
      amountB
    );
    
    // Add liquidity
    const transaction = await this.dragonContract.addLiquidity(
      tokenA,
      tokenB,
      optimalAmountA,
      optimalAmountB,
      optimalAmountA.mul(95).div(100), // 5% slippage tolerance
      optimalAmountB.mul(95).div(100),
      await this.getSigner().getAddress(),
      Math.floor(Date.now() / 1000) + 1800 // 30 minute deadline
    );
    
    return {
      transaction,
      lpTokensReceived: await this.estimateLPTokens(optimalAmountA, optimalAmountB),
      poolShare: await this.calculatePoolShare(optimalAmountA, optimalAmountB),
      fees24h: await this.estimateFees(pool)
    };
  }
}
```

### 3. Symphony DEX Integration
Advanced order book and algorithmic trading features.

```typescript
class SymphonyDEXAdapter extends ProtocolAdapter {
  private symphonyContract: Contract;
  private orderBookManager: OrderBookManager;
  private algotradingEngine: AlgoTradingEngine;
  
  async placeAlgorithmicOrder(order: AlgorithmicOrder): Promise<OrderResult> {
    const strategy = await this.algotradingEngine.buildStrategy(order);
    
    const orderParams = {
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      amount: order.amount,
      strategyType: strategy.type,
      triggerConditions: strategy.triggers,
      executionParams: strategy.params
    };
    
    const transaction = await this.symphonyContract.placeAlgoOrder(orderParams);
    
    return {
      orderId: await this.extractOrderId(transaction),
      transaction,
      strategy,
      estimatedExecution: strategy.estimatedExecutionTime,
      fees: await this.calculateAlgoOrderFees(order)
    };
  }
  
  async monitorOrderBook(pair: TradingPair): Promise<OrderBookSnapshot> {
    const [bids, asks] = await Promise.all([
      this.symphonyContract.getBids(pair.tokenA, pair.tokenB, 20),
      this.symphonyContract.getAsks(pair.tokenA, pair.tokenB, 20)
    ]);
    
    return {
      pair,
      bids: bids.map(this.formatOrderBookEntry),
      asks: asks.map(this.formatOrderBookEntry),
      spread: this.calculateSpread(bids[0], asks[0]),
      depth: await this.calculateMarketDepth(bids, asks),
      timestamp: Date.now()
    };
  }
}
```

### 4. Citrex Perpetual Trading Integration
Advanced perpetual futures and leveraged trading.

```typescript
class CitrexAdapter extends ProtocolAdapter {
  private citrexContract: Contract;
  private positionManager: PositionManager;
  private riskEngine: PerpRiskEngine;
  
  async openPerpPosition(
    position: PerpPositionRequest
  ): Promise<PerpPositionResult> {
    // Risk assessment
    const riskAssessment = await this.riskEngine.assessPosition(position);
    
    if (!riskAssessment.approved) {
      throw new Error(`Position rejected: ${riskAssessment.reason}`);
    }
    
    // Calculate margin requirements
    const marginReq = await this.calculateMarginRequirement(
      position.size,
      position.leverage,
      position.market
    );
    
    // Open position
    const transaction = await this.citrexContract.openPosition({
      market: position.market,
      side: position.side,
      size: position.size,
      leverage: position.leverage,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      margin: marginReq
    });
    
    return {
      positionId: await this.extractPositionId(transaction),
      transaction,
      entryPrice: await this.getMarketPrice(position.market),
      marginUsed: marginReq,
      liquidationPrice: await this.calculateLiquidationPrice(position),
      fundingRate: await this.getCurrentFundingRate(position.market)
    };
  }
  
  async managePerpRisk(positionId: string): Promise<RiskManagementResult> {
    const position = await this.citrexContract.getPosition(positionId);
    const currentPrice = await this.getMarketPrice(position.market);
    
    const actions: RiskAction[] = [];
    
    // Check for liquidation risk
    if (this.isNearLiquidation(position, currentPrice)) {
      actions.push({
        type: 'REDUCE_SIZE',
        params: { reduction: 0.5 } // Reduce position by 50%
      });
    }
    
    // Dynamic stop loss adjustment
    if (this.shouldAdjustStopLoss(position, currentPrice)) {
      actions.push({
        type: 'ADJUST_STOP_LOSS',
        params: { newStopLoss: this.calculateDynamicStopLoss(position, currentPrice) }
      });
    }
    
    // Execute risk management actions
    const results = await Promise.all(
      actions.map(action => this.executeRiskAction(positionId, action))
    );
    
    return {
      positionId,
      actionsExecuted: actions,
      results,
      newRiskLevel: await this.calculateRiskLevel(positionId)
    };
  }
}
```

### 5. Takara Lending Integration
Sophisticated lending and borrowing operations.

```typescript
class TakaraAdapter extends ProtocolAdapter {
  private takaraContract: Contract;
  private creditEngine: CreditEngine;
  private liquidationProtector: LiquidationProtector;
  
  async optimizeLending(
    assets: Asset[],
    strategy: LendingStrategy
  ): Promise<LendingOptimizationResult> {
    const markets = await this.takaraContract.getAllMarkets();
    const opportunities = await this.analyzeLendingOpportunities(assets, markets);
    
    const optimalAllocations = await this.calculateOptimalLendingAllocations(
      opportunities,
      strategy
    );
    
    const transactions: Transaction[] = [];
    
    for (const allocation of optimalAllocations) {
      const tx = await this.takaraContract.supply(
        allocation.market,
        allocation.amount
      );
      transactions.push(tx);
    }
    
    return {
      transactions,
      expectedApy: this.calculateWeightedApy(optimalAllocations),
      totalSupplied: assets.reduce((sum, a) => sum.add(a.amount), BigNumber.from(0)),
      collateralValue: await this.calculateCollateralValue(optimalAllocations),
      borrowingCapacity: await this.calculateBorrowingCapacity(optimalAllocations)
    };
  }
  
  async manageLiquidationRisk(wallet: string): Promise<LiquidationProtectionResult> {
    const positions = await this.takaraContract.getUserPositions(wallet);
    const healthFactor = await this.takaraContract.getHealthFactor(wallet);
    
    if (healthFactor.lt(this.config.liquidationThreshold)) {
      const protectionActions = await this.liquidationProtector.generateProtectionPlan(
        positions,
        healthFactor
      );
      
      return await this.executeProtectionPlan(protectionActions);
    }
    
    return { healthy: true, healthFactor };
  }
}
```

### 6. Silo Staking Integration
Staking rewards optimization and governance participation.

```typescript
class SiloAdapter extends ProtocolAdapter {
  private siloContract: Contract;
  private stakingOptimizer: StakingOptimizer;
  private governanceEngine: GovernanceEngine;
  
  async optimizeStaking(
    amount: BigNumber,
    strategy: StakingStrategy
  ): Promise<StakingOptimizationResult> {
    const validators = await this.siloContract.getValidators();
    const optimalValidators = await this.stakingOptimizer.selectValidators(
      validators,
      amount,
      strategy
    );
    
    const delegations: Delegation[] = [];
    
    for (const validator of optimalValidators) {
      const delegationAmount = amount.mul(validator.allocation).div(100);
      
      const tx = await this.siloContract.delegate(
        validator.address,
        delegationAmount
      );
      
      delegations.push({
        validator: validator.address,
        amount: delegationAmount,
        expectedRewards: validator.expectedApy,
        transaction: tx
      });
    }
    
    return {
      delegations,
      totalStaked: amount,
      expectedApy: this.calculateWeightedStakingApy(delegations),
      unstakingPeriod: await this.siloContract.getUnstakingPeriod(),
      compoundingSchedule: await this.generateCompoundingSchedule(delegations)
    };
  }
  
  async participateInGovernance(
    proposal: GovernanceProposal,
    strategy: VotingStrategy
  ): Promise<VotingResult> {
    const analysis = await this.governanceEngine.analyzeProposal(proposal);
    const vote = await this.governanceEngine.generateVote(analysis, strategy);
    
    const transaction = await this.siloContract.vote(proposal.id, vote.decision);
    
    return {
      proposalId: proposal.id,
      vote: vote.decision,
      reasoning: vote.reasoning,
      transaction,
      votingPower: await this.siloContract.getVotingPower(
        await this.getSigner().getAddress()
      )
    };
  }
}
```

## Protocol Manager

### Unified Protocol Interface
```typescript
class ProtocolManager {
  private adapters: Map<string, ProtocolAdapter>;
  private routingEngine: ProtocolRoutingEngine;
  private aggregationEngine: AggregationEngine;
  
  constructor() {
    this.adapters = new Map([
      ['yei', new YEIFinanceAdapter()],
      ['dragonswap', new DragonSwapAdapter()],
      ['symphony', new SymphonyDEXAdapter()],
      ['citrex', new CitrexAdapter()],
      ['takara', new TakaraAdapter()],
      ['silo', new SiloAdapter()]
    ]);
  }
  
  async executeOptimalStrategy(
    request: StrategyRequest
  ): Promise<StrategyExecutionResult> {
    const routes = await this.routingEngine.findOptimalRoutes(request);
    const aggregatedPlan = await this.aggregationEngine.createExecutionPlan(routes);
    
    const results: ProtocolResult[] = [];
    
    for (const step of aggregatedPlan.steps) {
      const adapter = this.adapters.get(step.protocol);
      const result = await adapter.executeOperation(step.operation);
      results.push({ protocol: step.protocol, result });
    }
    
    return {
      executionPlan: aggregatedPlan,
      results,
      totalGasUsed: results.reduce((sum, r) => sum.add(r.result.gasUsed), BigNumber.from(0)),
      totalValue: await this.calculateTotalValue(results),
      performance: await this.analyzePerformance(results)
    };
  }
  
  async monitorAllPositions(wallet: string): Promise<PositionSnapshot> {
    const positions = await Promise.all(
      Array.from(this.adapters.entries()).map(async ([protocol, adapter]) => ({
        protocol,
        positions: await adapter.getPositions(wallet)
      }))
    );
    
    return {
      wallet,
      protocols: positions,
      totalValue: await this.calculateTotalPortfolioValue(positions),
      riskMetrics: await this.calculatePortfolioRisk(positions),
      timestamp: Date.now()
    };
  }
}
```

## Cross-Protocol Operations

### 1. Cross-Protocol Arbitrage
```typescript
class CrossProtocolArbitrage {
  private protocolManager: ProtocolManager;
  
  async findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    // DEX-DEX arbitrage
    const dexPairs = [
      { protocolA: 'dragonswap', protocolB: 'symphony' }
    ];
    
    for (const pair of dexPairs) {
      const opps = await this.findDexArbitrageOpportunities(
        pair.protocolA,
        pair.protocolB
      );
      opportunities.push(...opps);
    }
    
    // Lending rate arbitrage
    const lendingOpps = await this.findLendingArbitrageOpportunities();
    opportunities.push(...lendingOpps);
    
    return opportunities.filter(opp => opp.profitEstimate.gt(opp.gasEstimate));
  }
}
```

This protocol integration layer provides comprehensive connectivity to the Sei DeFi ecosystem while maintaining modularity, security, and optimal performance.