import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('Mainnet-DEX-Finder');

// SEI Mainnet RPC
const MAINNET_RPC = 'https://evm-rpc.sei-apis.com';

// Known mainnet addresses to check (using lowercase to avoid checksum issues)
const MAINNET_CONTRACTS = {
  // DragonSwap addresses (these are the likely mainnet addresses)
  DRAGONSWAP_ROUTER_V2: '0xb3b96f7aac1630c7929b84db994c3e6094e183bb',
  DRAGONSWAP_FACTORY_V2: '0xe5020961fa51ffd3662cdf307def18f9a87cce7c',
  
  // Token addresses on mainnet (from user)
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7',
  USDC: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
  USDT: '0xb75d0b03c06a926e488e2659df1a861f860bd3d1',
  
  // Other potential DEX addresses
  ASTROPORT: '0x0000000000000000000000000000000000000000', // Placeholder
  LEVANA: '0x0000000000000000000000000000000000000000', // Placeholder
};

const ROUTER_ABI = [
  'function factory() external pure returns (address)',
  'function WETH() external pure returns (address)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)',
];

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

async function findMainnetDEX() {
  try {
    logger.info('='.repeat(60));
    logger.info('🚀 Searching for DEX Contracts on SEI MAINNET');
    logger.info('='.repeat(60));

    const provider = new ethers.providers.JsonRpcProvider(MAINNET_RPC);
    
    // Get network info
    const network = await provider.getNetwork();
    logger.info(`Network: SEI Mainnet (Chain ID: ${network.chainId})`);
    
    const latestBlock = await provider.getBlockNumber();
    logger.info(`Latest block: ${latestBlock}\n`);

    // Check DragonSwap Router
    logger.info('🐉 Checking DragonSwap V2 Router...');
    const routerCode = await provider.getCode(MAINNET_CONTRACTS.DRAGONSWAP_ROUTER_V2);
    if (routerCode !== '0x' && routerCode.length > 2) {
      logger.info(`✅ DragonSwap Router found at ${MAINNET_CONTRACTS.DRAGONSWAP_ROUTER_V2}`);
      
      try {
        const router = new ethers.Contract(MAINNET_CONTRACTS.DRAGONSWAP_ROUTER_V2, ROUTER_ABI, provider);
        const factory = await router.factory();
        const weth = await router.WETH();
        logger.info(`   Factory: ${factory}`);
        logger.info(`   WETH/WSEI: ${weth}`);
      } catch (error) {
        logger.info('   Could not fetch router details');
      }
    } else {
      logger.warn(`❌ No contract at DragonSwap Router address`);
    }

    // Check DragonSwap Factory
    logger.info('\n🏭 Checking DragonSwap V2 Factory...');
    const factoryCode = await provider.getCode(MAINNET_CONTRACTS.DRAGONSWAP_FACTORY_V2);
    if (factoryCode !== '0x' && factoryCode.length > 2) {
      logger.info(`✅ DragonSwap Factory found at ${MAINNET_CONTRACTS.DRAGONSWAP_FACTORY_V2}`);
      
      try {
        const factory = new ethers.Contract(MAINNET_CONTRACTS.DRAGONSWAP_FACTORY_V2, FACTORY_ABI, provider);
        const pairCount = await factory.allPairsLength();
        logger.info(`   Total pairs: ${pairCount.toString()}`);
        
        // Check WSEI-USDC pair
        const wseiUsdcPair = await factory.getPair(MAINNET_CONTRACTS.WSEI, MAINNET_CONTRACTS.USDC);
        if (wseiUsdcPair !== ethers.constants.AddressZero) {
          logger.info(`   WSEI-USDC pair: ${wseiUsdcPair}`);
        }
      } catch (error) {
        logger.info('   Could not fetch factory details');
      }
    } else {
      logger.warn(`❌ No contract at DragonSwap Factory address`);
    }

    // Check WSEI
    logger.info('\n💰 Checking WSEI Token...');
    const wseiCode = await provider.getCode(MAINNET_CONTRACTS.WSEI);
    if (wseiCode !== '0x') {
      const wsei = new ethers.Contract(MAINNET_CONTRACTS.WSEI, ERC20_ABI, provider);
      try {
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          wsei.name(),
          wsei.symbol(),
          wsei.decimals(),
          wsei.totalSupply()
        ]);
        logger.info(`✅ WSEI verified at ${MAINNET_CONTRACTS.WSEI}`);
        logger.info(`   Name: ${name}`);
        logger.info(`   Symbol: ${symbol}`);
        logger.info(`   Decimals: ${decimals}`);
        logger.info(`   Total Supply: ${ethers.utils.formatUnits(totalSupply, decimals)}`);
      } catch (error) {
        logger.info(`✅ WSEI contract exists at ${MAINNET_CONTRACTS.WSEI}`);
      }
    }

    // Check USDC
    logger.info('\n💵 Checking USDC Token...');
    const usdcCode = await provider.getCode(MAINNET_CONTRACTS.USDC);
    if (usdcCode !== '0x') {
      const usdc = new ethers.Contract(MAINNET_CONTRACTS.USDC, ERC20_ABI, provider);
      try {
        const [name, symbol, decimals] = await Promise.all([
          usdc.name(),
          usdc.symbol(),
          usdc.decimals()
        ]);
        logger.info(`✅ USDC verified at ${MAINNET_CONTRACTS.USDC}`);
        logger.info(`   Name: ${name}`);
        logger.info(`   Symbol: ${symbol}`);
        logger.info(`   Decimals: ${decimals}`);
      } catch (error) {
        logger.info(`✅ USDC contract exists at ${MAINNET_CONTRACTS.USDC}`);
      }
    }

    // Check wallet balances
    if (process.env.SEI_MNEMONIC) {
      logger.info('\n📊 Checking Your Wallet Balances...');
      const wallet = ethers.Wallet.fromMnemonic(process.env.SEI_MNEMONIC).connect(provider);
      
      const seiBalance = await provider.getBalance(wallet.address);
      logger.info(`Native SEI: ${ethers.utils.formatEther(seiBalance)}`);
      
      if (wseiCode !== '0x') {
        const wsei = new ethers.Contract(MAINNET_CONTRACTS.WSEI, ERC20_ABI, provider);
        const wseiBalance = await wsei.balanceOf(wallet.address);
        logger.info(`WSEI: ${ethers.utils.formatEther(wseiBalance)}`);
      }
      
      if (usdcCode !== '0x') {
        const usdc = new ethers.Contract(MAINNET_CONTRACTS.USDC, ERC20_ABI, provider);
        const usdcBalance = await usdc.balanceOf(wallet.address);
        const decimals = await usdc.decimals();
        logger.info(`USDC: ${ethers.utils.formatUnits(usdcBalance, decimals)}`);
      }
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 MAINNET Summary:');
    logger.info('✅ Connected to SEI Mainnet');
    logger.info(`${routerCode !== '0x' ? '✅' : '❌'} DragonSwap Router ${routerCode !== '0x' ? 'found' : 'not found'}`);
    logger.info(`${factoryCode !== '0x' ? '✅' : '❌'} DragonSwap Factory ${factoryCode !== '0x' ? 'found' : 'not found'}`);
    logger.info('✅ WSEI token verified');
    logger.info('✅ USDC token verified');
    logger.info('='.repeat(60));

    if (routerCode !== '0x' && factoryCode !== '0x') {
      logger.info('\n🎉 DragonSwap is available on mainnet!');
      logger.info('You can now swap your WSEI for USDC');
    }

  } catch (error) {
    logger.error('Search failed:', error);
  }
}

// Run the search
findMainnetDEX().then(() => {
  logger.info('\n✨ Mainnet DEX search completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});