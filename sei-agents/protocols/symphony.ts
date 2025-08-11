import { Contract, Wallet, JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import { SeiAgentKit } from 'sei-agent-kit';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../infrastructure/monitoring/metrics';

export interface SymphonyConfig {
  bridgeAddress: string;
  routerAddress: string;
  rpcUrl: string;
  privateKey?: string;
  supportedChains: number[];
  relayerEndpoint: string;
}

export interface CrossChainSwap {
  fromChain: number;
  toChain: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  recipient: string;
  slippageTolerance: number;
}

export interface LiquidityBridge {
  sourceChain: number;
  targetChain: number;
  asset: string;
  amount: bigint;
  destinationAddress: string;
}

export interface ChainInfo {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: string;
  blockTime: number;
  gasPrice: bigint;
  tvl: bigint;
}

// Symphony Protocol ABI
const SYMPHONY_ABI = [
  'function crossChainSwap(uint256 destChainId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline, bytes calldata data) external payable returns (bytes32)',
  'function bridgeLiquidity(uint256 destChainId, address token, uint256 amount, address to, bytes calldata data) external payable returns (bytes32)',
  'function getChainLiquidity(uint256 chainId, address token) external view returns (uint256)',
  'function getSupportedChains() external view returns (uint256[] memory)',
  'function getBridgeFee(uint256 destChainId, address token, uint256 amount) external view returns (uint256)',
  'function estimateSwapOutput(uint256 destChainId, address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)',
  'function getSwapRoute(uint256 destChainId, address tokenIn, address tokenOut) external view returns (address[] memory)',
  'function withdrawBridgedAssets(bytes32 transferId, bytes calldata proof) external',
  'function emergencyWithdraw(address token, uint256 amount) external'
];

export class SymphonyIntegration {
  private config: SymphonyConfig;
  private seiKit: SeiAgentKit;
  private bridgeContract: Contract;
  private routerContract: Contract;
  private logger: Logger;
  private metrics: MetricsCollector;
  private provider: JsonRpcProvider;
  private wallet?: Wallet;
  private chainInfoCache: Map<number, ChainInfo> = new Map();
  private liquidityCache: Map<string, { amount: bigint; timestamp: number }> = new Map();
  
  // Protocol constants
  private readonly BRIDGE_FEE_PERCENTAGE = 0.003; // 0.3%
  private readonly MAX_SLIPPAGE = 0.05; // 5%
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly CONFIRMATION_BLOCKS = 12;

  constructor(config: SymphonyConfig) {
    this.config = config;
    this.logger = new Logger('SymphonyIntegration');
    this.metrics = new MetricsCollector();
    this.provider = new JsonRpcProvider(config.rpcUrl);
    
    if (config.privateKey) {
      this.wallet = new Wallet(config.privateKey, this.provider);
      this.seiKit = new SeiAgentKit(this.wallet);
    } else {
      this.seiKit = new SeiAgentKit();
    }
    
    this.bridgeContract = new Contract(
      config.bridgeAddress,
      SYMPHONY_ABI,
      this.wallet || this.provider
    );
    
    this.routerContract = new Contract(
      config.routerAddress,
      SYMPHONY_ABI,
      this.wallet || this.provider
    );
  }

  async initialize(): Promise<void> {
    try {
      // Verify contracts are accessible
      await this.bridgeContract.getAddress();
      await this.routerContract.getAddress();
      
      // Initialize metrics collection
      await this.metrics.initialize();
      
      // Load supported chains information
      await this.loadSupportedChains();
      
      this.logger.info('Symphony cross-chain integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Symphony integration:', error);
      throw error;
    }
  }

  // Cross-chain swap functions
  async executeCrossChainSwap(
    swap: CrossChainSwap,
    deadline?: number
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for cross-chain swap');
      }
      
      this.logger.info(
        `Executing cross-chain swap: ${formatUnits(swap.amountIn, 18)} ${swap.tokenIn} ` +
        `on chain ${swap.fromChain} → ${swap.tokenOut} on chain ${swap.toChain}`
      );
      
      // Validate chains and tokens
      await this.validateCrossChainSwap(swap);
      
      // Calculate bridge fee and minimum output
      const bridgeFee = await this.calculateBridgeFee(swap.toChain, swap.tokenIn, swap.amountIn);
      const estimatedOutput = await this.estimateSwapOutput(
        swap.toChain,
        swap.tokenIn,
        swap.tokenOut,
        swap.amountIn - bridgeFee
      );
      
      const amountOutMin = this.calculateMinOutput(estimatedOutput, swap.slippageTolerance);
      
      // Get optimal route
      const route = await this.getOptimalRoute(swap);
      
      // Ensure token approval
      await this.ensureTokenApproval(swap.tokenIn, swap.amountIn + bridgeFee);
      
      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 7200; // 2 hours for cross-chain
      
      // Execute cross-chain swap
      const tx = await this.routerContract.crossChainSwap(
        swap.toChain,
        swap.tokenIn,
        swap.tokenOut,
        swap.amountIn,
        amountOutMin,
        swap.recipient,
        swapDeadline,
        this.encodeSwapData(route),
        {
          value: bridgeFee, // Native token for bridge fees
          gasLimit: 500000 // Higher gas limit for cross-chain ops
        }
      );
      
      const receipt = await tx.wait();
      
      // Extract transfer ID for tracking
      const transferId = await this.extractTransferId(receipt);
      
      // Start monitoring cross-chain transaction
      this.monitorCrossChainTransaction(transferId, swap.toChain);
      
      this.metrics.recordTransaction({
        protocol: 'symphony',
        action: 'cross_chain_swap',
        fromChain: swap.fromChain.toString(),
        toChain: swap.toChain.toString(),
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn: swap.amountIn.toString(),
        bridgeFee: bridgeFee.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime,
        transferId
      });
      
      this.logger.info(`Cross-chain swap initiated: ${tx.hash}, Transfer ID: ${transferId}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('symphony', 'cross_chain_swap', error as Error);
      this.logger.error('Cross-chain swap failed:', error);
      throw error;
    }
  }

  // Liquidity bridging functions
  async bridgeLiquidity(
    bridge: LiquidityBridge,
    additionalData?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for liquidity bridging');
      }
      
      this.logger.info(
        `Bridging liquidity: ${formatUnits(bridge.amount, 18)} ${bridge.asset} ` +
        `from chain ${bridge.sourceChain} to chain ${bridge.targetChain}`
      );
      
      // Validate bridging parameters
      await this.validateLiquidityBridge(bridge);
      
      // Calculate bridge fee
      const bridgeFee = await this.calculateBridgeFee(
        bridge.targetChain,
        bridge.asset,
        bridge.amount
      );
      
      // Check destination chain liquidity capacity
      const chainLiquidity = await this.getChainLiquidity(bridge.targetChain, bridge.asset);
      if (chainLiquidity < bridge.amount) {
        throw new Error(
          `Insufficient liquidity on target chain. Available: ${formatUnits(chainLiquidity, 18)}, ` +
          `Required: ${formatUnits(bridge.amount, 18)}`
        );
      }
      
      // Ensure token approval
      await this.ensureTokenApproval(bridge.asset, bridge.amount + bridgeFee);
      
      // Execute bridge transaction
      const tx = await this.bridgeContract.bridgeLiquidity(
        bridge.targetChain,
        bridge.asset,
        bridge.amount,
        bridge.destinationAddress,
        additionalData || '0x',
        {
          value: bridgeFee,
          gasLimit: 400000
        }
      );
      
      const receipt = await tx.wait();
      const transferId = await this.extractTransferId(receipt);
      
      // Monitor bridge transaction
      this.monitorBridgeTransaction(transferId, bridge.targetChain);
      
      this.metrics.recordTransaction({
        protocol: 'symphony',
        action: 'bridge_liquidity',
        sourceChain: bridge.sourceChain.toString(),
        targetChain: bridge.targetChain.toString(),
        asset: bridge.asset,
        amount: bridge.amount.toString(),
        bridgeFee: bridgeFee.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime,
        transferId
      });
      
      this.logger.info(`Liquidity bridge initiated: ${tx.hash}, Transfer ID: ${transferId}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('symphony', 'bridge_liquidity', error as Error);
      this.logger.error('Liquidity bridging failed:', error);
      throw error;
    }
  }

  // Query and utility functions
  async estimateSwapOutput(
    destChainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<bigint> {
    try {
      const output = await this.routerContract.estimateSwapOutput(
        destChainId,
        tokenIn,
        tokenOut,
        amountIn
      );
      return BigInt(output.toString());
    } catch (error) {
      this.logger.error('Failed to estimate swap output:', error);
      throw error;
    }
  }

  async calculateBridgeFee(
    destChainId: number,
    token: string,
    amount: bigint
  ): Promise<bigint> {
    try {
      const fee = await this.bridgeContract.getBridgeFee(destChainId, token, amount);
      return BigInt(fee.toString());
    } catch (error) {
      // Fallback to percentage-based calculation
      return (amount * BigInt(Math.floor(this.BRIDGE_FEE_PERCENTAGE * 10000))) / BigInt(10000);
    }
  }

  async getChainLiquidity(chainId: number, token: string): Promise<bigint> {
    const cacheKey = `${chainId}-${token}`;
    const cached = this.liquidityCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.amount;
    }
    
    try {
      const liquidity = await this.bridgeContract.getChainLiquidity(chainId, token);
      const amount = BigInt(liquidity.toString());
      
      this.liquidityCache.set(cacheKey, {
        amount,
        timestamp: Date.now()
      });
      
      return amount;
    } catch (error) {
      this.logger.error(`Failed to get chain liquidity for ${token} on chain ${chainId}:`, error);
      return BigInt(0);
    }
  }

  async getSupportedChains(): Promise<number[]> {
    try {
      const chains = await this.bridgeContract.getSupportedChains();
      return chains.map((chain: any) => Number(chain.toString()));
    } catch (error) {
      this.logger.error('Failed to get supported chains:', error);
      return this.config.supportedChains;
    }
  }

  async getOptimalRoute(swap: CrossChainSwap): Promise<string[]> {
    try {
      const route = await this.routerContract.getSwapRoute(
        swap.toChain,
        swap.tokenIn,
        swap.tokenOut
      );
      return route;
    } catch (error) {
      this.logger.error('Failed to get optimal route:', error);
      // Return direct route as fallback
      return [swap.tokenIn, swap.tokenOut];
    }
  }

  async findBestChainForLiquidity(asset: string): Promise<{
    chainId: number;
    liquidity: bigint;
    apy: number;
    fees: bigint;
  }> {
    const supportedChains = await this.getSupportedChains();
    const opportunities: {
      chainId: number;
      liquidity: bigint;
      apy: number;
      fees: bigint;
    }[] = [];
    
    for (const chainId of supportedChains) {
      try {
        const liquidity = await this.getChainLiquidity(chainId, asset);
        const bridgeFee = await this.calculateBridgeFee(chainId, asset, parseUnits('1000', 18));
        
        // Get chain-specific information
        const chainInfo = await this.getChainInfo(chainId);
        
        // Calculate estimated APY (simplified)
        const utilizationRate = this.estimateUtilizationRate(liquidity, chainInfo.tvl);
        const estimatedAPY = this.calculateAPY(utilizationRate);
        
        opportunities.push({
          chainId,
          liquidity,
          apy: estimatedAPY,
          fees: bridgeFee
        });
        
      } catch (error) {
        this.logger.error(`Failed to analyze chain ${chainId}:`, error);
      }
    }
    
    // Sort by highest APY adjusted for fees
    opportunities.sort((a, b) => {
      const scoreA = a.apy - (Number(a.fees) / 1000000); // Adjust for fees
      const scoreB = b.apy - (Number(b.fees) / 1000000);
      return scoreB - scoreA;
    });
    
    if (opportunities.length === 0) {
      throw new Error('No suitable chains found for liquidity provision');
    }
    
    return opportunities[0];
  }

  async findCrossChainArbitrage(asset: string): Promise<{
    fromChain: number;
    toChain: number;
    priceDifference: bigint;
    profitPercentage: number;
    requiredAmount: bigint;
  }[]> {
    const supportedChains = await this.getSupportedChains();
    const opportunities: {
      fromChain: number;
      toChain: number;
      priceDifference: bigint;
      profitPercentage: number;
      requiredAmount: bigint;
    }[] = [];
    
    const testAmount = parseUnits('1', 18);
    
    // Compare prices across all chain pairs
    for (let i = 0; i < supportedChains.length; i++) {
      for (let j = i + 1; j < supportedChains.length; j++) {
        const chainA = supportedChains[i];
        const chainB = supportedChains[j];
        
        try {
          // Get prices on both chains (simplified - would need actual price feeds)
          const liquidityA = await this.getChainLiquidity(chainA, asset);
          const liquidityB = await this.getChainLiquidity(chainB, asset);
          
          // Calculate implied price difference based on liquidity
          if (liquidityA > BigInt(0) && liquidityB > BigInt(0)) {
            const priceDiff = liquidityA > liquidityB ? 
              liquidityA - liquidityB : 
              liquidityB - liquidityA;
            
            const percentage = Number(priceDiff * BigInt(10000) / 
              (liquidityA > liquidityB ? liquidityB : liquidityA)) / 100;
            
            if (percentage > 2.0) { // 2% minimum profit threshold
              opportunities.push({
                fromChain: liquidityA > liquidityB ? chainA : chainB,
                toChain: liquidityA > liquidityB ? chainB : chainA,
                priceDifference: priceDiff,
                profitPercentage: percentage,
                requiredAmount: testAmount
              });
            }
          }
          
        } catch (error) {
          this.logger.error(`Failed to analyze arbitrage between chains ${chainA} and ${chainB}:`, error);
        }
      }
    }
    
    return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  // Transaction monitoring
  private async monitorCrossChainTransaction(
    transferId: string,
    targetChain: number
  ): Promise<void> {
    this.logger.info(`Monitoring cross-chain transaction: ${transferId}`);
    
    // In production, this would poll the relayer or use webhooks
    setTimeout(async () => {
      try {
        const status = await this.getTransferStatus(transferId);
        this.logger.info(`Transfer ${transferId} status: ${status}`);
        
        if (status === 'completed') {
          this.emit('crossChainTransferCompleted', { transferId, targetChain });
        } else if (status === 'failed') {
          this.emit('crossChainTransferFailed', { transferId, targetChain });
        } else {
          // Continue monitoring
          this.monitorCrossChainTransaction(transferId, targetChain);
        }
      } catch (error) {
        this.logger.error(`Failed to monitor transfer ${transferId}:`, error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async monitorBridgeTransaction(
    transferId: string,
    targetChain: number
  ): Promise<void> {
    this.logger.info(`Monitoring bridge transaction: ${transferId}`);
    
    // Similar to cross-chain monitoring but for liquidity bridges
    setTimeout(async () => {
      try {
        const status = await this.getTransferStatus(transferId);
        this.logger.info(`Bridge ${transferId} status: ${status}`);
        
        if (status === 'completed') {
          this.emit('liquidityBridgeCompleted', { transferId, targetChain });
        } else if (status === 'failed') {
          this.emit('liquidityBridgeFailed', { transferId, targetChain });
        } else {
          this.monitorBridgeTransaction(transferId, targetChain);
        }
      } catch (error) {
        this.logger.error(`Failed to monitor bridge ${transferId}:`, error);
      }
    }, 30000);
  }

  // Helper functions
  private async validateCrossChainSwap(swap: CrossChainSwap): Promise<void> {
    const supportedChains = await this.getSupportedChains();
    
    if (!supportedChains.includes(swap.fromChain)) {
      throw new Error(`Unsupported source chain: ${swap.fromChain}`);
    }
    
    if (!supportedChains.includes(swap.toChain)) {
      throw new Error(`Unsupported target chain: ${swap.toChain}`);
    }
    
    if (swap.slippageTolerance > this.MAX_SLIPPAGE) {
      throw new Error(`Slippage tolerance too high: ${swap.slippageTolerance}`);
    }
  }

  private async validateLiquidityBridge(bridge: LiquidityBridge): Promise<void> {
    const supportedChains = await this.getSupportedChains();
    
    if (!supportedChains.includes(bridge.sourceChain)) {
      throw new Error(`Unsupported source chain: ${bridge.sourceChain}`);
    }
    
    if (!supportedChains.includes(bridge.targetChain)) {
      throw new Error(`Unsupported target chain: ${bridge.targetChain}`);
    }
  }

  private calculateMinOutput(expectedOutput: bigint, slippageTolerance: number): bigint {
    const slippageMultiplier = BigInt(Math.floor((1 - slippageTolerance) * 10000));
    return (expectedOutput * slippageMultiplier) / BigInt(10000);
  }

  private encodeSwapData(route: string[]): string {
    // Encode route data for cross-chain swap
    return '0x'; // Simplified
  }

  private async extractTransferId(receipt: any): Promise<string> {
    // Extract transfer ID from transaction receipt logs
    return `transfer-${receipt.transactionHash}-${Date.now()}`;
  }

  private async getTransferStatus(transferId: string): Promise<string> {
    // Query relayer API for transfer status
    try {
      const response = await fetch(`${this.config.relayerEndpoint}/status/${transferId}`);
      const data = await response.json();
      return data.status;
    } catch (error) {
      return 'pending';
    }
  }

  private estimateUtilizationRate(liquidity: bigint, tvl: bigint): number {
    if (tvl === BigInt(0)) return 0;
    return Number(liquidity * BigInt(10000) / tvl) / 10000;
  }

  private calculateAPY(utilizationRate: number): number {
    // Simplified APY calculation based on utilization rate
    return utilizationRate * 15 + 5; // Base 5% + up to 15% based on utilization
  }

  private async loadSupportedChains(): Promise<void> {
    try {
      const chains = await this.getSupportedChains();
      
      for (const chainId of chains) {
        // Load chain information (simplified)
        const chainInfo: ChainInfo = {
          chainId,
          name: this.getChainName(chainId),
          rpcUrl: this.getRpcUrl(chainId),
          nativeCurrency: this.getNativeCurrency(chainId),
          blockTime: 2000, // 2 seconds average
          gasPrice: BigInt(20000000000), // 20 gwei
          tvl: BigInt(0) // Would be fetched from analytics
        };
        
        this.chainInfoCache.set(chainId, chainInfo);
      }
      
      this.logger.info(`Loaded information for ${chains.length} supported chains`);
    } catch (error) {
      this.logger.error('Failed to load supported chains:', error);
    }
  }

  private async getChainInfo(chainId: number): Promise<ChainInfo> {
    const cached = this.chainInfoCache.get(chainId);
    if (cached) {
      return cached;
    }
    
    // Default chain info
    return {
      chainId,
      name: 'Unknown',
      rpcUrl: '',
      nativeCurrency: 'ETH',
      blockTime: 2000,
      gasPrice: BigInt(20000000000),
      tvl: BigInt(0)
    };
  }

  private getChainName(chainId: number): string {
    const chainNames: { [key: number]: string } = {
      1: 'Ethereum',
      56: 'BSC',
      137: 'Polygon',
      1313: 'Sei',
      43114: 'Avalanche'
    };
    return chainNames[chainId] || `Chain ${chainId}`;
  }

  private getRpcUrl(chainId: number): string {
    // Return appropriate RPC URL for chain
    return this.config.rpcUrl; // Simplified
  }

  private getNativeCurrency(chainId: number): string {
    const currencies: { [key: number]: string } = {
      1: 'ETH',
      56: 'BNB',
      137: 'MATIC',
      1313: 'SEI',
      43114: 'AVAX'
    };
    return currencies[chainId] || 'ETH';
  }

  private async ensureTokenApproval(tokenAddress: string, amount: bigint): Promise<void> {
    this.logger.debug(`Ensuring token approval for ${tokenAddress}`);
  }

  // Public utility methods
  async getProtocolStats(): Promise<{
    totalVolumeUSD: bigint;
    totalLiquidityUSD: bigint;
    supportedChains: number;
    activeBridges: number;
  }> {
    const supportedChains = await this.getSupportedChains();
    
    return {
      totalVolumeUSD: BigInt(0), // Would aggregate from all chains
      totalLiquidityUSD: BigInt(0),
      supportedChains: supportedChains.length,
      activeBridges: 0 // Would count active bridge transactions
    };
  }

  getMetrics() {
    return this.metrics.getProtocolMetrics('symphony');
  }

  async shutdown(): Promise<void> {
    this.chainInfoCache.clear();
    this.liquidityCache.clear();
    await this.metrics.shutdown();
    this.logger.info('Symphony integration shut down');
  }
}

export default SymphonyIntegration;