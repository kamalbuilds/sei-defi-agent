import { ethers, Contract, Wallet } from 'ethers';
import { Logger } from '../utils/logger';
import { Agent, AgentConfig, AgentMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';

// DragonSwap contract addresses on SEI (checksummed)
const DRAGONSWAP_CONTRACTS = {
  ROUTER: '0x4178ee437d3a07f4287e36870e9c63db6e68a1a0', // DragonSwap V2 Router on SEI (lowercase for now)
  FACTORY: '0x5c93c8f67b82b1ba914d06a60c0ade16cb62a59d', // DragonSwap V2 Factory on SEI (lowercase for now)
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7', // Wrapped SEI
};

// Token addresses (use the ones we know exist on testnet)
const TOKENS: { [key: string]: string } = {
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7',
  USDC: '0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392', // This is the USDC we found earlier
  USDT: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
};

// DragonSwap Router ABI (Uniswap V2 compatible)
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)',
  'function factory() external pure returns (address)',
  'function WETH() external pure returns (address)',
];

// ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

// Factory ABI
const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)',
];

export interface DragonSwapAgentConfig extends AgentConfig {
  privateKey?: string;
  mnemonic?: string;
  slippageTolerance?: number; // Default 3%
  gasLimit?: string;
}

export class DragonSwapAgent implements Agent {
  public id: string;
  public name: string;
  public type: string;
  public config: DragonSwapAgentConfig;
  public status: 'idle' | 'busy' | 'error';
  
  private wallet: Wallet;
  private provider: ethers.providers.JsonRpcProvider;
  private routerContract: Contract;
  private factoryContract: Contract;
  private logger: Logger;
  private slippageTolerance: number;

