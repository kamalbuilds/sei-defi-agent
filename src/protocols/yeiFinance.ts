import { Contract, Wallet, JsonRpcProvider, formatUnits, parseUnits } from 'ethers';
import { SeiAgentKit } from 'sei-agent-kit';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../infrastructure/monitoring/metrics';

export interface YeiFinanceConfig {
  contractAddress: string;
  rpcUrl: string;
  privateKey?: string;
  walletAddress?: string;
}

export interface LendingPosition {
  asset: string;
  supplied: bigint;
  borrowed: bigint;
  supplyAPY: number;
  borrowAPY: number;
  healthFactor: number;
  collateralValue: bigint;
  liquidationThreshold: number;
}

export interface MarketData {
  asset: string;
  totalSupply: bigint;
  totalBorrow: bigint;
  supplyAPY: number;
  borrowAPY: number;
  reserveFactor: number;
  utilizationRate: number;
  liquidity: bigint;
}

// YEI Finance protocol ABI (simplified)
const YEI_FINANCE_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to)',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf)',
  'function getUserAccountData(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)',
  'function getReserveData(address asset) view returns (tuple)',
  'function flashLoan(address receiverAddress, address[] assets, uint256[] amounts, uint256[] modes, address onBehalfOf, bytes params, uint16 referralCode)',
  'function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken)',
  'function setUserUseReserveAsCollateral(address asset, bool useAsCollateral)'
];

export class YeiFinanceIntegration {
  private config: YeiFinanceConfig;
  private seiKit: SeiAgentKit;
  private contract: Contract;
  private logger: Logger;
  private metrics: MetricsCollector;
  private provider: JsonRpcProvider;
  private wallet?: Wallet;
  
  // Protocol constants
  private readonly STABLE_RATE_MODE = 1;
  private readonly VARIABLE_RATE_MODE = 2;
  private readonly MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
  
  // Risk parameters
  private readonly MIN_HEALTH_FACTOR = 1.5;
  private readonly LIQUIDATION_THRESHOLD = 0.8;
  private readonly MAX_LEVERAGE = 3;

  constructor(config: YeiFinanceConfig) {
    this.config = config;
    this.logger = new Logger('YeiFinanceIntegration');
    this.metrics = new MetricsCollector();
    this.provider = new JsonRpcProvider(config.rpcUrl);
    
    if (config.privateKey) {
      this.wallet = new Wallet(config.privateKey, this.provider);
      this.seiKit = new SeiAgentKit(this.wallet);
    } else {
      this.seiKit = new SeiAgentKit();
    }
    
    this.contract = new Contract(
      config.contractAddress,
      YEI_FINANCE_ABI,
      this.wallet || this.provider
    );
  }

  async initialize(): Promise<void> {
    try {
      // Verify contract is accessible
      await this.contract.getAddress();
      
      // Initialize metrics collection
      await this.metrics.initialize();
      
      this.logger.info('YEI Finance integration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize YEI Finance integration:', error);
      throw error;
    }
  }

  // Core lending functions
  async supply(
    asset: string,
    amount: bigint,
    onBehalfOf?: string,
    referralCode: number = 0
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Supplying ${formatUnits(amount, 18)} of ${asset} to YEI Finance`);
      
      if (!this.wallet) {
        throw new Error('Wallet required for supply operation');
      }
      
      const recipient = onBehalfOf || this.wallet.address;
      
      // Check allowance and approve if needed
      await this.ensureTokenApproval(asset, amount);
      
      // Execute supply transaction
      const tx = await this.contract.supply(
        asset,
        amount,
        recipient,
        referralCode
      );
      
      const receipt = await tx.wait();
      
      // Record metrics
      this.metrics.recordTransaction({
        protocol: 'yei_finance',
        action: 'supply',
        asset,
        amount: amount.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Supply successful: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('yei_finance', 'supply', error as Error);
      this.logger.error('Supply failed:', error);
      throw error;
    }
  }

  async withdraw(
    asset: string,
    amount: bigint,
    to?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Withdrawing ${formatUnits(amount, 18)} of ${asset} from YEI Finance`);
      
