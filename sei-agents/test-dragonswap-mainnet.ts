import { ethers, Contract, Wallet } from 'ethers';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('DragonSwap-Mainnet');

// DragonSwap V3 Contract Addresses on SEI Mainnet (lowercase to avoid checksum)
const DRAGONSWAP_V3 = {
  SWAP_ROUTER: '0x4be6b9b472120804f5b0312f3db91e133f5c7613', // V3 SwapRouter
  QUOTER: '0x0d06a37fb92d922fbf11086eec1099b07fa8c1e4', // V3 Quoter  
  FACTORY: '0x6d4e10523316478641f16761e8ca003c94e43ff4', // V3 Factory
  NFT_MANAGER: '0x5ef7301d8857c672bfc193f34378a408d2c1dc02', // NonfungiblePositionManager
};

// DragonSwap V2 Contract Addresses (if V3 doesn't work)
const DRAGONSWAP_V2 = {
  ROUTER: '0xb3b96f7aac1630c7929b84db994c3e6094e183bb', // V2 Router
  FACTORY: '0xe5020961fa51ffd3662cdf307def18f9a87cce7c', // V2 Factory
};

// Token Addresses on SEI Mainnet
const TOKENS = {
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7',
  USDC: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
};

// V3 SwapRouter ABI (simplified)
const V3_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)',
];

// V2 Router ABI (Uniswap V2 compatible)
const V2_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
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
];

