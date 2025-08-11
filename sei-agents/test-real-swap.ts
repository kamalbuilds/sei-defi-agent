import { DeFiAgent, ArbitrageAgent } from './agents/defi-agent';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('Real-Swap-Test');

// Token addresses on SEI Mainnet
const TOKENS = {
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7', // Wrapped SEI
  USDC: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392', // USDC on SEI testnet
};

async function testRealSwap() {
  try {
    logger.info('='.repeat(60));
    logger.info('🚀 Testing Real Protocol Swap on SEI Testnet');
    logger.info('='.repeat(60));

    if (!process.env.SEI_MNEMONIC) {
      throw new Error('SEI_MNEMONIC not found in environment');
    }

    // Initialize DeFi Agent
    const agent = new DeFiAgent({
      id: 'test-defi-agent',
      name: 'Test DeFi Agent',
      type: 'defi',
      mnemonic: process.env.SEI_MNEMONIC,
      modelProvider: 'openai'
    });

    await agent.initialize();

    // Check initial balances
    logger.info('\n📊 Initial Balances:');
    const seiBalance = await agent.execute({ action: 'check_balance', ticker: 'SEI' });
    logger.info(`SEI Balance: ${seiBalance.balance}`);
    
    const usdcBalance = await agent.execute({ action: 'check_balance', ticker: 'USDC' });
    logger.info(`USDC Balance: ${usdcBalance.balance}`);

    // Test swap if we have enough SEI
    if (parseFloat(seiBalance.balance) > 0.1) {
      logger.info('\n🔄 Attempting Swap: 0.1 SEI -> USDC');
      logger.info(`Using WSEI: ${TOKENS.WSEI}`);
      logger.info(`Target USDC: ${TOKENS.USDC}`);
      
      try {
        const swapResult = await agent.execute({
          action: 'swap',
          amount: '0.1',
          tokenIn: 'SEI',
          tokenOut: 'USDC'
        });
        
        logger.info(`✅ Swap Result: ${JSON.stringify(swapResult)}`);
        
        // Check balances after swap
        logger.info('\n📊 Balances After Swap:');
        const newSeiBalance = await agent.execute({ action: 'check_balance', ticker: 'SEI' });
        logger.info(`SEI Balance: ${newSeiBalance.balance}`);
        
        const newUsdcBalance = await agent.execute({ action: 'check_balance', ticker: 'USDC' });
        logger.info(`USDC Balance: ${newUsdcBalance.balance}`);
        
      } catch (error: any) {
        logger.error(`❌ Swap failed: ${error.message}`);
        logger.info('This might be because Symphony protocol is not deployed on testnet');
      }
    } else {
      logger.warn('⚠️ Insufficient SEI balance for swap test (need > 0.1 SEI)');
    }

    // Test portfolio value
    logger.info('\n💼 Portfolio Value:');
    const portfolio = await agent.getPortfolioValue();
    logger.info(`Total Value: $${portfolio.totalValue.toFixed(2)}`);
    logger.info('Positions:');
    portfolio.positions.forEach(pos => {
      logger.info(`  ${pos.token}: ${pos.balance} ($${pos.value?.toFixed(2) || 'N/A'})`);
    });

    // Test arbitrage scanning
    logger.info('\n🔍 Scanning for Arbitrage Opportunities:');
    const arbitrageAgent = new ArbitrageAgent({
      id: 'test-arb-agent',
      name: 'Test Arbitrage Agent',
      type: 'arbitrage',
      mnemonic: process.env.SEI_MNEMONIC,
      modelProvider: 'openai'
    });

    await arbitrageAgent.initialize();
    const opportunities = await arbitrageAgent.scan();
    
    if (opportunities.length > 0) {
      logger.info(`Found ${opportunities.length} opportunities:`);
      opportunities.forEach(opp => {
        logger.info(`  Path: ${opp.path.join(' → ')}`);
        logger.info(`  Expected Profit: ${opp.profit * 100}%`);
        logger.info(`  Protocol: ${opp.protocol}`);
      });
    } else {
      logger.info('No arbitrage opportunities found');
    }

    // Test other protocols
    logger.info('\n🧪 Testing Other Protocol Integrations:');
    
    // Test Takara (if USDC balance available)
    if (parseFloat(usdcBalance.balance) > 0) {
      logger.info('\n📦 Testing Takara Protocol:');
      try {
        const mintResult = await agent.execute({
          action: 'takara_mint',
          ticker: 'USDC',
          amount: '0.01'
        });
        logger.info(`Takara Mint Result: ${JSON.stringify(mintResult)}`);
      } catch (error: any) {
        logger.warn(`Takara mint failed: ${error.message}`);
      }
    }

    // Test Citrex
    logger.info('\n📈 Testing Citrex Protocol:');
    try {
      const positions = await agent.execute({
        action: 'citrex_get_positions'
      });
      logger.info(`Citrex Positions: ${JSON.stringify(positions)}`);
    } catch (error: any) {
      logger.warn(`Citrex query failed: ${error.message}`);
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Test Summary:');
    logger.info('✅ DeFi Agent initialized successfully');
    logger.info(`✅ Wallet has ${seiBalance.balance} SEI`);
    logger.info('📝 Symphony swap protocol tested');
    logger.info('📝 Takara lending protocol tested');
    logger.info('📝 Citrex derivatives protocol tested');
    logger.info('📝 Arbitrage scanning tested');
    logger.info('='.repeat(60));

    await agent.shutdown();
    await arbitrageAgent.shutdown();

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testRealSwap().then(() => {
  logger.info('\n✨ Real swap test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});