      if (!this.wallet) {
        throw new Error('Wallet required for withdraw operation');
      }
      
      const recipient = to || this.wallet.address;
      
      // Check available liquidity
      const position = await this.getUserPosition(this.wallet.address);
      await this.validateWithdrawal(asset, amount, position);
      
      // Execute withdrawal
      const tx = await this.contract.withdraw(asset, amount, recipient);
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'yei_finance',
        action: 'withdraw',
        asset,
        amount: amount.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Withdrawal successful: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('yei_finance', 'withdraw', error as Error);
      this.logger.error('Withdrawal failed:', error);
      throw error;
    }
  }

  async borrow(
    asset: string,
    amount: bigint,
    interestRateMode: number = this.VARIABLE_RATE_MODE,
    onBehalfOf?: string,
    referralCode: number = 0
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Borrowing ${formatUnits(amount, 18)} of ${asset} from YEI Finance`);
      
      if (!this.wallet) {
        throw new Error('Wallet required for borrow operation');
      }
      
      const borrower = onBehalfOf || this.wallet.address;
      
      // Check borrowing capacity and health factor
      const position = await this.getUserPosition(borrower);
      await this.validateBorrowing(asset, amount, position);
      
      // Execute borrow transaction
      const tx = await this.contract.borrow(
        asset,
        amount,
        interestRateMode,
        referralCode,
        borrower
      );
      
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'yei_finance',
        action: 'borrow',
        asset,
        amount: amount.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Borrow successful: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('yei_finance', 'borrow', error as Error);
      this.logger.error('Borrow failed:', error);
      throw error;
    }
  }

  async repay(
    asset: string,
    amount: bigint,
    rateMode: number = this.VARIABLE_RATE_MODE,
    onBehalfOf?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Repaying ${formatUnits(amount, 18)} of ${asset} to YEI Finance`);
      
      if (!this.wallet) {
        throw new Error('Wallet required for repay operation');
      }
      
      const borrower = onBehalfOf || this.wallet.address;
      
      // Check and approve tokens if needed
      await this.ensureTokenApproval(asset, amount);
      
      // Execute repay transaction
      const tx = await this.contract.repay(asset, amount, rateMode, borrower);
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'yei_finance',
        action: 'repay',
        asset,
        amount: amount.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Repay successful: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('yei_finance', 'repay', error as Error);
      this.logger.error('Repay failed:', error);
      throw error;
    }
  }

  // Flash loan functionality
  async executeFlashLoan(
    assets: string[],
    amounts: bigint[],
    modes: number[],
    receiverAddress: string,
    params: string = '0x',
    referralCode: number = 0
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Executing flash loan for assets: ${assets.join(', ')}`);
      
      if (!this.wallet) {
        throw new Error('Wallet required for flash loan operation');
      }
      
      // Validate flash loan parameters
      if (assets.length !== amounts.length || assets.length !== modes.length) {
        throw new Error('Assets, amounts, and modes arrays must have same length');
      }
      
      const tx = await this.contract.flashLoan(
        receiverAddress,
        assets,
        amounts,
        modes,
        this.wallet.address,
        params,
        referralCode
      );
      
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'yei_finance',
        action: 'flash_loan',
        asset: assets.join(','),
        amount: amounts.map(a => a.toString()).join(','),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Flash loan successful: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('yei_finance', 'flash_loan', error as Error);
      this.logger.error('Flash loan failed:', error);
      throw error;
    }
  }

  // Liquidation functionality
  async liquidate(
    collateralAsset: string,
    debtAsset: string,
    user: string,
    debtToCover: bigint,
    receiveAToken: boolean = false
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Liquidating user ${user} - covering ${formatUnits(debtToCover, 18)} ${debtAsset}`);
      
      if (!this.wallet) {
        throw new Error('Wallet required for liquidation operation');
      }
      
      // Check if liquidation is profitable and valid
      const position = await this.getUserPosition(user);
      await this.validateLiquidation(user, position, debtToCover);
      
      // Ensure we have enough tokens to cover the debt
      await this.ensureTokenApproval(debtAsset, debtToCover);
      
      const tx = await this.contract.liquidationCall(
        collateralAsset,
        debtAsset,
        user,
        debtToCover,
        receiveAToken
      );
      
      const receipt = await tx.wait();
      
      this.metrics.recordTransaction({
        protocol: 'yei_finance',
        action: 'liquidation',
        asset: `${debtAsset}/${collateralAsset}`,
        amount: debtToCover.toString(),
        gasUsed: receipt.gasUsed.toString(),
        duration: Date.now() - startTime
      });
      
      this.logger.info(`Liquidation successful: ${tx.hash}`);
      return tx.hash;
      
    } catch (error) {
      this.metrics.recordError('yei_finance', 'liquidation', error as Error);
      this.logger.error('Liquidation failed:', error);
      throw error;
    }
  }

  // Query functions
  async getUserPosition(userAddress: string): Promise<LendingPosition> {
    try {
      const accountData = await this.contract.getUserAccountData(userAddress);
      
      // Parse account data
      const [
        totalCollateralETH,
        totalDebtETH,
        availableBorrowsETH,
        currentLiquidationThreshold,
        ltv,
        healthFactor
      ] = accountData;
      
      return {
        asset: 'ETH', // Base currency
        supplied: totalCollateralETH,
        borrowed: totalDebtETH,
        supplyAPY: 0, // Would need additional calls to get APY
        borrowAPY: 0,
        healthFactor: parseFloat(formatUnits(healthFactor, 18)),
        collateralValue: totalCollateralETH,
        liquidationThreshold: parseFloat(formatUnits(currentLiquidationThreshold, 4)) / 100
      };
      
    } catch (error) {
      this.logger.error(`Failed to get user position for ${userAddress}:`, error);
      throw error;
    }
  }

  async getMarketData(asset: string): Promise<MarketData> {
    try {
      const reserveData = await this.contract.getReserveData(asset);
      
      // Parse reserve data (structure depends on YEI Finance implementation)
      return {
        asset,
        totalSupply: BigInt(0), // Parse from reserveData
        totalBorrow: BigInt(0),
        supplyAPY: 0,
        borrowAPY: 0,
        reserveFactor: 0,
        utilizationRate: 0,
        liquidity: BigInt(0)
      };
      
    } catch (error) {
      this.logger.error(`Failed to get market data for ${asset}:`, error);
      throw error;
    }
  }

  async getOptimalSupplyAPY(): Promise<{ asset: string; apy: number }[]> {
    // Get current market rates for all supported assets
    const supportedAssets = await this.getSupportedAssets();
    const apyData: { asset: string; apy: number }[] = [];
    
    for (const asset of supportedAssets) {
      try {
        const marketData = await this.getMarketData(asset);
        apyData.push({
          asset,
          apy: marketData.supplyAPY
        });
      } catch (error) {
        this.logger.error(`Failed to get APY for ${asset}:`, error);
      }
    }
    
    // Sort by APY descending
    return apyData.sort((a, b) => b.apy - a.apy);
  }

  async getBorrowingOpportunities(): Promise<{
    asset: string;
    borrowAPY: number;
    availableLiquidity: bigint;
    utilizationRate: number;
  }[]> {
    const supportedAssets = await this.getSupportedAssets();
    const opportunities: {
      asset: string;
      borrowAPY: number;
      availableLiquidity: bigint;
      utilizationRate: number;
    }[] = [];
    
    for (const asset of supportedAssets) {
      try {
        const marketData = await this.getMarketData(asset);
        
        // Only include assets with reasonable liquidity
        if (marketData.liquidity > parseUnits('1000', 18)) {
          opportunities.push({
            asset,
            borrowAPY: marketData.borrowAPY,
            availableLiquidity: marketData.liquidity,
            utilizationRate: marketData.utilizationRate
          });
        }
      } catch (error) {
        this.logger.error(`Failed to get borrowing data for ${asset}:`, error);
      }
    }
    
    // Sort by lowest borrowing rate
    return opportunities.sort((a, b) => a.borrowAPY - b.borrowAPY);
  }

  async findLiquidationOpportunities(): Promise<{
    user: string;
    healthFactor: number;
    collateralValue: bigint;
    debtValue: bigint;
    profitPotential: number;
  }[]> {
    // This would require additional indexing or event monitoring
    // For now, return empty array - would need to implement position monitoring
    this.logger.info('Scanning for liquidation opportunities...');
    return [];
  }

  // Validation functions
  private async validateWithdrawal(
    asset: string,
    amount: bigint,
    position: LendingPosition
  ): Promise<void> {
    if (position.healthFactor < this.MIN_HEALTH_FACTOR) {
      throw new Error(`Health factor too low: ${position.healthFactor}`);
    }
    
    // Additional validation logic
  }

  private async validateBorrowing(
    asset: string,
    amount: bigint,
    position: LendingPosition
  ): Promise<void> {
    // Calculate new health factor after borrowing
    const newHealthFactor = this.calculateNewHealthFactor(position, amount, 'borrow');
    
    if (newHealthFactor < this.MIN_HEALTH_FACTOR) {
      throw new Error(`Borrowing would reduce health factor to: ${newHealthFactor}`);
    }
  }

  private async validateLiquidation(
    user: string,
    position: LendingPosition,
    debtToCover: bigint
  ): Promise<void> {
    if (position.healthFactor >= 1.0) {
      throw new Error(`User ${user} is not liquidatable (health factor: ${position.healthFactor})`);
    }
    
    // Calculate liquidation bonus to ensure profitability
    const liquidationBonus = this.calculateLiquidationBonus(position);
    if (liquidationBonus < 0.05) { // 5% minimum profit
      throw new Error('Liquidation not profitable enough');
    }
  }

  private calculateNewHealthFactor(
    position: LendingPosition,
    amount: bigint,
    operation: 'borrow' | 'repay' | 'supply' | 'withdraw'
  ): number {
    // Simplified health factor calculation
    let newCollateral = position.collateralValue;
    let newDebt = position.borrowed;
    
    switch (operation) {
      case 'borrow':
        newDebt = newDebt + amount;
        break;
      case 'repay':
        newDebt = newDebt - amount;
        break;
      case 'supply':
        newCollateral = newCollateral + amount;
        break;
      case 'withdraw':
        newCollateral = newCollateral - amount;
        break;
    }
    
    if (newDebt === BigInt(0)) return Number.MAX_SAFE_INTEGER;
    
    return Number(newCollateral * BigInt(Math.floor(position.liquidationThreshold * 100))) / 
           (Number(newDebt) * 100);
  }

  private calculateLiquidationBonus(position: LendingPosition): number {
    // Calculate expected liquidation bonus (typically 5-10%)
    return 0.05 + (1.0 - position.healthFactor) * 0.05;
  }

  private async ensureTokenApproval(tokenAddress: string, amount: bigint): Promise<void> {
    // Implementation would check and approve ERC20 token spending
    // This is simplified - would use ERC20 contract calls
    this.logger.debug(`Ensuring token approval for ${tokenAddress}`);
  }

  private async getSupportedAssets(): Promise<string[]> {
    // Return supported asset addresses
    return [
      '0x...', // USDC
      '0x...', // USDT
      '0x...', // ETH
      '0x...', // SEI
    ];
  }

  // Utility functions
  async getProtocolStats(): Promise<{
    totalValueLocked: bigint;
    totalBorrowed: bigint;
    numberOfUsers: number;
    averageAPY: number;
  }> {
    return {
      totalValueLocked: BigInt(0),
      totalBorrowed: BigInt(0),
      numberOfUsers: 0,
      averageAPY: 0
    };
  }

  getMetrics() {
    return this.metrics.getProtocolMetrics('yei_finance');
  }

  async shutdown(): Promise<void> {
    await this.metrics.shutdown();
    this.logger.info('YEI Finance integration shut down');
  }
}

export default YeiFinanceIntegration;