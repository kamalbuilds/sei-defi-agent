import { Contract, Wallet, JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import { SeiAgentKit } from 'sei-agent-kit';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../infrastructure/monitoring/metrics';

export interface DragonSwapConfig {
  routerAddress: string;
  factoryAddress: string;
  rpcUrl: string;
  privateKey?: string;
  slippageTolerance: number;
  gasLimit?: bigint;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOutMin: bigint;
  to: string;
  deadline: number;
}

export interface LiquidityParams {
  tokenA: string;
  tokenB: string;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  to: string;
  deadline: number;
}

export interface PoolInfo {
  address: string;
  tokenA: string;
  tokenB: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  fee: number;
  volumeUSD: number;
  liquidityUSD: number;
}

export interface PriceImpact {
  percentage: number;
  priceChange: bigint;
  isHighImpact: boolean;
}

// DragonSwap Router ABI
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)',
  'function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB)',
  'function factory() external pure returns (address)',
  'function WSEI() external pure returns (address)'
];

// Factory ABI
const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)',
  'function feeTo() external view returns (address)',
  'function feeToSetter() external view returns (address)'
];

// Pair ABI
const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function totalSupply() external view returns (uint)',
  'function balanceOf(address owner) external view returns (uint)',
  'function sync() external',
  'function skim(address to) external'
];

export class DragonSwapIntegration {
  private config: DragonSwapConfig;
  private seiKit: SeiAgentKit;
  private routerContract: Contract;
  private factoryContract: Contract;
  private logger: Logger;
  private metrics: MetricsCollector;
  private provider: JsonRpcProvider;
  private wallet?: Wallet;
  private pairCache: Map<string, PoolInfo> = new Map();
  private priceCache: Map<string, { price: bigint; timestamp: number }> = new Map();
  
  // Trading parameters
  private readonly MAX_SLIPPAGE = 0.5; // 50%
  private readonly PRICE_CACHE_TTL = 30000; // 30 seconds
  private readonly MEV_PROTECTION_DELAY = 1000; // 1 second

  constructor(config: DragonSwapConfig) {
    this.config = config;
    this.logger = new Logger('DragonSwapIntegration');
    this.metrics = new MetricsCollector();
    this.provider = new JsonRpcProvider(config.rpcUrl);
    
    if (config.privateKey) {
      this.wallet = new Wallet(config.privateKey, this.provider);
      this.seiKit = new SeiAgentKit(this.wallet);
    } else {
      this.seiKit = new SeiAgentKit();
    }
    
    this.routerContract = new Contract(
      config.routerAddress,
      ROUTER_ABI,
      this.wallet || this.provider
    );
    
    this.factoryContract = new Contract(
      config.factoryAddress,
      FACTORY_ABI,
      this.wallet || this.provider
    );
  }

  async initialize(): Promise<void> {
    try {
      // Verify contracts are accessible
      await this.routerContract.getAddress();
      await this.factoryContract.getAddress();
      
      // Initialize metrics collection
      await this.metrics.initialize();
      
      // Load popular pairs into cache
      await this.preloadPopularPairs();
      
      this.logger.info('DragonSwap integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DragonSwap integration:', error);
      throw error;
    }
  }

  // Core swap functions
  async swapExactTokensForTokens(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    minAmountOut?: bigint,
    to?: string,
    deadline?: number
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for swap operation');
      }
      
      this.logger.info(`Swapping ${formatUnits(amountIn, 18)} ${tokenIn} for ${tokenOut}`);
      
      // Calculate optimal path
      const path = await this.findOptimalPath(tokenIn, tokenOut);
      
      // Get expected output with slippage protection
      const expectedOutput = await this.getAmountsOut(amountIn, path);
      const amountOutMin = minAmountOut || this.calculateMinOutput(expectedOutput[expectedOutput.length - 1]);
      
      // Validate price impact
      const priceImpact = await this.calculatePriceImpact(path, amountIn, expectedOutput[expectedOutput.length - 1]);
      if (priceImpact.isHighImpact) {
        this.logger.warn(`High price impact detected: ${priceImpact.percentage}%`);
      }
      
