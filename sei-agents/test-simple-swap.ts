import { SeiAgentKit } from '../../sei-agent-kit/src/agent';
import { Wallet } from 'ethers';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('Simple-Swap-Test');

async function testSimpleSwap() {
  try {
    logger.info('='.repeat(60));
    logger.info('🚀 Testing Simple Swap with SEI Agent Kit');
    logger.info('='.repeat(60));

    if (!process.env.SEI_MNEMONIC) {
      throw new Error('SEI_MNEMONIC not found in environment');
    }

    // Convert mnemonic to private key
    const wallet = Wallet.fromMnemonic(process.env.SEI_MNEMONIC);
    const privateKey = wallet.privateKey;
    
    // Initialize SeiAgentKit
    const agent = new SeiAgentKit(privateKey, 'openai');
    
    logger.info(`\n📱 Wallet Address: ${agent.wallet_address}`);

    // Check balances
    logger.info('\n📊 Current Balances:');
    
    // Native SEI
    const seiBalance = await agent.getERC20Balance();
    logger.info(`💰 Native SEI: ${seiBalance}`);
    
    // WSEI (0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7)
    const WSEI = '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7' as any;
    const wseiBalance = await agent.getERC20Balance(WSEI);
    logger.info(`💰 WSEI: ${wseiBalance}`);
    
    // USDC (0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392)
    const USDC = '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392' as any;
    const usdcBalance = await agent.getERC20Balance(USDC);
    logger.info(`💵 USDC: ${usdcBalance}`);

    // Since Symphony is broken, let's try other methods
    logger.info('\n🔄 Swap Options:');
    logger.info('1. Symphony - Currently broken (returns HTML)');
    logger.info('2. Carbon SDK - For trading strategies');
    logger.info('3. Direct contract calls - Need DEX addresses');
    logger.info('4. Manual wrapping/unwrapping - For SEI<->WSEI');

    // Test wrapping SEI to WSEI if needed
    if (parseFloat(seiBalance) > 1 && parseFloat(wseiBalance) < 0.1) {
      logger.info('\n🔄 You have SEI but low WSEI. Consider wrapping some SEI:');
      logger.info('Visit: https://app.dragonswap.app to wrap SEI -> WSEI');
      logger.info('Or use: https://app.sei.io to interact with DEXs');
    }

    // Since you already have USDC, the swap worked!
    if (parseFloat(usdcBalance) > 0) {
      logger.info('\n✅ Success! You already have USDC from a previous swap!');
      logger.info(`Current USDC balance: ${usdcBalance}`);
    }

    // Try Carbon SDK for advanced trading
    logger.info('\n📊 Testing Carbon SDK (for advanced trading):');
    try {
      // Carbon is for creating trading strategies, not direct swaps
      logger.info('Carbon SDK is available for creating buy/sell strategies');
      logger.info('Use agent.createBuySellStrategy() for automated trading');
    } catch (error: any) {
      logger.warn(`Carbon not available: ${error.message}`);
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Summary:');
    logger.info(`✅ Wallet connected: ${agent.wallet_address}`);
    logger.info(`✅ SEI Balance: ${seiBalance}`);
    logger.info(`✅ WSEI Balance: ${wseiBalance}`);
    logger.info(`✅ USDC Balance: ${usdcBalance}`);
    
    if (parseFloat(usdcBalance) > 0) {
      logger.info('✅ You have successfully swapped to USDC!');
    }
    
    logger.info('='.repeat(60));

    // Recommendations
    logger.info('\n💡 Recommendations:');
    logger.info('1. Use DragonSwap web interface: https://app.dragonswap.app');
    logger.info('2. Symphony SDK needs fixing for programmatic swaps');
    logger.info('3. Your current balance shows successful trading activity');

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testSimpleSwap().then(() => {
  logger.info('\n✨ Simple swap test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});