async function testDragonSwapMainnet() {
  try {
    logger.info('='.repeat(60));
    logger.info('🐉 Testing DragonSwap on SEI Mainnet');
    logger.info('='.repeat(60));

    if (!process.env.SEI_MNEMONIC) {
      throw new Error('SEI_MNEMONIC not found in environment');
    }

    // Setup provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.SEI_RPC_URL);
    const wallet = Wallet.fromMnemonic(process.env.SEI_MNEMONIC).connect(provider);
    
    logger.info(`\n📱 Wallet Address: ${wallet.address}`);

    // Check network
    const network = await provider.getNetwork();
    logger.info(`🌐 Network: SEI Mainnet (Chain ID: ${network.chainId})`);

    // Setup token contracts
    const wseiContract = new Contract(TOKENS.WSEI, ERC20_ABI, wallet);
    const usdcContract = new Contract(TOKENS.USDC, ERC20_ABI, wallet);

    // Check balances
    logger.info('\n📊 Current Balances:');
    
    const seiBalance = await provider.getBalance(wallet.address);
    logger.info(`💰 Native SEI: ${ethers.utils.formatEther(seiBalance)}`);
    
    const wseiBalance = await wseiContract.balanceOf(wallet.address);
    logger.info(`💰 WSEI: ${ethers.utils.formatEther(wseiBalance)}`);
    
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const usdcDecimals = await usdcContract.decimals();
    logger.info(`💵 USDC: ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)}`);

    // Check if DragonSwap V3 exists
    logger.info('\n🔍 Checking DragonSwap V3...');
    const v3RouterCode = await provider.getCode(DRAGONSWAP_V3.SWAP_ROUTER);
    
    if (v3RouterCode !== '0x' && v3RouterCode.length > 2) {
      logger.info(`✅ DragonSwap V3 Router found at ${DRAGONSWAP_V3.SWAP_ROUTER}`);
      
      // Try V3 swap
      if (wseiBalance.gt(0)) {
        logger.info('\n🔄 Attempting V3 Swap: 0.1 WSEI -> USDC');
        
        const routerV3 = new Contract(DRAGONSWAP_V3.SWAP_ROUTER, V3_ROUTER_ABI, wallet);
        const amountIn = ethers.utils.parseEther('0.1');
        
        // Check and approve WSEI
        const allowance = await wseiContract.allowance(wallet.address, DRAGONSWAP_V3.SWAP_ROUTER);
        if (allowance.lt(amountIn)) {
          logger.info('🔐 Approving WSEI...');
          const approveTx = await wseiContract.approve(DRAGONSWAP_V3.SWAP_ROUTER, ethers.constants.MaxUint256);
          await approveTx.wait();
          logger.info('✅ Approval confirmed');
        }
        
        // Prepare swap params
        const params = {
          tokenIn: TOKENS.WSEI,
          tokenOut: TOKENS.USDC,
          fee: 3000, // 0.3% fee tier
          recipient: wallet.address,
          deadline: Math.floor(Date.now() / 1000) + 60 * 20,
          amountIn: amountIn,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0
        };
        
        try {
          logger.info('📤 Sending V3 swap transaction...');
          const swapTx = await routerV3.exactInputSingle(params, {
            gasLimit: 500000
          });
          
          logger.info(`⏳ Transaction sent: ${swapTx.hash}`);
          const receipt = await swapTx.wait();
          logger.info(`✅ V3 Swap confirmed in block ${receipt.blockNumber}`);
          
          // Check new balances
          const newWseiBalance = await wseiContract.balanceOf(wallet.address);
          const newUsdcBalance = await usdcContract.balanceOf(wallet.address);
          
          logger.info('\n📊 Balances After V3 Swap:');
          logger.info(`WSEI: ${ethers.utils.formatEther(newWseiBalance)} (was ${ethers.utils.formatEther(wseiBalance)})`);
          logger.info(`USDC: ${ethers.utils.formatUnits(newUsdcBalance, usdcDecimals)} (was ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)})`);
          
        } catch (error: any) {
          logger.error(`V3 Swap failed: ${error.message}`);
        }
      }
      
    } else {
      logger.warn('❌ DragonSwap V3 not found, trying V2...');
      
      // Check V2
      const v2RouterCode = await provider.getCode(DRAGONSWAP_V2.ROUTER);
      
      if (v2RouterCode !== '0x' && v2RouterCode.length > 2) {
        logger.info(`✅ DragonSwap V2 Router found at ${DRAGONSWAP_V2.ROUTER}`);
        
        if (wseiBalance.gt(0)) {
          logger.info('\n🔄 Attempting V2 Swap: 0.1 WSEI -> USDC');
          
          const routerV2 = new Contract(DRAGONSWAP_V2.ROUTER, V2_ROUTER_ABI, wallet);
          const amountIn = ethers.utils.parseEther('0.1');
          
          // Check router's WETH/WSEI
          try {
            const weth = await routerV2.WETH();
            logger.info(`Router WETH/WSEI: ${weth}`);
            
            // Get expected output
            const path = [TOKENS.WSEI, TOKENS.USDC];
            const amountsOut = await routerV2.getAmountsOut(amountIn, path);
            const expectedOut = amountsOut[1];
            logger.info(`Expected output: ${ethers.utils.formatUnits(expectedOut, usdcDecimals)} USDC`);
            
            // Check and approve WSEI
            const allowance = await wseiContract.allowance(wallet.address, DRAGONSWAP_V2.ROUTER);
            if (allowance.lt(amountIn)) {
              logger.info('🔐 Approving WSEI for V2 Router...');
              const approveTx = await wseiContract.approve(DRAGONSWAP_V2.ROUTER, ethers.constants.MaxUint256);
              await approveTx.wait();
              logger.info('✅ Approval confirmed');
            }
            
            // Execute swap
            const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
            const minOut = expectedOut.mul(97).div(100); // 3% slippage
            
            logger.info('📤 Sending V2 swap transaction...');
            const swapTx = await routerV2.swapExactTokensForTokens(
              amountIn,
              minOut,
              path,
              wallet.address,
              deadline,
              {
                gasLimit: 500000
              }
            );
            
            logger.info(`⏳ Transaction sent: ${swapTx.hash}`);
            const receipt = await swapTx.wait();
            logger.info(`✅ V2 Swap confirmed in block ${receipt.blockNumber}`);
            
            // Check new balances
            const newWseiBalance = await wseiContract.balanceOf(wallet.address);
            const newUsdcBalance = await usdcContract.balanceOf(wallet.address);
            
            logger.info('\n📊 Balances After V2 Swap:');
            logger.info(`WSEI: ${ethers.utils.formatEther(newWseiBalance)} (was ${ethers.utils.formatEther(wseiBalance)})`);
            logger.info(`USDC: ${ethers.utils.formatUnits(newUsdcBalance, usdcDecimals)} (was ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)})`);
            
          } catch (error: any) {
            logger.error(`V2 Swap failed: ${error.message}`);
          }
        }
        
      } else {
        logger.warn('❌ DragonSwap V2 also not found');
        logger.info('💡 DragonSwap may not be deployed yet or addresses are different');
      }
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Summary:');
    logger.info(`✅ Connected to SEI Mainnet (Chain ${network.chainId})`);
    logger.info(`✅ You have ${ethers.utils.formatEther(wseiBalance)} WSEI`);
    logger.info(`✅ You have ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)} USDC`);
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testDragonSwapMainnet().then(() => {
  logger.info('\n✨ DragonSwap mainnet test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});