      const recipient = to || this.wallet.address;
      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 3600; // 1 hour
      
      // Ensure token approval
      await this.ensureTokenApproval(tokenIn, amountIn);
      
      // Add MEV protection delay for large trades
      if (Number(amountIn) > 1000) {
        await this.sleep(this.MEV_PROTECTION_DELAY);
      }
      
      // Execute swap
      const tx = await this.routerContract.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        recipient,
        swapDeadline,
        {
          gasLimit: this.config.gasLimit
        }
      );
      
      const receipt = await tx.wait();
      
      // Parse swap results
      const actualOutput = await this.parseSwapOutput(receipt, tokenOut);
      
      // Record metrics
      this.metrics.recordTransaction({
        protocol: 'dragonswap',
        action: 'swap',
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        amountOut: actualOutput.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime,
        priceImpact: priceImpact.percentage
      });
      
      this.logger.info(`Swap successful: ${tx.hash} - Output: ${formatUnits(actualOutput, 18)}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('dragonswap', 'swap', error as Error);
      this.logger.error('Swap failed:', error);
      throw error;
    }
  }

  async swapExactETHForTokens(
    tokenOut: string,
    amountIn: bigint,
    minAmountOut?: bigint,
    to?: string,
    deadline?: number
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for ETH swap operation');
      }
      
      this.logger.info(`Swapping ${formatUnits(amountIn, 18)} SEI for ${tokenOut}`);
      
      const wsei = await this.routerContract.WSEI();
      const path = [wsei, tokenOut];
      
      // Get expected output
      const expectedOutput = await this.getAmountsOut(amountIn, path);
      const amountOutMin = minAmountOut || this.calculateMinOutput(expectedOutput[1]);
      
      const recipient = to || this.wallet.address;
      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 3600;
      
      // Execute swap
      const tx = await this.routerContract.swapExactETHForTokens(
        amountOutMin,
        path,
        recipient,
        swapDeadline,
        {
          value: amountIn,
          gasLimit: this.config.gasLimit
        }
      );
      
      const receipt = await tx.wait();
      const actualOutput = await this.parseSwapOutput(receipt, tokenOut);
      
      this.metrics.recordTransaction({
        protocol: 'dragonswap',
        action: 'eth_swap',
        tokenIn: 'SEI',
        tokenOut,
        amountIn: amountIn.toString(),
        amountOut: actualOutput.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`ETH swap successful: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('dragonswap', 'eth_swap', error as Error);
      this.logger.error('ETH swap failed:', error);
      throw error;
    }
  }

  // Liquidity provision functions
  async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountADesired: bigint,
    amountBDesired: bigint,
    slippageTolerance?: number,
    to?: string,
    deadline?: number
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for liquidity operation');
      }
      
      this.logger.info(`Adding liquidity: ${formatUnits(amountADesired, 18)} ${tokenA} + ${formatUnits(amountBDesired, 18)} ${tokenB}`);
      
      const slippage = slippageTolerance || this.config.slippageTolerance;
      const amountAMin = this.calculateMinAmount(amountADesired, slippage);
      const amountBMin = this.calculateMinAmount(amountBDesired, slippage);
      
      const recipient = to || this.wallet.address;
      const liquidityDeadline = deadline || Math.floor(Date.now() / 1000) + 3600;
      
      // Ensure token approvals
      await this.ensureTokenApproval(tokenA, amountADesired);
      await this.ensureTokenApproval(tokenB, amountBDesired);
      
      const tx = await this.routerContract.addLiquidity(
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        recipient,
        liquidityDeadline,
        {
          gasLimit: this.config.gasLimit
        }
      );
      
      const receipt = await tx.wait();
      
      // Parse liquidity results
      const liquidityResult = await this.parseLiquidityOutput(receipt);
      
      this.metrics.recordTransaction({
        protocol: 'dragonswap',
        action: 'add_liquidity',
        tokenA,
        tokenB,
        amountA: liquidityResult.amountA.toString(),
        amountB: liquidityResult.amountB.toString(),
        liquidity: liquidityResult.liquidity.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Liquidity added successfully: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('dragonswap', 'add_liquidity', error as Error);
      this.logger.error('Add liquidity failed:', error);
      throw error;
    }
  }

  async removeLiquidity(
    tokenA: string,
    tokenB: string,
    liquidity: bigint,
    slippageTolerance?: number,
    to?: string,
    deadline?: number
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for liquidity operation');
      }
      
      this.logger.info(`Removing liquidity: ${formatUnits(liquidity, 18)} LP tokens`);
      
      // Get pair info to calculate minimum outputs
      const pairAddress = await this.factoryContract.getPair(tokenA, tokenB);
      const pairInfo = await this.getPairInfo(pairAddress);
      
      // Calculate expected outputs
      const totalSupply = pairInfo.totalSupply;
      const expectedAmountA = (liquidity * pairInfo.reserve0) / totalSupply;
      const expectedAmountB = (liquidity * pairInfo.reserve1) / totalSupply;
      
      const slippage = slippageTolerance || this.config.slippageTolerance;
      const amountAMin = this.calculateMinAmount(expectedAmountA, slippage);
      const amountBMin = this.calculateMinAmount(expectedAmountB, slippage);
      
      const recipient = to || this.wallet.address;
      const liquidityDeadline = deadline || Math.floor(Date.now() / 1000) + 3600;
      
      // Ensure LP token approval
      await this.ensureTokenApproval(pairAddress, liquidity);
      
      const tx = await this.routerContract.removeLiquidity(
        tokenA,
        tokenB,
        liquidity,
        amountAMin,
        amountBMin,
        recipient,
        liquidityDeadline,
        {
          gasLimit: this.config.gasLimit
        }
      );
      
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'dragonswap',
        action: 'remove_liquidity',
        tokenA,
        tokenB,
        liquidity: liquidity.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Liquidity removed successfully: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('dragonswap', 'remove_liquidity', error as Error);
      this.logger.error('Remove liquidity failed:', error);
      throw error;
    }
  }

  // Query and utility functions
  async getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]> {
    try {
      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      return amounts.map((amount: any) => BigInt(amount.toString()));
    } catch (error) {
      this.logger.error('Failed to get amounts out:', error);
      throw error;
    }
  }

  async getAmountsIn(amountOut: bigint, path: string[]): Promise<bigint[]> {
    try {
      const amounts = await this.routerContract.getAmountsIn(amountOut, path);
      return amounts.map((amount: any) => BigInt(amount.toString()));
    } catch (error) {
      this.logger.error('Failed to get amounts in:', error);
      throw error;
    }
  }

  async getPairInfo(pairAddress: string): Promise<PoolInfo> {
    // Check cache first
    const cached = this.pairCache.get(pairAddress);
    if (cached) {
      return cached;
    }
    
    try {
      const pairContract = new Contract(pairAddress, PAIR_ABI, this.provider);
      
      const [reserves, token0, token1, totalSupply] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0(),
        pairContract.token1(),
        pairContract.totalSupply()
      ]);
      
      const pairInfo: PoolInfo = {
        address: pairAddress,
        tokenA: token0,
        tokenB: token1,
        reserve0: BigInt(reserves.reserve0.toString()),
        reserve1: BigInt(reserves.reserve1.toString()),
        totalSupply: BigInt(totalSupply.toString()),
        fee: 0.003, // 0.3% standard fee
        volumeUSD: 0, // Would need additional data source
        liquidityUSD: 0 // Would need price oracle
      };
      
      // Cache for 1 minute
      this.pairCache.set(pairAddress, pairInfo);
      setTimeout(() => this.pairCache.delete(pairAddress), 60000);
      
      return pairInfo;
      
    } catch (error) {
      this.logger.error(`Failed to get pair info for ${pairAddress}:`, error);
      throw error;
    }
  }

  async findOptimalPath(tokenA: string, tokenB: string): Promise<string[]> {
    // Try direct path first
    const directPair = await this.factoryContract.getPair(tokenA, tokenB);
    if (directPair !== '0x0000000000000000000000000000000000000000') {
      return [tokenA, tokenB];
    }
    
    // Try path through WSEI
    const wsei = await this.routerContract.WSEI();
    if (tokenA !== wsei && tokenB !== wsei) {
      const pairA = await this.factoryContract.getPair(tokenA, wsei);
      const pairB = await this.factoryContract.getPair(wsei, tokenB);
      
      if (pairA !== '0x0000000000000000000000000000000000000000' && 
          pairB !== '0x0000000000000000000000000000000000000000') {
        return [tokenA, wsei, tokenB];
      }
    }
    
    // Try other common intermediate tokens (USDC, USDT, etc.)
    const commonTokens = await this.getCommonIntermediateTokens();
    
    for (const intermediate of commonTokens) {
      if (intermediate === tokenA || intermediate === tokenB) continue;
      
      const pairA = await this.factoryContract.getPair(tokenA, intermediate);
      const pairB = await this.factoryContract.getPair(intermediate, tokenB);
      
      if (pairA !== '0x0000000000000000000000000000000000000000' && 
          pairB !== '0x0000000000000000000000000000000000000000') {
        return [tokenA, intermediate, tokenB];
      }
    }
    
    throw new Error(`No trading path found from ${tokenA} to ${tokenB}`);
  }

  async calculatePriceImpact(
    path: string[],
    amountIn: bigint,
    amountOut: bigint
  ): Promise<PriceImpact> {
    try {
      // Calculate theoretical price without slippage
      const marketPrice = await this.getMarketPrice(path[0], path[path.length - 1]);
      const expectedOutput = (amountIn * marketPrice) / BigInt(10 ** 18);
      
      const priceChange = expectedOutput > amountOut ? 
        expectedOutput - amountOut : 
        amountOut - expectedOutput;
      
      const percentage = Number(priceChange * BigInt(10000) / expectedOutput) / 100;
      
      return {
        percentage,
        priceChange,
        isHighImpact: percentage > 5.0 // 5% threshold
      };
      
    } catch (error) {
      this.logger.error('Failed to calculate price impact:', error);
      return {
        percentage: 0,
        priceChange: BigInt(0),
        isHighImpact: false
      };
    }
  }

  async getMarketPrice(tokenA: string, tokenB: string): Promise<bigint> {
    const cacheKey = `${tokenA}-${tokenB}`;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.price;
    }
    
    try {
      const path = await this.findOptimalPath(tokenA, tokenB);
      const amountIn = parseUnits('1', 18); // 1 token
      const amountsOut = await this.getAmountsOut(amountIn, path);
      const price = amountsOut[amountsOut.length - 1];
      
      this.priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });
      
      return price;
      
    } catch (error) {
      this.logger.error(`Failed to get market price for ${tokenA}/${tokenB}:`, error);
      return BigInt(0);
    }
  }

  async findArbitrageOpportunities(tokenA: string, tokenB: string): Promise<{
    buyOn: string;
    sellOn: string;
    profit: bigint;
    profitPercentage: number;
  }[]> {
    // Compare prices across different pairs/routes
    const opportunities: {
      buyOn: string;
      sellOn: string;
      profit: bigint;
      profitPercentage: number;
    }[] = [];
    
    try {
      // Get all possible paths
      const directPath = [tokenA, tokenB];
      const wsei = await this.routerContract.WSEI();
      const wseiPath = [tokenA, wsei, tokenB];
      
      // Compare prices
      const testAmount = parseUnits('1', 18);
      
      const [directPrice, wseiPrice] = await Promise.all([
        this.getAmountsOut(testAmount, directPath).catch(() => [BigInt(0), BigInt(0)]),
        this.getAmountsOut(testAmount, wseiPath).catch(() => [BigInt(0), BigInt(0), BigInt(0)])
      ]);
      
      const directOutput = directPrice[1];
      const wseiOutput = wseiPrice[2];
      
      if (directOutput > BigInt(0) && wseiOutput > BigInt(0)) {
        const priceDiff = directOutput > wseiOutput ? 
          directOutput - wseiOutput : 
          wseiOutput - directOutput;
        
        const percentage = Number(priceDiff * BigInt(10000) / 
          (directOutput > wseiOutput ? wseiOutput : directOutput)) / 100;
        
        if (percentage > 1.0) { // 1% minimum profit
          opportunities.push({
            buyOn: directOutput > wseiOutput ? 'wsei_path' : 'direct_path',
            sellOn: directOutput > wseiOutput ? 'direct_path' : 'wsei_path',
            profit: priceDiff,
            profitPercentage: percentage
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to find arbitrage opportunities:', error);
    }
    
    return opportunities;
  }

  // Helper functions
  private calculateMinOutput(expectedOutput: bigint): bigint {
    const slippageMultiplier = BigInt(Math.floor((1 - this.config.slippageTolerance) * 10000));
    return (expectedOutput * slippageMultiplier) / BigInt(10000);
  }

  private calculateMinAmount(amount: bigint, slippage: number): bigint {
    const slippageMultiplier = BigInt(Math.floor((1 - slippage) * 10000));
    return (amount * slippageMultiplier) / BigInt(10000);
  }

  private async ensureTokenApproval(tokenAddress: string, amount: bigint): Promise<void> {
    // Implementation would check and approve ERC20 token spending
    this.logger.debug(`Ensuring token approval for ${tokenAddress}`);
  }

  private async parseSwapOutput(receipt: any, tokenOut: string): Promise<bigint> {
    // Parse transaction logs to extract actual output amount
    // This is simplified - would parse Transfer events
    return BigInt(0);
  }

  private async parseLiquidityOutput(receipt: any): Promise<{
    amountA: bigint;
    amountB: bigint;
    liquidity: bigint;
  }> {
    // Parse transaction logs to extract liquidity results
    return {
      amountA: BigInt(0),
      amountB: BigInt(0),
      liquidity: BigInt(0)
    };
  }

  private async preloadPopularPairs(): Promise<void> {
    // Pre-load popular trading pairs into cache
    const popularPairs = [
      // Add popular pair addresses
    ];
    
    for (const pairAddress of popularPairs) {
      try {
        await this.getPairInfo(pairAddress);
      } catch (error) {
        this.logger.error(`Failed to preload pair ${pairAddress}:`, error);
      }
    }
  }

  private async getCommonIntermediateTokens(): Promise<string[]> {
    return [
      // Add common intermediate token addresses
      '0x...', // USDC
      '0x...', // USDT
      '0x...', // DAI
    ];
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods
  async getAllPairs(): Promise<PoolInfo[]> {
    const pairCount = await this.factoryContract.allPairsLength();
    const pairs: PoolInfo[] = [];
    
    for (let i = 0; i < Number(pairCount); i++) {
      try {
        const pairAddress = await this.factoryContract.allPairs(i);
        const pairInfo = await this.getPairInfo(pairAddress);
        pairs.push(pairInfo);
      } catch (error) {
        this.logger.error(`Failed to get pair ${i}:`, error);
      }
    }
    
    return pairs;
  }

  async getTopPairsByLiquidity(limit: number = 10): Promise<PoolInfo[]> {
    const allPairs = await this.getAllPairs();
    return allPairs
      .sort((a, b) => Number(b.reserve0 + b.reserve1 - a.reserve0 - a.reserve1))
      .slice(0, limit);
  }

  getMetrics() {
    return this.metrics.getProtocolMetrics('dragonswap');
  }

  async shutdown(): Promise<void> {
    this.pairCache.clear();
    this.priceCache.clear();
    await this.metrics.shutdown();
    this.logger.info('DragonSwap integration shut down');
  }
}

export default DragonSwapIntegration;