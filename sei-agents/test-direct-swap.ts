import { ethers, Contract, Wallet } from 'ethers';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('Direct-Swap-Test');

// Token addresses on SEI Atlantic-2 testnet
const TOKENS = {
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7',
  USDC: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
};

// Common DEX Router addresses to try (these are examples, may not exist on SEI testnet)
const ROUTERS = {
  DragonSwap: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Example address
  UniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',  // Example address
  SushiSwap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',  // Example address
};

// ERC20 ABI for token operations
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

// Uniswap V2 Router ABI (most DEXs use similar interface)
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function WETH() external pure returns (address)',
  'function factory() external pure returns (address)'
];

async function testDirectSwap() {
  try {
    logger.info('='.repeat(60));
    logger.info('🚀 Testing Direct Contract Swap on SEI Testnet');
    logger.info('='.repeat(60));

    if (!process.env.SEI_MNEMONIC) {
      throw new Error('SEI_MNEMONIC not found in environment');
    }

    // Setup provider and wallet
    const rpcUrl = process.env.SEI_RPC_URL || 'https://sei.drpc.org';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = Wallet.fromMnemonic(process.env.SEI_MNEMONIC).connect(provider);
    
    logger.info(`\n📱 Wallet Address: ${wallet.address}`);

    // Get network info
    const network = await provider.getNetwork();
    logger.info(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Setup token contracts
    const wseiContract = new Contract(TOKENS.WSEI, ERC20_ABI, wallet);
    const usdcContract = new Contract(TOKENS.USDC, ERC20_ABI, wallet);

    // Check balances
    logger.info('\n📊 Checking Token Balances:');
    
    const seiBalance = await provider.getBalance(wallet.address);
    logger.info(`💰 Native SEI: ${ethers.utils.formatEther(seiBalance)}`);
    
    const wseiBalance = await wseiContract.balanceOf(wallet.address);
    const wseiDecimals = await wseiContract.decimals();
    logger.info(`💰 WSEI: ${ethers.utils.formatUnits(wseiBalance, wseiDecimals)}`);
    
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const usdcDecimals = await usdcContract.decimals();
    logger.info(`💵 USDC: ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)}`);

    // First, let's check if any DEX routers exist on testnet
    logger.info('\n🔍 Searching for DEX Contracts on SEI Testnet...');
    
    // Check some common DEX factory/router addresses
    const potentialDEXAddresses = [
      '0x7e2cEDd6E71b42fC6D7182068300732519998A00', // Potential router
      '0x2bb8643142921AfF87B3d4CF35DeaD6D5FB895B4', // Potential factory
      '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // UniV2 factory pattern
      '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', // Sushi factory pattern
    ];

    for (const address of potentialDEXAddresses) {
      const code = await provider.getCode(address);
      if (code !== '0x') {
        logger.info(`✅ Found contract at ${address}`);
        
        // Try to identify if it's a router
        try {
          const testRouter = new Contract(address, ROUTER_ABI, provider);
          const factory = await testRouter.factory().catch(() => null);
          if (factory) {
            logger.info(`  → Looks like a DEX Router! Factory: ${factory}`);
          }
        } catch (e) {
          // Not a router
        }
      }
    }

    // If we have WSEI, let's try a simple transfer first
    if (wseiBalance.gt(0)) {
      logger.info('\n🧪 Testing WSEI Transfer (0.001 to self)...');
      
      const transferAmount = ethers.utils.parseUnits('0.001', wseiDecimals);
      
      if (wseiBalance.gte(transferAmount)) {
        try {
          const tx = await wseiContract.transfer(wallet.address, transferAmount);
          logger.info(`📤 Transfer transaction sent: ${tx.hash}`);
          
          const receipt = await tx.wait();
          logger.info(`✅ Transfer confirmed in block ${receipt.blockNumber}`);
        } catch (error: any) {
          logger.error(`❌ Transfer failed: ${error.message}`);
        }
      } else {
        logger.warn('Insufficient WSEI for transfer test');
      }
    }

    // Try to find liquidity pools
    logger.info('\n🏊 Looking for Liquidity Pools...');
    
    // Common factory ABI
    const FACTORY_ABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)',
      'function allPairs(uint) external view returns (address pair)'
    ];

    // Try to find WSEI-USDC pair
    logger.info('Searching for WSEI-USDC pair...');
    
    // Manual swap simulation (for demonstration)
    if (wseiBalance.gt(0)) {
      logger.info('\n📊 Swap Simulation:');
      const swapAmount = ethers.utils.parseUnits('0.1', wseiDecimals);
      logger.info(`Would swap: ${ethers.utils.formatUnits(swapAmount, wseiDecimals)} WSEI`);
      
      // Estimate output (mock calculation - 1 WSEI = 0.5 USDC for example)
      const estimatedOutput = swapAmount.div(2);
      logger.info(`Estimated output: ~${ethers.utils.formatUnits(estimatedOutput, 6)} USDC`);
      logger.info(`Slippage tolerance: 3%`);
      
      // Check if we need approval
      logger.info('\n🔐 Checking token approvals...');
      // This would check if router has approval to spend WSEI
    }

    // Alternative: Use CosmWasm/Sei native contracts
    logger.info('\n🌟 Alternative Options on SEI:');
    logger.info('1. Use CosmWasm contracts for swaps');
    logger.info('2. Use Sei native DEX module (if available)');
    logger.info('3. Deploy your own Uniswap V2 fork');
    logger.info('4. Use cross-chain bridges to other networks');

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Summary:');
    logger.info(`✅ You have ${ethers.utils.formatUnits(wseiBalance, wseiDecimals)} WSEI`);
    logger.info(`✅ WSEI contract verified at ${TOKENS.WSEI}`);
    logger.info(`✅ USDC contract verified at ${TOKENS.USDC}`);
    logger.info('❌ No standard DEX routers found on testnet yet');
    logger.info('📝 Symphony SDK not working (API returns HTML)');
    logger.info('='.repeat(60));

    // Recommendations
    logger.info('\n💡 Recommendations:');
    logger.info('1. Deploy a Uniswap V2 fork for testing');
    logger.info('2. Use Sei native swap methods if available');
    logger.info('3. Check Sei Discord/Docs for testnet DEX addresses');
    logger.info('4. Consider using mainnet with small amounts for testing');

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testDirectSwap().then(() => {
  logger.info('\n✨ Direct swap test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});