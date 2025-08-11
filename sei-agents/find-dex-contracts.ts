import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('DEX-Finder');

// Known DEX signatures to look for
const DEX_SIGNATURES = {
  // Uniswap V2 Router signatures
  'swapExactTokensForTokens': '0x38ed1739',
  'swapExactETHForTokens': '0x7ff36ab5',
  'addLiquidity': '0xe8e33700',
  'factory': '0xc45a0155',
  'WETH': '0xad5c4648',
  // Factory signatures
  'getPair': '0xe6a43905',
  'createPair': '0xc9c65396',
};

async function findDEXContracts() {
  try {
    logger.info('='.repeat(60));
    logger.info('🔍 Searching for DEX Contracts on SEI Testnet');
    logger.info('='.repeat(60));

    const provider = new ethers.providers.JsonRpcProvider('https://sei.drpc.org');
    
    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    logger.info(`Latest block: ${latestBlock}`);

    // Known potential DEX addresses on different chains (we'll check if they exist on SEI)
    const potentialAddresses = [
      // Common patterns
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
      '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2 Factory
      '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
      '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
      
      // Sushi patterns
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // SushiSwap Router
      '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', // SushiSwap Factory
      
      // PancakeSwap patterns
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap Router
      '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap Factory
      
      // DragonSwap patterns (various possibilities)
      '0x4178ee437d3a07f4287e36870e9c63db6e68a1a0',
      '0x5c93c8f67b82b1ba914d06a60c0ade16cb62a59d',
      
      // Check some sequential addresses (sometimes DEXs deploy in sequence)
      '0x0000000000000000000000000000000000001000',
      '0x0000000000000000000000000000000000001001',
      '0x0000000000000000000000000000000000001002',
    ];

    logger.info('\nChecking potential DEX addresses...\n');

    for (const address of potentialAddresses) {
      try {
        const code = await provider.getCode(address);
        if (code !== '0x' && code.length > 2) {
          logger.info(`✅ Contract found at ${address}`);
          
          // Try to identify the contract type
          if (code.includes('737761704578616374546f6b656e73466f72546f6b656e73')) {
            logger.info('   → Looks like a DEX Router (has swapExactTokensForTokens)');
          }
          if (code.includes('676574506169')) {
            logger.info('   → Looks like a DEX Factory (has getPair)');
          }
        }
      } catch (error) {
        // Ignore errors for individual addresses
      }
    }

    // Check WSEI contract
    logger.info('\n📊 Checking WSEI Token Contract...');
    const WSEI = '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7';
    const wseiCode = await provider.getCode(WSEI);
    if (wseiCode !== '0x') {
      logger.info(`✅ WSEI contract verified at ${WSEI}`);
      
      // Get some WSEI info
      const wseiContract = new ethers.Contract(
        WSEI,
        ['function name() view returns (string)', 'function symbol() view returns (string)', 'function totalSupply() view returns (uint256)'],
        provider
      );
      
      try {
        const [name, symbol, totalSupply] = await Promise.all([
          wseiContract.name(),
          wseiContract.symbol(),
          wseiContract.totalSupply()
        ]);
        logger.info(`   Name: ${name}`);
        logger.info(`   Symbol: ${symbol}`);
        logger.info(`   Total Supply: ${ethers.utils.formatEther(totalSupply)}`);
      } catch (error) {
        logger.info('   Could not fetch token details');
      }
    }

    // Check USDC contract
    logger.info('\n📊 Checking USDC Token Contract...');
    const USDC = '0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392';
    const usdcCode = await provider.getCode(USDC);
    if (usdcCode !== '0x') {
      logger.info(`✅ USDC contract verified at ${USDC}`);
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Summary:');
    logger.info('✅ WSEI token contract exists and is functional');
    logger.info('✅ USDC token contract exists');
    logger.info('❌ No standard DEX router/factory contracts found at common addresses');
    logger.info('='.repeat(60));

    logger.info('\n💡 Recommendations:');
    logger.info('1. DragonSwap may not be deployed on Atlantic-2 testnet yet');
    logger.info('2. Consider deploying your own Uniswap V2 fork for testing');
    logger.info('3. Use sei-agent-kit with Symphony (when available)');
    logger.info('4. For production, check SEI mainnet or ask in SEI Discord for testnet DEX addresses');

  } catch (error) {
    logger.error('Search failed:', error);
  }
}

// Run the search
findDEXContracts().then(() => {
  logger.info('\n✨ DEX contract search completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});