  constructor(config: DragonSwapAgentConfig) {
    this.id = config.id || `agent_${uuidv4()}`;
    this.name = config.name || 'DragonSwap Agent';
    this.type = config.type || 'dragonswap';
    this.config = config;
    this.status = 'idle';
    this.logger = new Logger(`DragonSwapAgent:${this.name}`);
    this.slippageTolerance = config.slippageTolerance || 0.03; // 3% default

    // Setup provider
    const rpcUrl = process.env.SEI_RPC_URL || 'https://sei.drpc.org';
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // Setup wallet
    let privateKey = config.privateKey;
    if (!privateKey && config.mnemonic) {
      const wallet = Wallet.fromMnemonic(config.mnemonic);
      privateKey = wallet.privateKey;
    }
    
    if (!privateKey && process.env.SEI_MNEMONIC) {
      const wallet = Wallet.fromMnemonic(process.env.SEI_MNEMONIC);
      privateKey = wallet.privateKey;
    }
    
    if (!privateKey) {
      throw new Error('Private key or mnemonic required for DragonSwap agent');
    }

    this.wallet = new Wallet(privateKey, this.provider);
    
    // Setup contracts
    this.routerContract = new Contract(
      DRAGONSWAP_CONTRACTS.ROUTER,
      ROUTER_ABI,
      this.wallet
    );
    
    this.factoryContract = new Contract(
      DRAGONSWAP_CONTRACTS.FACTORY,
      FACTORY_ABI,
      this.provider
    );
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.name}`);
    
    try {
      // Check if contracts exist
      const routerCode = await this.provider.getCode(DRAGONSWAP_CONTRACTS.ROUTER);
      const factoryCode = await this.provider.getCode(DRAGONSWAP_CONTRACTS.FACTORY);
      
      if (routerCode === '0x') {
        this.logger.warn(`DragonSwap Router not found at ${DRAGONSWAP_CONTRACTS.ROUTER}`);
      } else {
        this.logger.info(`✅ DragonSwap Router found at ${DRAGONSWAP_CONTRACTS.ROUTER}`);
      }
      
      if (factoryCode === '0x') {
        this.logger.warn(`DragonSwap Factory not found at ${DRAGONSWAP_CONTRACTS.FACTORY}`);
      } else {
        this.logger.info(`✅ DragonSwap Factory found at ${DRAGONSWAP_CONTRACTS.FACTORY}`);
      }
      
      // Check wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      this.logger.info(`Wallet ${this.wallet.address}: ${ethers.utils.formatEther(balance)} SEI`);
      
      // Check WSEI balance
      const wseiContract = new Contract(DRAGONSWAP_CONTRACTS.WSEI, ERC20_ABI, this.provider);
      const wseiBalance = await wseiContract.balanceOf(this.wallet.address);
      this.logger.info(`WSEI Balance: ${ethers.utils.formatEther(wseiBalance)}`);
      
      this.status = 'idle';
    } catch (error) {
      this.logger.error('Initialization failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  async swapTokens(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut?: string
  ): Promise<string> {
    this.status = 'busy';
    
    try {
      this.logger.info(`Swapping ${amountIn} ${tokenIn} -> ${tokenOut}`);
      
      // Get token addresses
      const tokenInAddress = this.getTokenAddress(tokenIn);
      const tokenOutAddress = this.getTokenAddress(tokenOut);
      
      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error(`Invalid tokens: ${tokenIn} -> ${tokenOut}`);
      }
      
      // Get token contracts
      const tokenInContract = new Contract(tokenInAddress, ERC20_ABI, this.wallet);
      const decimalsIn = await tokenInContract.decimals();
      const amountInWei = ethers.utils.parseUnits(amountIn, decimalsIn);
      
      // Build path
      const path = await this.getOptimalPath(tokenInAddress, tokenOutAddress);
      this.logger.info(`Using path: ${path.join(' -> ')}`);
      
      // Get expected output
      const amountsOut = await this.routerContract.getAmountsOut(amountInWei, path);
      const expectedOut = amountsOut[amountsOut.length - 1];
      this.logger.info(`Expected output: ${ethers.utils.formatEther(expectedOut)}`);
      
      // Calculate minimum output with slippage
      const minOut = minAmountOut ? 
        ethers.utils.parseEther(minAmountOut) :
        expectedOut.mul(100 - Math.floor(this.slippageTolerance * 100)).div(100);
      
      // Check and set approval
      const currentAllowance = await tokenInContract.allowance(
        this.wallet.address,
        DRAGONSWAP_CONTRACTS.ROUTER
      );
      
      if (currentAllowance.lt(amountInWei)) {
        this.logger.info('Approving router to spend tokens...');
        const approveTx = await tokenInContract.approve(
          DRAGONSWAP_CONTRACTS.ROUTER,
          ethers.constants.MaxUint256
        );
        await approveTx.wait();
        this.logger.info('✅ Approval confirmed');
      }
      
      // Execute swap
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      
      this.logger.info('Executing swap...');
      const swapTx = await this.routerContract.swapExactTokensForTokens(
        amountInWei,
        minOut,
        path,
        this.wallet.address,
        deadline,
        {
          gasLimit: this.config.gasLimit || '500000'
        }
      );
      
      this.logger.info(`Swap transaction sent: ${swapTx.hash}`);
      const receipt = await swapTx.wait();
      
      this.logger.info(`✅ Swap confirmed in block ${receipt.blockNumber}`);
      this.status = 'idle';
      return swapTx.hash;
      
    } catch (error) {
      this.logger.error('Swap failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  async swapETHForTokens(
    tokenOut: string,
    amountIn: string,
    minAmountOut?: string
  ): Promise<string> {
    this.status = 'busy';
    
    try {
      this.logger.info(`Swapping ${amountIn} SEI -> ${tokenOut}`);
      
      const tokenOutAddress = this.getTokenAddress(tokenOut);
      if (!tokenOutAddress) {
        throw new Error(`Invalid token: ${tokenOut}`);
      }
      
      const amountInWei = ethers.utils.parseEther(amountIn);
      const path = [DRAGONSWAP_CONTRACTS.WSEI, tokenOutAddress];
      
      // Get expected output
      const amountsOut = await this.routerContract.getAmountsOut(amountInWei, path);
      const expectedOut = amountsOut[1];
      
      // Calculate minimum output with slippage
      const minOut = minAmountOut ? 
        ethers.utils.parseEther(minAmountOut) :
        expectedOut.mul(100 - Math.floor(this.slippageTolerance * 100)).div(100);
      
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      
      const swapTx = await this.routerContract.swapExactETHForTokens(
        minOut,
        path,
        this.wallet.address,
        deadline,
        {
          value: amountInWei,
          gasLimit: this.config.gasLimit || '500000'
        }
      );
      
      this.logger.info(`Swap transaction sent: ${swapTx.hash}`);
      const receipt = await swapTx.wait();
      
      this.logger.info(`✅ Swap confirmed in block ${receipt.blockNumber}`);
      this.status = 'idle';
      return swapTx.hash;
      
    } catch (error) {
      this.logger.error('ETH swap failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountA: string,
    amountB: string
  ): Promise<string> {
    this.status = 'busy';
    
    try {
      this.logger.info(`Adding liquidity: ${amountA} ${tokenA} + ${amountB} ${tokenB}`);
      
      const tokenAAddress = this.getTokenAddress(tokenA);
      const tokenBAddress = this.getTokenAddress(tokenB);
      
      if (!tokenAAddress || !tokenBAddress) {
        throw new Error(`Invalid tokens: ${tokenA}, ${tokenB}`);
      }
      
      // Get token contracts and parse amounts
      const tokenAContract = new Contract(tokenAAddress, ERC20_ABI, this.wallet);
      const tokenBContract = new Contract(tokenBAddress, ERC20_ABI, this.wallet);
      
      const decimalsA = await tokenAContract.decimals();
      const decimalsB = await tokenBContract.decimals();
      
      const amountAWei = ethers.utils.parseUnits(amountA, decimalsA);
      const amountBWei = ethers.utils.parseUnits(amountB, decimalsB);
      
      // Calculate minimum amounts with slippage
      const amountAMin = amountAWei.mul(100 - Math.floor(this.slippageTolerance * 100)).div(100);
      const amountBMin = amountBWei.mul(100 - Math.floor(this.slippageTolerance * 100)).div(100);
      
      // Approve both tokens
      await this.approveToken(tokenAAddress, DRAGONSWAP_CONTRACTS.ROUTER);
      await this.approveToken(tokenBAddress, DRAGONSWAP_CONTRACTS.ROUTER);
      
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      
      const addTx = await this.routerContract.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountAWei,
        amountBWei,
        amountAMin,
        amountBMin,
        this.wallet.address,
        deadline,
        {
          gasLimit: this.config.gasLimit || '500000'
        }
      );
      
      this.logger.info(`Add liquidity transaction sent: ${addTx.hash}`);
      const receipt = await addTx.wait();
      
      this.logger.info(`✅ Liquidity added in block ${receipt.blockNumber}`);
      this.status = 'idle';
      return addTx.hash;
      
    } catch (error) {
      this.logger.error('Add liquidity failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  async getPairInfo(tokenA: string, tokenB: string): Promise<any> {
    const tokenAAddress = this.getTokenAddress(tokenA);
    const tokenBAddress = this.getTokenAddress(tokenB);
    
    if (!tokenAAddress || !tokenBAddress) {
      throw new Error(`Invalid tokens: ${tokenA}, ${tokenB}`);
    }
    
    const pairAddress = await this.factoryContract.getPair(tokenAAddress, tokenBAddress);
    
    if (pairAddress === ethers.constants.AddressZero) {
      return { exists: false };
    }
    
    // Get pair contract
    const PAIR_ABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function totalSupply() external view returns (uint)',
    ];
    
    const pairContract = new Contract(pairAddress, PAIR_ABI, this.provider);
    const [reserves, token0, token1, totalSupply] = await Promise.all([
      pairContract.getReserves(),
      pairContract.token0(),
      pairContract.token1(),
      pairContract.totalSupply(),
    ]);
    
    return {
      exists: true,
      address: pairAddress,
      token0,
      token1,
      reserve0: reserves.reserve0.toString(),
      reserve1: reserves.reserve1.toString(),
      totalSupply: totalSupply.toString()
    };
  }

  private getTokenAddress(symbol: string): string | null {
    // Handle native SEI
    if (symbol.toUpperCase() === 'SEI') {
      return DRAGONSWAP_CONTRACTS.WSEI;
    }
    
    // Check known tokens
    return TOKENS[symbol.toUpperCase()] || null;
  }

  private async getOptimalPath(tokenIn: string, tokenOut: string): Promise<string[]> {
    // Direct path
    const directPair = await this.factoryContract.getPair(tokenIn, tokenOut);
    if (directPair !== ethers.constants.AddressZero) {
      return [tokenIn, tokenOut];
    }
    
    // Path through WSEI
    if (tokenIn !== DRAGONSWAP_CONTRACTS.WSEI && tokenOut !== DRAGONSWAP_CONTRACTS.WSEI) {
      const pairInWSEI = await this.factoryContract.getPair(tokenIn, DRAGONSWAP_CONTRACTS.WSEI);
      const pairOutWSEI = await this.factoryContract.getPair(DRAGONSWAP_CONTRACTS.WSEI, tokenOut);
      
      if (pairInWSEI !== ethers.constants.AddressZero && 
          pairOutWSEI !== ethers.constants.AddressZero) {
        return [tokenIn, DRAGONSWAP_CONTRACTS.WSEI, tokenOut];
      }
    }
    
    throw new Error(`No trading path found from ${tokenIn} to ${tokenOut}`);
  }

  private async approveToken(tokenAddress: string, spender: string): Promise<void> {
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.wallet);
    const currentAllowance = await tokenContract.allowance(this.wallet.address, spender);
    
    if (currentAllowance.eq(0)) {
      this.logger.info(`Approving ${tokenAddress} for ${spender}...`);
      const approveTx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
      await approveTx.wait();
      this.logger.info('✅ Approval confirmed');
    }
  }

  async handleMessage(message: AgentMessage): Promise<any> {
    this.status = 'busy';
    
    try {
      switch (message.type) {
        case 'swap':
          return await this.swapTokens(
            message.payload.tokenIn,
            message.payload.tokenOut,
            message.payload.amountIn,
            message.payload.minAmountOut
          );
        
        case 'swap_eth':
          return await this.swapETHForTokens(
            message.payload.tokenOut,
            message.payload.amountIn,
            message.payload.minAmountOut
          );
        
        case 'add_liquidity':
          return await this.addLiquidity(
            message.payload.tokenA,
            message.payload.tokenB,
            message.payload.amountA,
            message.payload.amountB
          );
        
        case 'pair_info':
          return await this.getPairInfo(
            message.payload.tokenA,
            message.payload.tokenB
          );
        
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
      type: task.action || 'swap',
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
}