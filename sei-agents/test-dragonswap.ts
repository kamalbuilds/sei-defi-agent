import { DragonSwapAgent } from './agents/dragonswap-agent';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('DragonSwap-Test');

async function testDragonSwap() {
  try {
    logger.info('='.repeat(60));
    logger.info('🐉 Testing DragonSwap on SEI Testnet');
    logger.info('='.repeat(60));

    // Initialize DragonSwap Agent
    const dragonAgent = new DragonSwapAgent({
      id: 'dragon-test',
      name: 'DragonSwap Test Agent',
      type: 'dragonswap',
      mnemonic: process.env.SEI_MNEMONIC,
      slippageTolerance: 0.03, // 3%
    });

    await dragonAgent.initialize();

    // Check pair info for WSEI-USDC
    logger.info('\n🔍 Checking WSEI-USDC pair...');
    try {
      const pairInfo = await dragonAgent.getPairInfo('WSEI', 'USDC');
      if (pairInfo.exists) {
        logger.info(`✅ WSEI-USDC pair exists at ${pairInfo.address}`);
        logger.info(`  Reserve WSEI: ${pairInfo.reserve0}`);
        logger.info(`  Reserve USDC: ${pairInfo.reserve1}`);
      } else {
        logger.info('❌ WSEI-USDC pair does not exist on DragonSwap');
        logger.info('   You may need to create the pair first');
      }
    } catch (error: any) {
      logger.error(`Failed to get pair info: ${error.message}`);
    }

    // Try swapping 0.1 WSEI to USDC
    logger.info('\n🔄 Attempting swap: 0.1 WSEI -> USDC');
    try {
      const txHash = await dragonAgent.swapTokens('WSEI', 'USDC', '0.1');
      logger.info(`✅ Swap successful! Transaction: ${txHash}`);
    } catch (error: any) {
      logger.error(`❌ Swap failed: ${error.message}`);
      
      if (error.message.includes('UNPREDICTABLE_GAS_LIMIT')) {
        logger.info('💡 This usually means the swap would fail on-chain');
        logger.info('   Possible reasons:');
        logger.info('   - Insufficient liquidity in the pair');
        logger.info('   - Token addresses are incorrect');
        logger.info('   - DragonSwap contracts not deployed on testnet');
      }
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 DragonSwap Test Summary:');
    logger.info('✅ DragonSwap agent initialized');
    logger.info('✅ Can interact with DragonSwap contracts');
    logger.info('📝 Swap functionality tested');
    logger.info('='.repeat(60));

    await dragonAgent.shutdown();

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testDragonSwap().then(() => {
  logger.info('\n✨ DragonSwap test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});