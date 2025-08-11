import { SeiAgentKit } from '../../../sei-agent-kit/src/agent';
import { Address } from 'viem';
import { Wallet } from 'ethers';
import { EventEmitter } from 'events';
import { Agent, AgentMessage, AgentType } from '../../types';
import { Logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface PortfolioConfig {
  id?: string;
  name?: string;
  privateKey?: string;
  mnemonic?: string;
  rebalanceThreshold: number; // Rebalance when allocation drifts by this %
  targetAllocations: {
    [token: string]: number; // e.g., { 'WSEI': 0.4, 'USDC': 0.3, 'USDT': 0.3 }
  };
  riskTolerance: 'low' | 'medium' | 'high';
  autoCompound: boolean;
  minPositionSize: string; // Minimum position size in USD
}

export interface PortfolioPosition {
  token: string;
  balance: string;
  value: string; // In USD
  allocation: number; // Current %
  targetAllocation: number; // Target %
  drift: number; // Difference from target
}

export interface PortfolioMetrics {
  totalValue: string;
  dailyPnL: string;
  weeklyPnL: string;
  sharpeRatio: number;
  positions: PortfolioPosition[];
}

export class PortfolioManagerV2 extends EventEmitter implements Agent {
  public readonly id: string;
  public readonly name: string;
  public readonly type = AgentType.PORTFOLIO;
  public status: 'idle' | 'busy' | 'error' = 'idle';
  public config: PortfolioConfig;
  
  private seiKit: SeiAgentKit;
  private logger: Logger;
  private positions: Map<string, PortfolioPosition> = new Map();
  private historicalData: any[] = [];
  
  // Performance tracking
  public performanceMetrics = {
    tasksCompleted: 0,
    averageLatency: 0,
    errorRate: 0,
    efficiency: 1.0,
    totalValue: '0',
    rebalanceCount: 0
  };

  constructor(config: PortfolioConfig) {
    super();
    this.id = config.id || `portfolio_${uuidv4()}`;
    this.name = config.name || 'Portfolio Manager V2';
    this.config = config;
    this.logger = new Logger(`PortfolioManagerV2:${this.name}`);

    // Initialize SEI Agent Kit
    let privateKey = config.privateKey;
    if (!privateKey && config.mnemonic) {
      const wallet = Wallet.fromMnemonic(config.mnemonic);
      privateKey = wallet.privateKey;
    }
    
    if (!privateKey) {
      throw new Error('Private key or mnemonic required for Portfolio Manager');
    }

    this.seiKit = new SeiAgentKit(privateKey, 'openai');
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.name}`);
    
    try {
      // Check wallet balance
      const balance = await this.seiKit.getERC20Balance();
      this.logger.info(`Wallet ${this.seiKit.wallet_address}: ${balance} SEI`);
      
      // Load current positions
      await this.loadPositions();
      
      this.status = 'idle';
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Initialization failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  private async loadPositions(): Promise<void> {
    this.positions.clear();
    
    // Token addresses
    const tokens = {
      'SEI': null, // Native token
      'WSEI': '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7' as Address,
      'USDC': '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392' as Address,
    };
    
    let totalValue = 0;
    
    for (const [symbol, address] of Object.entries(tokens)) {
      try {
        const balance = address ? 
          await this.seiKit.getERC20Balance(address) :
          await this.seiKit.getERC20Balance(); // Native SEI
        
        if (parseFloat(balance) > 0) {
          const value = this.calculateValue(symbol, balance);
          const position: PortfolioPosition = {
            token: symbol,
            balance,
            value: value.toString(),
            allocation: 0, // Will calculate after all positions loaded
            targetAllocation: this.config.targetAllocations[symbol] || 0,
            drift: 0
          };
          
          this.positions.set(symbol, position);
          totalValue += value;
        }
      } catch (error) {
        this.logger.warn(`Failed to load ${symbol} balance:`, error);
      }
    }
    
    // Calculate actual allocations and drift
    for (const position of this.positions.values()) {
      position.allocation = totalValue > 0 ? 
        (parseFloat(position.value) / totalValue) : 0;
      position.drift = position.allocation - position.targetAllocation;
    }
    
    this.performanceMetrics.totalValue = totalValue.toString();
    this.logger.info(`Portfolio loaded: ${this.positions.size} positions, $${totalValue.toFixed(2)} total value`);
  }

  private calculateValue(token: string, balance: string): number {
    // Mock prices - in production, fetch from price oracle
    const prices: { [key: string]: number } = {
      'SEI': 0.5,
      'WSEI': 0.5,
      'USDC': 1.0,
      'USDT': 1.0,
    };
    
    const price = prices[token] || 0;
    return parseFloat(balance) * price;
  }

  async getPortfolioMetrics(): Promise<PortfolioMetrics> {
    await this.loadPositions();
    
    const positions = Array.from(this.positions.values());
    const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.value), 0);
    
    return {
      totalValue: totalValue.toString(),
      dailyPnL: '0', // Would calculate from historical data
      weeklyPnL: '0', // Would calculate from historical data
      sharpeRatio: 0, // Would calculate from returns volatility
      positions
    };
  }

  async rebalance(): Promise<any> {
    this.status = 'busy';
    
    try {
      this.logger.info('Starting portfolio rebalance...');
      
      await this.loadPositions();
      
      const rebalanceActions = [];
      const positions = Array.from(this.positions.values());
      
      // Find positions that need rebalancing
      for (const position of positions) {
        if (Math.abs(position.drift) > this.config.rebalanceThreshold) {
          this.logger.info(`${position.token} needs rebalancing: ${(position.drift * 100).toFixed(2)}% drift`);
          
          // Calculate required action
          const action = await this.calculateRebalanceAction(position);
          if (action) {
            rebalanceActions.push(action);
          }
        }
      }
      
      // Execute rebalance actions
      const results = [];
      for (const action of rebalanceActions) {
        try {
          const result = await this.executeRebalanceAction(action);
          results.push(result);
        } catch (error) {
          this.logger.error(`Rebalance action failed:`, error);
        }
      }
      
      // Update metrics
      this.performanceMetrics.rebalanceCount++;
      
      this.status = 'idle';
      this.emit('rebalanced', { actions: rebalanceActions, results });
      
      return {
        success: true,
        actionsExecuted: rebalanceActions.length,
        results
      };
      
    } catch (error) {
      this.logger.error('Rebalance failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  private async calculateRebalanceAction(position: PortfolioPosition): Promise<any> {
    const totalValue = parseFloat(this.performanceMetrics.totalValue);
    const targetValue = totalValue * position.targetAllocation;
    const currentValue = parseFloat(position.value);
    const difference = targetValue - currentValue;
    
    if (Math.abs(difference) < parseFloat(this.config.minPositionSize)) {
      return null; // Too small to rebalance
    }
    
    if (difference > 0) {
      // Need to buy more of this token
      return {
        type: 'buy',
        token: position.token,
        amount: Math.abs(difference),
        fromToken: 'USDC' // Assume we sell USDC to buy other tokens
      };
    } else {
      // Need to sell some of this token
      return {
        type: 'sell',
        token: position.token,
        amount: Math.abs(difference),
        toToken: 'USDC' // Assume we convert to USDC
      };
    }
  }

  private async executeRebalanceAction(action: any): Promise<any> {
    if (action.type === 'buy') {
      // Buy token using Symphony swap
      const fromAddress = this.getTokenAddress(action.fromToken);
      const toAddress = this.getTokenAddress(action.token);
      
      if (fromAddress && toAddress) {
        const result = await this.seiKit.swap(
          action.amount.toString(),
          fromAddress,
          toAddress
        );
        return { action, result };
      }
    } else {
      // Sell token using Symphony swap
      const fromAddress = this.getTokenAddress(action.token);
      const toAddress = this.getTokenAddress(action.toToken);
      
      if (fromAddress && toAddress) {
        const result = await this.seiKit.swap(
          action.amount.toString(),
          fromAddress,
          toAddress
        );
        return { action, result };
      }
    }
    
    return null;
  }

  async compound(): Promise<any> {
    if (!this.config.autoCompound) {
      return { success: false, message: 'Auto-compound is disabled' };
    }
    
    this.status = 'busy';
    
    try {
      this.logger.info('Compounding yields...');
      
      // Check for yield farming positions
      // For Takara lending
      const takaraYields = await this.collectTakaraYields();
      
      // Reinvest collected yields
      const results = [];
      if (takaraYields > 0) {
        // Reinvest into Takara or swap to target allocations
        const reinvestResult = await this.reinvestYields(takaraYields);
        results.push(reinvestResult);
      }
      
      this.status = 'idle';
      return { success: true, results };
      
    } catch (error) {
      this.logger.error('Compound failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  private async collectTakaraYields(): Promise<number> {
    try {
      // Check Takara lending positions for yields
      const redeemable = await this.seiKit.getRedeemableAmount('USDC');
      return parseFloat(redeemable.underlyingAmount || '0');
    } catch (error) {
      this.logger.warn('Failed to collect Takara yields:', error);
      return 0;
    }
  }

  private async reinvestYields(amount: number): Promise<any> {
    // Reinvest yields according to target allocations
    this.logger.info(`Reinvesting ${amount} in yields`);
    
    // For simplicity, mint more Takara tTokens
    try {
      const result = await this.seiKit.mintTakara('USDC', amount.toString());
      return { protocol: 'Takara', action: 'mint', amount, result };
    } catch (error) {
      this.logger.error('Reinvestment failed:', error);
      return { protocol: 'Takara', action: 'mint', amount, error: error.message };
    }
  }

  private getTokenAddress(symbol: string): Address | null {
    const addresses: { [key: string]: Address } = {
      'WSEI': '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7' as Address,
      'USDC': '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392' as Address,
      'USDT': '0xB75D0B03c06A926e488e2659DF1A861F860bD3d1' as Address,
    };
    
    return addresses[symbol] || null;
  }

  async handleMessage(message: AgentMessage): Promise<any> {
    this.status = 'busy';
    
    try {
      switch (message.type) {
        case 'get_portfolio':
          return await this.getPortfolioMetrics();
        
        case 'rebalance':
          return await this.rebalance();
        
        case 'compound':
          return await this.compound();
        
        case 'update_allocations':
          this.config.targetAllocations = message.payload.allocations;
          return { success: true, allocations: this.config.targetAllocations };
        
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
      this.status = 'error';
      throw error;
    }
  }

  async execute(task: any): Promise<any> {
    const message: AgentMessage = {
      id: uuidv4(),
      agentId: this.id,
      type: task.action || 'get_portfolio',
      payload: task,
      timestamp: new Date(),
      status: 'pending'
    };
    
    return this.handleMessage(message);
  }

  async shutdown(): Promise<void> {
    this.logger.info(`Shutting down ${this.name}`);
    this.positions.clear();
    this.status = 'idle';
    this.emit('shutdown');
  }

  // Getters for Agent interface
  get capabilities(): string[] {
    return ['portfolio_management', 'rebalancing', 'yield_farming', 'auto_compound', 'risk_management'];
  }

  get lastHeartbeat(): Date {
    return new Date();
  }

  get createdAt(): number {
    return Date.now();
  }

  get resources(): any {
    return {
      wallet: this.seiKit.wallet_address,
      protocols: ['Symphony', 'Takara', 'Citrex', 'Silo']
    };
  }
}