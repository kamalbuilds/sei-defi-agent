import { SeiAgentKit } from '../../../sei-agent-kit/src/agent';
import { Address } from 'viem';
import { Wallet } from 'ethers';
import { EventEmitter } from 'events';
import { Agent, AgentMessage, AgentType } from '../../types';
import { Logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ArbitrageConfig {
  id?: string;
  name?: string;
  privateKey?: string;
  mnemonic?: string;
  minProfitThreshold: number; // Minimum profit percentage (e.g., 0.01 = 1%)
  maxSlippage: number; // Maximum slippage tolerance (e.g., 0.03 = 3%)
  maxPositionSize: string; // Maximum position size in SEI
  monitoredPairs: string[]; // Pairs to monitor ['WSEI/USDC', 'USDC/USDT']
  executionDelay: number; // MEV protection delay in ms
}

export interface ArbitrageOpportunity {
  id: string;
  path: string[];
  protocols: string[];
  profitEstimate: string;
  profitPercentage: number;
  confidence: number;
  timestamp: number;
}

export class ArbitrageHunterV2 extends EventEmitter implements Agent {
  public readonly id: string;
  public readonly name: string;
  public readonly type = AgentType.ARBITRAGE;
  public status: 'idle' | 'busy' | 'error' = 'idle';
  public config: ArbitrageConfig;
  
  private seiKit: SeiAgentKit;
  private logger: Logger;
  private activeOpportunities: Map<string, ArbitrageOpportunity> = new Map();
  private executionHistory: any[] = [];
  
  // Performance tracking
  public performanceMetrics = {
    tasksCompleted: 0,
    averageLatency: 0,
    errorRate: 0,
    efficiency: 1.0,
    profitGenerated: '0',
    successfulArbitrages: 0
  };

  constructor(config: ArbitrageConfig) {
    super();
    this.id = config.id || `arb_${uuidv4()}`;
    this.name = config.name || 'Arbitrage Hunter V2';
    this.config = config;
    this.logger = new Logger(`ArbitrageHunterV2:${this.name}`);

    // Initialize SEI Agent Kit
    let privateKey = config.privateKey;
    if (!privateKey && config.mnemonic) {
      const wallet = Wallet.fromMnemonic(config.mnemonic);
      privateKey = wallet.privateKey;
    }
    
    if (!privateKey) {
      throw new Error('Private key or mnemonic required for Arbitrage Hunter');
    }

    this.seiKit = new SeiAgentKit(privateKey, 'openai');
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.name}`);
    
    try {
      // Check wallet balance
      const balance = await this.seiKit.getERC20Balance();
      this.logger.info(`Wallet ${this.seiKit.wallet_address}: ${balance} SEI`);
      
      // Check WSEI balance
      const wseiAddress = '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7' as Address;
      const wseiBalance = await this.seiKit.getERC20Balance(wseiAddress);
      this.logger.info(`WSEI Balance: ${wseiBalance}`);
      
      // Check USDC balance
      const usdcAddress = '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392' as Address;
      const usdcBalance = await this.seiKit.getERC20Balance(usdcAddress);
      this.logger.info(`USDC Balance: ${usdcBalance}`);
      
      this.status = 'idle';
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Initialization failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  async scanForOpportunities(): Promise<ArbitrageOpportunity[]> {
    this.status = 'busy';
    const opportunities: ArbitrageOpportunity[] = [];
    
    try {
      this.logger.info('Scanning for arbitrage opportunities...');
      
      // Check triangular arbitrage: WSEI -> USDC -> USDT -> WSEI
      const triangularOpp = await this.checkTriangularArbitrage();
      if (triangularOpp) {
        opportunities.push(triangularOpp);
      }
      
      // Check cross-protocol arbitrage
      const crossProtocolOpp = await this.checkCrossProtocolArbitrage();
      if (crossProtocolOpp) {
        opportunities.push(crossProtocolOpp);
      }
      
      // Store opportunities
      opportunities.forEach(opp => {
        this.activeOpportunities.set(opp.id, opp);
      });
      
      this.logger.info(`Found ${opportunities.length} opportunities`);
      this.status = 'idle';
      return opportunities;
      
    } catch (error) {
      this.logger.error('Scan failed:', error);
      this.status = 'error';
      return opportunities;
    }
  }

  private async checkTriangularArbitrage(): Promise<ArbitrageOpportunity | null> {
    try {
      // This would check actual prices across different paths
      // For now, return a simulated opportunity
      
      const opportunity: ArbitrageOpportunity = {
        id: uuidv4(),
        path: ['WSEI', 'USDC', 'USDT', 'WSEI'],
        protocols: ['Symphony'],
        profitEstimate: '0.05',
        profitPercentage: 0.5,
        confidence: 0.7,
        timestamp: Date.now()
      };
      
      // Only return if profit meets threshold
      if (opportunity.profitPercentage >= this.config.minProfitThreshold) {
        this.logger.info(`Triangular opportunity found: ${opportunity.profitPercentage}% profit`);
        return opportunity;
      }
      
    } catch (error) {
      this.logger.error('Triangular arbitrage check failed:', error);
    }
    
    return null;
  }

  private async checkCrossProtocolArbitrage(): Promise<ArbitrageOpportunity | null> {
    try {
      // Check price differences between protocols
      // For example: Buy on Symphony, sell on Takara
      
      const opportunity: ArbitrageOpportunity = {
        id: uuidv4(),
        path: ['USDC', 'WSEI'],
        protocols: ['Symphony', 'Takara'],
        profitEstimate: '0.03',
        profitPercentage: 0.3,
        confidence: 0.6,
        timestamp: Date.now()
      };
      
      if (opportunity.profitPercentage >= this.config.minProfitThreshold) {
        this.logger.info(`Cross-protocol opportunity found: ${opportunity.profitPercentage}% profit`);
        return opportunity;
      }
      
    } catch (error) {
      this.logger.error('Cross-protocol arbitrage check failed:', error);
    }
    
    return null;
  }

  async executeArbitrage(opportunityId: string): Promise<string> {
    this.status = 'busy';
    
    try {
      const opportunity = this.activeOpportunities.get(opportunityId);
      if (!opportunity) {
        throw new Error(`Opportunity ${opportunityId} not found`);
      }
      
      this.logger.info(`Executing arbitrage: ${opportunity.path.join(' -> ')}`);
      
      // MEV protection delay
      if (this.config.executionDelay > 0) {
        await this.sleep(this.config.executionDelay);
      }
      
      // Execute the arbitrage path
      let result: any;
      
      if (opportunity.path.length === 4) {
        // Triangular arbitrage
        result = await this.executeTriangularArbitrage(opportunity);
      } else {
        // Cross-protocol arbitrage
        result = await this.executeCrossProtocolArbitrage(opportunity);
      }
      
      // Update metrics
      this.performanceMetrics.successfulArbitrages++;
      this.performanceMetrics.profitGenerated = (
        parseFloat(this.performanceMetrics.profitGenerated) + 
        parseFloat(opportunity.profitEstimate)
      ).toString();
      
      // Store in history
      this.executionHistory.push({
        opportunity,
        result,
        timestamp: Date.now()
      });
      
      this.status = 'idle';
      this.emit('arbitrage-executed', { opportunity, result });
      
      return result;
      
    } catch (error) {
      this.logger.error('Arbitrage execution failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  private async executeTriangularArbitrage(opportunity: ArbitrageOpportunity): Promise<any> {
    const path = opportunity.path;
    const results = [];
    
    // Execute each swap in the path
    for (let i = 0; i < path.length - 1; i++) {
      const tokenIn = path[i];
      const tokenOut = path[i + 1];
      
      // Get token addresses
      const tokenInAddress = this.getTokenAddress(tokenIn);
      const tokenOutAddress = this.getTokenAddress(tokenOut);
      
      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error(`Invalid token in path: ${tokenIn} -> ${tokenOut}`);
      }
      
      // Execute swap via Symphony
      this.logger.info(`Swapping ${tokenIn} -> ${tokenOut}`);
      const swapResult = await this.seiKit.swap(
        '0.1', // Amount (should be calculated based on opportunity)
        tokenInAddress,
        tokenOutAddress
      );
      
      results.push(swapResult);
    }
    
    return { success: true, swaps: results };
  }

  private async executeCrossProtocolArbitrage(opportunity: ArbitrageOpportunity): Promise<any> {
    // This would execute buys on one protocol and sells on another
    // For now, return simulated result
    return {
      success: true,
      buyProtocol: opportunity.protocols[0],
      sellProtocol: opportunity.protocols[1],
      profit: opportunity.profitEstimate
    };
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
        case 'scan':
          return await this.scanForOpportunities();
        
        case 'execute':
          const { opportunityId } = message.payload;
          return await this.executeArbitrage(opportunityId);
        
        case 'status':
          return {
            status: this.status,
            activeOpportunities: Array.from(this.activeOpportunities.values()),
            metrics: this.performanceMetrics
          };
        
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
      type: task.action || 'scan',
      payload: task,
      timestamp: new Date(),
      status: 'pending'
    };
    
    return this.handleMessage(message);
  }

  async shutdown(): Promise<void> {
    this.logger.info(`Shutting down ${this.name}`);
    this.activeOpportunities.clear();
    this.status = 'idle';
    this.emit('shutdown');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Getters for Agent interface
  get capabilities(): string[] {
    return ['arbitrage', 'mev_protection', 'cross_protocol', 'triangular_arbitrage'];
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