import { SeiAgentKit } from '../../../sei-agent-kit/src/agent';
import { Address } from 'viem';
import { Wallet } from 'ethers';
import { Logger } from '../utils/logger';
import { Agent, AgentConfig, AgentMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface DeFiAgentConfig extends AgentConfig {
  privateKey?: string;
  mnemonic?: string;
  modelProvider?: string;
}

export class DeFiAgent implements Agent {
  public id: string;
  public name: string;
  public type: string;
  public config: DeFiAgentConfig;
  public status: 'idle' | 'busy' | 'error';
  
  private seiKit: SeiAgentKit;
  private logger: Logger;
  private messageHandlers: Map<string, (msg: AgentMessage) => Promise<void>>;

  constructor(config: DeFiAgentConfig) {
    this.id = config.id || `agent_${uuidv4()}`;
    this.name = config.name || 'DeFi Agent';
    this.type = config.type || 'defi';
    this.config = config;
    this.status = 'idle';
    this.logger = new Logger(`DeFiAgent:${this.name}`);
    this.messageHandlers = new Map();

    // Initialize SEI Agent Kit
    let privateKey = config.privateKey;
    if (!privateKey && config.mnemonic) {
      const wallet = Wallet.fromMnemonic(config.mnemonic);
      privateKey = wallet.privateKey;
    }
    
    if (!privateKey) {
      throw new Error('Private key or mnemonic required for DeFi agent');
    }

    this.seiKit = new SeiAgentKit(
      privateKey,
      config.modelProvider || 'openai'
    );

    this.initializeHandlers();
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.name}`);
    
    // Check wallet balance
    const balance = await this.seiKit.getERC20Balance();
    this.logger.info(`Wallet ${this.seiKit.wallet_address}: ${balance} SEI`);
    
    this.status = 'idle';
  }

  private initializeHandlers(): void {
    // Balance check handler
    this.messageHandlers.set('check_balance', async (msg) => {
      const ticker = msg.payload?.ticker;
      if (ticker && ticker !== 'SEI') {
        const tokenAddress = await this.seiKit.getTokenAddressFromTicker(ticker);
        if (tokenAddress) {
          const balance = await this.seiKit.getERC20Balance(tokenAddress as Address);
          this.logger.info(`${ticker} Balance: ${balance}`);
          return { balance, ticker };
        }
      } else {
        const balance = await this.seiKit.getERC20Balance();
        this.logger.info(`SEI Balance: ${balance}`);
        return { balance, ticker: 'SEI' };
      }
    });

    // Swap handler using Symphony
    this.messageHandlers.set('swap', async (msg) => {
      const { amount, tokenIn, tokenOut } = msg.payload;
      
      try {
        // Get token addresses
        const tokenInAddress = tokenIn === 'SEI' ? 
          '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7' as Address : // WSEI
          tokenIn === 'WSEI' ?
          '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7' as Address :
          await this.seiKit.getTokenAddressFromTicker(tokenIn) as Address;
        
        const tokenOutAddress = tokenOut === 'USDC' ?
          '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392' as Address : // USDC mainnet
          await this.seiKit.getTokenAddressFromTicker(tokenOut) as Address;
        
        if (!tokenInAddress || !tokenOutAddress) {
          throw new Error(`Invalid tokens: ${tokenIn} -> ${tokenOut}`);
        }
        
        this.logger.info(`Swapping ${amount} ${tokenIn} -> ${tokenOut} via Symphony`);
        const result = await this.seiKit.swap(amount, tokenInAddress, tokenOutAddress);
        this.logger.info(`Swap ${amount} ${tokenIn} -> ${tokenOut}: ${result}`);
        return result;
      } catch (error: any) {
        this.logger.error(`Swap failed: ${error.message}`);
        // Fallback message if Symphony fails
        if (error.message.includes('HTML') || error.message.includes('JSON')) {
          this.logger.warn('Symphony API issue detected. Try using DragonSwap web interface.');
          return {
            status: 'error',
            message: 'Symphony API temporarily unavailable. Use https://app.dragonswap.app',
            error: error.message
          };
        }
        throw error;
      }
    });

    // Takara lending/borrowing handlers
    this.messageHandlers.set('takara_mint', async (msg) => {
      const { ticker, amount } = msg.payload;
      const result = await this.seiKit.mintTakara(ticker, amount);
      this.logger.info(`Takara mint ${amount} ${ticker}: ${JSON.stringify(result)}`);
      return result;
    });

    this.messageHandlers.set('takara_borrow', async (msg) => {
      const { ticker, amount } = msg.payload;
      const result = await this.seiKit.borrowTakara(ticker, amount);
      this.logger.info(`Takara borrow ${amount} ${ticker}: ${JSON.stringify(result)}`);
      return result;
    });

    this.messageHandlers.set('takara_repay', async (msg) => {
      const { ticker, amount } = msg.payload;
      const result = await this.seiKit.repayTakara(ticker, amount);
      this.logger.info(`Takara repay ${amount} ${ticker}: ${JSON.stringify(result)}`);
      return result;
    });

    this.messageHandlers.set('takara_redeem', async (msg) => {
      const { ticker, amount, type } = msg.payload;
      const result = await this.seiKit.redeemTakara(ticker, amount, type);
      this.logger.info(`Takara redeem ${amount} ${ticker}: ${JSON.stringify(result)}`);
      return result;
    });

    // Citrex derivatives trading handlers
    this.messageHandlers.set('citrex_deposit', async (msg) => {
      const { amount } = msg.payload;
      const result = await this.seiKit.citrexDeposit(amount);
      this.logger.info(`Citrex deposit ${amount} USDC: ${result}`);
      return result;
    });

    this.messageHandlers.set('citrex_withdraw', async (msg) => {
      const { amount } = msg.payload;
      const result = await this.seiKit.citrexWithdraw(amount);
      this.logger.info(`Citrex withdraw ${amount} USDC: ${result}`);
      return result;
    });

    this.messageHandlers.set('citrex_place_order', async (msg) => {
      const orderArgs = msg.payload;
      const result = await this.seiKit.citrexPlaceOrder(orderArgs);
      this.logger.info(`Citrex place order: ${JSON.stringify(result)}`);
      return result;
    });

    this.messageHandlers.set('citrex_get_positions', async (msg) => {
      const { symbol } = msg.payload || {};
      const result = await this.seiKit.citrexListPositions(symbol);
      this.logger.info(`Citrex positions: ${result}`);
      return result;
    });

    // Transfer handler
    this.messageHandlers.set('transfer', async (msg) => {
      const { amount, recipient, ticker } = msg.payload;
      const result = await this.seiKit.ERC20Transfer(amount, recipient as Address, ticker);
      this.logger.info(`Transfer ${amount} ${ticker || 'SEI'} to ${recipient}: ${result}`);
      return result;
    });

    // Staking handlers
    this.messageHandlers.set('stake', async (msg) => {
      const { amount } = msg.payload;
      const result = await this.seiKit.stake(amount);
      this.logger.info(`Stake ${amount} SEI: ${result}`);
      return result;
    });

    this.messageHandlers.set('unstake', async (msg) => {
      const { amount } = msg.payload;
      const result = await this.seiKit.unstake(amount);
      this.logger.info(`Unstake ${amount} SEI: ${result}`);
      return result;
    });
  }

  async handleMessage(message: AgentMessage): Promise<any> {
    this.status = 'busy';
    
    try {
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        const result = await handler(message);
        this.status = 'idle';
        return result;
      } else {
        this.logger.warn(`No handler for message type: ${message.type}`);
        this.status = 'idle';
        return null;
      }
    } catch (error) {
      this.logger.error(`Error handling message: ${error}`);
      this.status = 'error';
      throw error;
    }
  }

  async execute(task: any): Promise<any> {
    const message: AgentMessage = {
      id: uuidv4(),
      agentId: this.id,
      type: task.action || 'execute',
      payload: task,
      timestamp: new Date(),
      status: 'pending'
    };
    
    return this.handleMessage(message);
  }

  async shutdown(): Promise<void> {
    this.logger.info(`Shutting down ${this.name}`);
    this.status = 'idle';
  }

  // Utility methods for specific DeFi operations
  async getPortfolioValue(): Promise<{
    totalValue: number;
    positions: Array<{
      token: string;
      balance: string;
      value?: number;
    }>;
  }> {
    const positions = [];
    
    // Get SEI balance
    const seiBalance = await this.seiKit.getERC20Balance();
    positions.push({
      token: 'SEI',
      balance: seiBalance,
      value: parseFloat(seiBalance) * 0.5 // Mock price
    });
    
    // Get common token balances
    const tokens = ['USDC', 'USDT', 'WETH'];
    for (const ticker of tokens) {
      try {
        const address = await this.seiKit.getTokenAddressFromTicker(ticker);
        if (address) {
          const balance = await this.seiKit.getERC20Balance(address as Address);
          if (parseFloat(balance) > 0) {
            positions.push({
              token: ticker,
              balance,
              value: parseFloat(balance) // Assume 1:1 for stablecoins
            });
          }
        }
      } catch (error) {
        // Token might not exist on this network
      }
    }
    
    const totalValue = positions.reduce((sum, pos) => sum + (pos.value || 0), 0);
    
    return { totalValue, positions };
  }

  async findArbitrage(): Promise<Array<{
    path: string[];
    profit: number;
    protocol: string;
  }>> {
    // This would use multiple protocols to find arbitrage
    // For now, return mock data
    return [{
      path: ['SEI', 'USDC', 'USDT', 'SEI'],
      profit: 0.05,
      protocol: 'Symphony'
    }];
  }

  async executeArbitrage(opportunity: any): Promise<string> {
    // Execute arbitrage trade
    this.logger.info(`Executing arbitrage: ${JSON.stringify(opportunity)}`);
    
    // This would execute the actual trades
    // For now, return mock transaction
    return '0x' + '0'.repeat(64);
  }
}

// Specialized DeFi Agents
export class ArbitrageAgent extends DeFiAgent {
  constructor(config: DeFiAgentConfig) {
    super({
      ...config,
      type: 'arbitrage',
      name: config.name || 'Arbitrage Hunter'
    });
  }

  async scan(): Promise<any[]> {
    return this.findArbitrage();
  }
}

export class LiquidityProviderAgent extends DeFiAgent {
  constructor(config: DeFiAgentConfig) {
    super({
      ...config,
      type: 'liquidity',
      name: config.name || 'Liquidity Provider'
    });
  }

  async provideLiquidity(tokenA: string, tokenB: string, amountA: string, amountB: string): Promise<string> {
    // This would add liquidity to a DEX
    this.logger.info(`Providing liquidity: ${amountA} ${tokenA} + ${amountB} ${tokenB}`);
    return '0x' + '0'.repeat(64);
  }
}

export class YieldFarmingAgent extends DeFiAgent {
  constructor(config: DeFiAgentConfig) {
    super({
      ...config,
      type: 'yield',
      name: config.name || 'Yield Farmer'
    });
  }

  async stakeLiquidity(lpToken: string, amount: string): Promise<string> {
    // This would stake LP tokens in a farm
    this.logger.info(`Staking ${amount} LP tokens`);
    return '0x' + '0'.repeat(64);
  }
}

export class RiskManagementAgent extends DeFiAgent {
  constructor(config: DeFiAgentConfig) {
    super({
      ...config,
      type: 'risk',
      name: config.name || 'Risk Guardian'
    });
  }

  async assessRisk(position: any): Promise<{
    riskScore: number;
    recommendations: string[];
  }> {
    // Assess risk of a position
    return {
      riskScore: 0.3,
      recommendations: ['Consider reducing exposure', 'Add hedging position']
    };
  }
}