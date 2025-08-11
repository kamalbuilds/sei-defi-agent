import { SeiAgentKit } from '../../sei-agent-kit/src/agent';
import { Address } from 'viem';
import { Wallet } from 'ethers';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('WSEI-Swap-Test');

// Token addresses on SEI Atlantic-2 testnet
const TOKENS = {
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7' as Address, // Wrapped SEI
  USDC: '0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392' as Address, // USDC on SEI testnet
};

async function testWSEISwap() {
  try {
    logger.info('='.repeat(60));
    logger.info('🚀 Testing WSEI Swap on SEI Testnet');
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

    // Check all balances
    logger.info('\n📊 Checking Balances:');
    
    // Native SEI balance
    const seiBalance = await agent.getERC20Balance();
    logger.info(`💰 Native SEI Balance: ${seiBalance}`);
    
    // WSEI balance
    const wseiBalance = await agent.getERC20Balance(TOKENS.WSEI);
    logger.info(`💰 WSEI Balance: ${wseiBalance}`);
    
    // USDC balance
    const usdcBalance = await agent.getERC20Balance(TOKENS.USDC);
    logger.info(`💵 USDC Balance: ${usdcBalance}`);

    // Test swap if we have WSEI
    if (parseFloat(wseiBalance) > 0.1) {
      logger.info('\n🔄 Attempting Swap: 0.1 WSEI -> USDC');
      logger.info(`Using Symphony protocol...`);
      
      try {
        // Use Symphony swap with WSEI
        const swapResult = await agent.swap(
          '0.1',           // Amount
          TOKENS.WSEI,     // From: WSEI
          TOKENS.USDC      // To: USDC
        );
        
        logger.info(`✅ Swap successful!`);
        logger.info(`Transaction: ${swapResult}`);
        
        // Wait a bit for transaction to settle
        logger.info('\n⏳ Waiting for transaction to settle...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check balances after swap
        logger.info('\n📊 Balances After Swap:');
        const newWseiBalance = await agent.getERC20Balance(TOKENS.WSEI);
        logger.info(`💰 WSEI Balance: ${newWseiBalance} (was ${wseiBalance})`);
        
        const newUsdcBalance = await agent.getERC20Balance(TOKENS.USDC);
        logger.info(`💵 USDC Balance: ${newUsdcBalance} (was ${usdcBalance})`);
        
        if (parseFloat(newUsdcBalance) > parseFloat(usdcBalance)) {
          logger.info(`\n🎉 SUCCESS! Received USDC from swap!`);
        }
        
      } catch (error: any) {
        logger.error(`❌ Swap failed: ${error.message}`);
        
        // If Symphony fails, let's check the error details
        if (error.message.includes('Insufficient balance')) {
          logger.info('Error: Insufficient WSEI balance for swap');
        } else if (error.message.includes('allowance')) {
          logger.info('Error: Need to approve WSEI spending first');
          
          // Try to approve WSEI for Symphony
          logger.info('\n🔑 Attempting to approve WSEI...');
          // Note: This would need the Symphony router address
        } else {
          logger.info('Symphony protocol might not be deployed on testnet');
          logger.info('Consider using a different DEX or manual contract interaction');
        }
      }
    } else {
      logger.warn(`⚠️ Insufficient WSEI balance for swap test (have ${wseiBalance}, need > 0.1)`);
      
      // If no WSEI but have SEI, suggest wrapping
      if (parseFloat(seiBalance) > 0.2) {
        logger.info('\n💡 Suggestion: You have native SEI. Consider wrapping it to WSEI first.');
      }
    }

    // Test other operations with WSEI
    if (parseFloat(wseiBalance) > 0) {
      logger.info('\n🧪 Testing other WSEI operations:');
      
      // Try transferring a small amount of WSEI to self (test transaction)
      try {
        logger.info('\n📤 Testing WSEI transfer (0.001 to self)...');
        const transferResult = await agent.ERC20Transfer(
          '0.001',
          agent.wallet_address,
          'WSEI'  // This should use the WSEI token
        );
        logger.info(`✅ Transfer successful: ${transferResult}`);
      } catch (error: any) {
        logger.warn(`Transfer failed: ${error.message}`);
      }
    }

    // Test Takara with USDC if available
    if (parseFloat(usdcBalance) > 0) {
      logger.info('\n📦 Testing Takara Protocol with USDC:');
      try {
        const redeemable = await agent.getRedeemableAmount('USDC');
        logger.info(`Redeemable USDC: ${JSON.stringify(redeemable)}`);
        
        // Try minting tUSDC
        const mintResult = await agent.mintTakara('USDC', '0.01');
        logger.info(`Takara mint result: ${JSON.stringify(mintResult)}`);
      } catch (error: any) {
        logger.warn(`Takara operation failed: ${error.message}`);
      }
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Test Summary:');
    logger.info(`✅ Wallet connected: ${agent.wallet_address}`);
    logger.info(`✅ Native SEI: ${seiBalance}`);
    logger.info(`✅ WSEI: ${wseiBalance}`);
    logger.info(`✅ USDC: ${usdcBalance}`);
    
    if (parseFloat(wseiBalance) > 0) {
      logger.info('✅ WSEI available for swaps');
    } else {
      logger.info('❌ No WSEI available - need to wrap SEI first');
    }
    
    logger.info('='.repeat(60));

    // Next steps
    logger.info('\n📝 Next Steps:');
    if (parseFloat(wseiBalance) < 0.1) {
      logger.info('1. Wrap more SEI to WSEI for testing swaps');
    }
    logger.info('2. Check if Symphony/DragonSwap contracts are deployed on testnet');
    logger.info('3. May need to use direct contract calls if DEX aggregators unavailable');
    logger.info('4. Consider deploying your own DEX contracts for testing');

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testWSEISwap().then(() => {
  logger.info('\n✨ WSEI swap test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});