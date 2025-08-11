import { Contract, Wallet, JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import { SeiAgentKit } from 'sei-agent-kit';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../infrastructure/monitoring/metrics';

export interface CitrexConfig {
  exchangeAddress: string;
  marginEngineAddress: string;
  oracleAddress: string;
  rpcUrl: string;
  privateKey?: string;
  maxLeverage: number;
  riskParameters: RiskParameters;
}

export interface RiskParameters {
  maxPositionSize: bigint;
  liquidationThreshold: number;
  maintenanceMargin: number;
  initialMargin: number;
  maxDrawdown: number;
}

export interface PerpetualPosition {
  market: string;
  side: 'long' | 'short';
  size: bigint;
  entryPrice: bigint;
  markPrice: bigint;
  unrealizedPnL: bigint;
  leverage: number;
  margin: bigint;
  liquidationPrice: bigint;
  fundingPayment: bigint;
}

export interface MarketData {
  symbol: string;
  markPrice: bigint;
  indexPrice: bigint;
  fundingRate: number;
  openInterest: bigint;
  volume24h: bigint;
  bid: bigint;
  ask: bigint;
  spread: number;
}

export interface OrderParams {
  market: string;
  side: 'long' | 'short';
  orderType: 'market' | 'limit' | 'stop' | 'take_profit';
  size: bigint;
  price?: bigint;
  leverage: number;
  reduceOnly?: boolean;
  postOnly?: boolean;
}

// Citrex Perpetual Exchange ABI
const CITREX_ABI = [
  'function openPosition(string memory market, uint8 side, uint256 size, uint256 price, uint256 leverage, bool reduceOnly) external payable returns (uint256)',
  'function closePosition(string memory market, uint256 size, uint256 minPrice) external returns (uint256)',
  'function modifyPosition(string memory market, int256 sizeDelta, uint256 price) external returns (uint256)',
  'function addMargin(string memory market, uint256 amount) external',
  'function removeMargin(string memory market, uint256 amount) external',
  'function liquidatePosition(address user, string memory market) external returns (uint256)',
  'function getPosition(address user, string memory market) external view returns (tuple)',
  'function getMarketData(string memory market) external view returns (tuple)',
  'function getUserPositions(address user) external view returns (string[] memory)',
  'function calculateLiquidationPrice(address user, string memory market) external view returns (uint256)',
  'function getFundingPayment(address user, string memory market) external view returns (int256)',
  'function getAccountValue(address user) external view returns (uint256, uint256, uint256)',
  'function setLeverage(string memory market, uint256 leverage) external',
  'function getOrderBook(string memory market, uint256 depth) external view returns (uint256[] memory, uint256[] memory)'
];

export class CitrexIntegration {
  private config: CitrexConfig;
  private seiKit: SeiAgentKit;
  private exchangeContract: Contract;
  private marginEngineContract: Contract;
  private oracleContract: Contract;
  private logger: Logger;
  private metrics: MetricsCollector;
  private provider: JsonRpcProvider;
  private wallet?: Wallet;
  private positions: Map<string, PerpetualPosition> = new Map();
  private marketDataCache: Map<string, { data: MarketData; timestamp: number }> = new Map();
  
  // Trading parameters
  private readonly MAX_SLIPPAGE = 0.005; // 0.5%
  private readonly FUNDING_INTERVAL = 28800; // 8 hours in seconds
  private readonly PRICE_CACHE_TTL = 1000; // 1 second for real-time data
  private readonly POSITION_REFRESH_INTERVAL = 5000; // 5 seconds

  constructor(config: CitrexConfig) {
    this.config = config;
    this.logger = new Logger('CitrexIntegration');
    this.metrics = new MetricsCollector();
    this.provider = new JsonRpcProvider(config.rpcUrl);
    
    if (config.privateKey) {
      this.wallet = new Wallet(config.privateKey, this.provider);
      this.seiKit = new SeiAgentKit(this.wallet);
    } else {
      this.seiKit = new SeiAgentKit();
    }
    
    this.exchangeContract = new Contract(
      config.exchangeAddress,
      CITREX_ABI,
      this.wallet || this.provider
    );
    
    this.marginEngineContract = new Contract(
      config.marginEngineAddress,
      CITREX_ABI,
      this.wallet || this.provider
    );
    
    this.oracleContract = new Contract(
      config.oracleAddress,
      ['function getPrice(string memory symbol) external view returns (uint256)'],
      this.provider
    );
  }

  async initialize(): Promise<void> {
    try {
      // Verify contracts are accessible
      await this.exchangeContract.getAddress();
      await this.marginEngineContract.getAddress();
      await this.oracleContract.getAddress();
      
      // Initialize metrics collection
      await this.metrics.initialize();
      
      // Start position monitoring if wallet is available
      if (this.wallet) {
        await this.loadUserPositions();
        this.startPositionMonitoring();
      }
      
      this.logger.info('Citrex perpetual trading integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Citrex integration:', error);
      throw error;
    }
  }

  // Core trading functions
  async openPosition(orderParams: OrderParams): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for opening positions');
      }
      
      this.logger.info(
        `Opening ${orderParams.side} position: ${formatUnits(orderParams.size, 18)} ${orderParams.market} ` +
        `at ${orderParams.leverage}x leverage`
      );
      
      // Validate order parameters
      await this.validateOrder(orderParams);
      
      // Check account balance and margin requirements
      await this.validateAccountBalance(orderParams);
      
      // Get current market data
      const marketData = await this.getMarketData(orderParams.market);
      
      // Calculate execution price
      const executionPrice = await this.calculateExecutionPrice(orderParams, marketData);
      
      // Calculate required margin
      const requiredMargin = this.calculateRequiredMargin(
        orderParams.size,
        executionPrice,
        orderParams.leverage
      );
      
      // Execute order
      const side = orderParams.side === 'long' ? 0 : 1;
      
      const tx = await this.exchangeContract.openPosition(
        orderParams.market,
        side,
        orderParams.size,
        orderParams.price || executionPrice,
        orderParams.leverage,
        orderParams.reduceOnly || false,
        {
          value: requiredMargin, // Margin in native token
          gasLimit: 300000
        }
      );
      
      const receipt = await tx.wait();
      
      // Update position tracking
      await this.updatePositionFromTransaction(receipt, orderParams.market);
      
      this.metrics.recordTransaction({
        protocol: 'citrex',
        action: 'open_position',
        market: orderParams.market,
        side: orderParams.side,
        size: orderParams.size.toString(),
        leverage: orderParams.leverage.toString(),
        price: executionPrice.toString(),
        margin: requiredMargin.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Position opened successfully: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('citrex', 'open_position', error as Error);
      this.logger.error('Failed to open position:', error);
      throw error;
    }
  }

  async closePosition(
    market: string,
    size?: bigint,
    minPrice?: bigint
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for closing positions');
      }
      
      this.logger.info(`Closing position in ${market}`);
      
      // Get current position
      const position = await this.getPosition(this.wallet.address, market);
      if (position.size === BigInt(0)) {
        throw new Error(`No position found in market ${market}`);
      }
      
      const closeSize = size || position.size;
      const currentPrice = await this.getCurrentPrice(market);
      const minimumPrice = minPrice || this.calculateMinAcceptablePrice(currentPrice, position.side);
      
      // Execute close order
      const tx = await this.exchangeContract.closePosition(
        market,
        closeSize,
        minimumPrice,
        {
          gasLimit: 250000
        }
      );
      
      const receipt = await tx.wait();
      
      // Calculate and log PnL
      const pnl = this.calculatePnL(position, currentPrice);
      
      // Update position tracking
      await this.updatePositionFromTransaction(receipt, market);
      
      this.metrics.recordTransaction({
        protocol: 'citrex',
        action: 'close_position',
        market,
        size: closeSize.toString(),
        price: currentPrice.toString(),
        pnl: pnl.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Position closed successfully: ${tx.hash}, PnL: ${formatUnits(pnl, 18)}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('citrex', 'close_position', error as Error);
      this.logger.error('Failed to close position:', error);
      throw error;
    }
  }

  async modifyPosition(
    market: string,
    sizeDelta: bigint,
    price: bigint
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for modifying positions');
      }
      
      this.logger.info(`Modifying position in ${market} by ${formatUnits(sizeDelta, 18)}`);
      
      // Validate modification
      const position = await this.getPosition(this.wallet.address, market);
      await this.validatePositionModification(position, sizeDelta);
      
      const tx = await this.exchangeContract.modifyPosition(
        market,
        sizeDelta,
        price,
        {
          gasLimit: 200000
        }
      );
      
      const receipt = await tx.wait();
      
      // Update position tracking
      await this.updatePositionFromTransaction(receipt, market);
      
      this.metrics.recordTransaction({
        protocol: 'citrex',
        action: 'modify_position',
        market,
        sizeDelta: sizeDelta.toString(),
        price: price.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Position modified successfully: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('citrex', 'modify_position', error as Error);
      this.logger.error('Failed to modify position:', error);
      throw error;
    }
  }

  // Margin management
  async addMargin(market: string, amount: bigint): Promise<string> {
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for margin operations');
      }
      
      this.logger.info(`Adding ${formatUnits(amount, 18)} margin to ${market}`);
      
      const tx = await this.marginEngineContract.addMargin(market, amount, {
        value: amount,
        gasLimit: 150000
      });
      
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'citrex',
        action: 'add_margin',
        market,
        amount: amount.toString(),
        gasUsed: receipt.gasUsed.toString()
      });
      
      this.logger.info(`Margin added successfully: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('citrex', 'add_margin', error as Error);
      this.logger.error('Failed to add margin:', error);
      throw error;
    }
  }

  async removeMargin(market: string, amount: bigint): Promise<string> {
    try {
      if (!this.wallet) {
        throw new Error('Wallet required for margin operations');
      }
      
      this.logger.info(`Removing ${formatUnits(amount, 18)} margin from ${market}`);
      
      // Check if removal is safe
      const position = await this.getPosition(this.wallet.address, market);
      await this.validateMarginRemoval(position, amount);
      
      const tx = await this.marginEngineContract.removeMargin(market, amount, {
        gasLimit: 150000
      });
      
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'citrex',
        action: 'remove_margin',
        market,
        amount: amount.toString(),
        gasUsed: receipt.gasUsed.toString()
      });
      
      this.logger.info(`Margin removed successfully: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('citrex', 'remove_margin', error as Error);
      this.logger.error('Failed to remove margin:', error);
      throw error;
    }
  }

  // Query functions
  async getPosition(userAddress: string, market: string): Promise<PerpetualPosition> {
    try {
      const positionData = await this.exchangeContract.getPosition(userAddress, market);
      
      // Parse position data (structure depends on contract implementation)
      const position: PerpetualPosition = {
        market,
        side: positionData[0] ? 'long' : 'short',
        size: BigInt(positionData[1].toString()),
        entryPrice: BigInt(positionData[2].toString()),
        markPrice: BigInt(positionData[3].toString()),
        unrealizedPnL: BigInt(positionData[4].toString()),
        leverage: Number(positionData[5].toString()),
        margin: BigInt(positionData[6].toString()),
        liquidationPrice: BigInt(positionData[7].toString()),
        fundingPayment: BigInt(positionData[8].toString())
      };
      
      // Cache position
      this.positions.set(`${userAddress}-${market}`, position);
      
      return position;
      
    } catch (error) {
      this.logger.error(`Failed to get position for ${userAddress} in ${market}:`, error);
      throw error;
    }
  }

  async getMarketData(market: string): Promise<MarketData> {
    const cacheKey = market;
    const cached = this.marketDataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const marketData = await this.exchangeContract.getMarketData(market);
      
      const data: MarketData = {
        symbol: market,
        markPrice: BigInt(marketData[0].toString()),
        indexPrice: BigInt(marketData[1].toString()),
        fundingRate: Number(marketData[2].toString()) / 10000, // Basis points to decimal
        openInterest: BigInt(marketData[3].toString()),
        volume24h: BigInt(marketData[4].toString()),
        bid: BigInt(marketData[5].toString()),
        ask: BigInt(marketData[6].toString()),
        spread: Number(marketData[7].toString()) / 10000
      };
      
      this.marketDataCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
      
    } catch (error) {
      this.logger.error(`Failed to get market data for ${market}:`, error);
      throw error;
    }
  }

  async getUserPositions(userAddress: string): Promise<PerpetualPosition[]> {
    try {
      const markets = await this.exchangeContract.getUserPositions(userAddress);
      const positions: PerpetualPosition[] = [];
      
      for (const market of markets) {
        try {
          const position = await this.getPosition(userAddress, market);
          if (position.size > BigInt(0)) {
            positions.push(position);
          }
        } catch (error) {
          this.logger.error(`Failed to get position for market ${market}:`, error);
        }
      }
      
      return positions;
      
    } catch (error) {
      this.logger.error(`Failed to get user positions for ${userAddress}:`, error);
      throw error;
    }
  }

  async getAccountValue(userAddress: string): Promise<{
    totalValue: bigint;
    freeMargin: bigint;
    usedMargin: bigint;
  }> {
    try {
      const accountData = await this.exchangeContract.getAccountValue(userAddress);
      
      return {
        totalValue: BigInt(accountData[0].toString()),
        freeMargin: BigInt(accountData[1].toString()),
        usedMargin: BigInt(accountData[2].toString())
      };
      
    } catch (error) {
      this.logger.error(`Failed to get account value for ${userAddress}:`, error);
      throw error;
    }
  }

  async getCurrentPrice(market: string): Promise<bigint> {
    try {
      const price = await this.oracleContract.getPrice(market);
      return BigInt(price.toString());
    } catch (error) {
      // Fallback to market data
      const marketData = await this.getMarketData(market);
      return marketData.markPrice;
    }
  }

  // Trading strategies and analysis
  async findFundingArbitrage(): Promise<{
    market: string;
    fundingRate: number;
    predictedPayment: bigint;
    strategy: 'long' | 'short';
  }[]> {
    const opportunities: {
      market: string;
      fundingRate: number;
      predictedPayment: bigint;
      strategy: 'long' | 'short';
    }[] = [];
    
    const markets = await this.getSupportedMarkets();
    
    for (const market of markets) {
      try {
        const marketData = await this.getMarketData(market);
        const fundingRate = marketData.fundingRate;
        
        // Look for high funding rates (>0.1% per 8h)
        if (Math.abs(fundingRate) > 0.001) {
          const testSize = parseUnits('1000', 18); // 1000 units
          const predictedPayment = BigInt(Math.floor(Number(testSize) * fundingRate));
          
          opportunities.push({
            market,
            fundingRate,
            predictedPayment,
            strategy: fundingRate > 0 ? 'short' : 'long' // Opposite to funding direction
          });
        }
      } catch (error) {
        this.logger.error(`Failed to analyze funding for ${market}:`, error);
      }
    }
    
    return opportunities.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
  }

  async analyzeLiquidationRisk(userAddress: string): Promise<{
    positions: {
      market: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      liquidationPrice: bigint;
      currentPrice: bigint;
      distanceToLiquidation: number;
    }[];
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const positions = await this.getUserPositions(userAddress);
    const analysis: {
      market: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      liquidationPrice: bigint;
      currentPrice: bigint;
      distanceToLiquidation: number;
    }[] = [];
    
    for (const position of positions) {
      try {
        const currentPrice = await this.getCurrentPrice(position.market);
        const distanceToLiquidation = this.calculateDistanceToLiquidation(position, currentPrice);
        
        let riskLevel: 'low' | 'medium' | 'high' | 'critical';
        if (distanceToLiquidation > 0.2) riskLevel = 'low';
        else if (distanceToLiquidation > 0.1) riskLevel = 'medium';
        else if (distanceToLiquidation > 0.05) riskLevel = 'high';
        else riskLevel = 'critical';
        
        analysis.push({
          market: position.market,
          riskLevel,
          liquidationPrice: position.liquidationPrice,
          currentPrice,
          distanceToLiquidation
        });
      } catch (error) {
        this.logger.error(`Failed to analyze risk for ${position.market}:`, error);
      }
    }
    
    // Calculate overall risk
    const highRiskPositions = analysis.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical');
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    
    if (highRiskPositions.length > 0) {
      overallRisk = highRiskPositions.some(p => p.riskLevel === 'critical') ? 'critical' : 'high';
    } else if (analysis.some(p => p.riskLevel === 'medium')) {
      overallRisk = 'medium';
    } else {
      overallRisk = 'low';
    }
    
    return { positions: analysis, overallRisk };
  }

  // Helper functions
  private async validateOrder(orderParams: OrderParams): Promise<void> {
    if (orderParams.leverage > this.config.maxLeverage) {
      throw new Error(`Leverage ${orderParams.leverage} exceeds maximum ${this.config.maxLeverage}`);
    }
    
    if (orderParams.size > this.config.riskParameters.maxPositionSize) {
      throw new Error(`Position size exceeds maximum allowed`);
    }
  }

  private async validateAccountBalance(orderParams: OrderParams): Promise<void> {
    if (!this.wallet) return;
    
    const accountValue = await this.getAccountValue(this.wallet.address);
    const requiredMargin = this.calculateRequiredMargin(
      orderParams.size,
      orderParams.price || BigInt(0),
      orderParams.leverage
    );
    
    if (accountValue.freeMargin < requiredMargin) {
      throw new Error(
        `Insufficient margin. Required: ${formatUnits(requiredMargin, 18)}, ` +
        `Available: ${formatUnits(accountValue.freeMargin, 18)}`
      );
    }
  }

  private calculateRequiredMargin(size: bigint, price: bigint, leverage: number): bigint {
    const notionalValue = (size * price) / BigInt(10 ** 18);
    return notionalValue / BigInt(leverage);
  }

  private calculateExecutionPrice(orderParams: OrderParams, marketData: MarketData): bigint {
    if (orderParams.orderType === 'market') {
      return orderParams.side === 'long' ? marketData.ask : marketData.bid;
    }
    return orderParams.price || marketData.markPrice;
  }

  private calculateMinAcceptablePrice(currentPrice: bigint, side: 'long' | 'short'): bigint {
    const slippageMultiplier = BigInt(Math.floor((1 - this.MAX_SLIPPAGE) * 10000));
    
    if (side === 'long') {
      // For closing long, we want minimum sell price
      return (currentPrice * slippageMultiplier) / BigInt(10000);
    } else {
      // For closing short, we want maximum buy price
      return (currentPrice * BigInt(10000 + Math.floor(this.MAX_SLIPPAGE * 10000))) / BigInt(10000);
    }
  }

  private calculatePnL(position: PerpetualPosition, currentPrice: bigint): bigint {
    const sizeBigInt = position.size;
    const entryPriceBigInt = position.entryPrice;
    
    if (position.side === 'long') {
      return ((currentPrice - entryPriceBigInt) * sizeBigInt) / BigInt(10 ** 18);
    } else {
      return ((entryPriceBigInt - currentPrice) * sizeBigInt) / BigInt(10 ** 18);
    }
  }

  private calculateDistanceToLiquidation(position: PerpetualPosition, currentPrice: bigint): number {
    const liquidationPrice = position.liquidationPrice;
    
    if (position.side === 'long') {
      return Number(currentPrice - liquidationPrice) / Number(currentPrice);
    } else {
      return Number(liquidationPrice - currentPrice) / Number(currentPrice);
    }
  }

  private async validatePositionModification(position: PerpetualPosition, sizeDelta: bigint): Promise<void> {
    const newSize = position.size + sizeDelta;
    
    if (newSize > this.config.riskParameters.maxPositionSize) {
      throw new Error('Position modification would exceed maximum position size');
    }
  }

  private async validateMarginRemoval(position: PerpetualPosition, amount: bigint): Promise<void> {
    const newMargin = position.margin - amount;
    const requiredMargin = (position.size * position.markPrice) / BigInt(position.leverage) / BigInt(10 ** 18);
    
    if (newMargin < requiredMargin) {
      throw new Error('Margin removal would bring position below minimum requirement');
    }
  }

  private async loadUserPositions(): Promise<void> {
    if (!this.wallet) return;
    
    try {
      const positions = await this.getUserPositions(this.wallet.address);
      for (const position of positions) {
        this.positions.set(`${this.wallet.address}-${position.market}`, position);
      }
      
      this.logger.info(`Loaded ${positions.length} user positions`);
    } catch (error) {
      this.logger.error('Failed to load user positions:', error);
    }
  }

  private startPositionMonitoring(): void {
    setInterval(async () => {
      if (!this.wallet) return;
      
      try {
        await this.loadUserPositions();
        
        // Check for liquidation risks
        const riskAnalysis = await this.analyzeLiquidationRisk(this.wallet.address);
        if (riskAnalysis.overallRisk === 'high' || riskAnalysis.overallRisk === 'critical') {
          this.logger.warn('High liquidation risk detected:', riskAnalysis);
          this.emit('liquidationRiskAlert', riskAnalysis);
        }
      } catch (error) {
        this.logger.error('Error in position monitoring:', error);
      }
    }, this.POSITION_REFRESH_INTERVAL);
  }

  private async updatePositionFromTransaction(receipt: any, market: string): Promise<void> {
    if (!this.wallet) return;
    
    try {
      // Refresh position data after transaction
      const updatedPosition = await this.getPosition(this.wallet.address, market);
      this.positions.set(`${this.wallet.address}-${market}`, updatedPosition);
    } catch (error) {
      this.logger.error('Failed to update position from transaction:', error);
    }
  }

  private async getSupportedMarkets(): Promise<string[]> {
    // Return list of supported perpetual markets
    return ['BTC-PERP', 'ETH-PERP', 'SEI-PERP', 'SOL-PERP', 'AVAX-PERP'];
  }

  // Public utility methods
  async getProtocolStats(): Promise<{
    totalOpenInterest: bigint;
    totalVolume24h: bigint;
    numberOfMarkets: number;
    averageFundingRate: number;
  }> {
    const markets = await this.getSupportedMarkets();
    let totalOI = BigInt(0);
    let totalVolume = BigInt(0);
    let totalFundingRate = 0;
    
    for (const market of markets) {
      try {
        const marketData = await this.getMarketData(market);
        totalOI += marketData.openInterest;
        totalVolume += marketData.volume24h;
        totalFundingRate += marketData.fundingRate;
      } catch (error) {
        this.logger.error(`Failed to get stats for ${market}:`, error);
      }
    }
    
    return {
      totalOpenInterest: totalOI,
      totalVolume24h: totalVolume,
      numberOfMarkets: markets.length,
      averageFundingRate: totalFundingRate / markets.length
    };
  }

  getMetrics() {
    return this.metrics.getProtocolMetrics('citrex');
  }

  async shutdown(): Promise<void> {
    this.positions.clear();
    this.marketDataCache.clear();
    await this.metrics.shutdown();
    this.logger.info('Citrex integration shut down');
  }
}

export default CitrexIntegration;