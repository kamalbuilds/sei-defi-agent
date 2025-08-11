import { SeiAgentKit } from '../../sei-agent-kit/src/agent';
import { privateKeyToAccount } from 'viem/accounts';
import { Address } from 'viem';
import { Wallet } from 'ethers';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('SEI-Agent-Kit-Test');

// Convert mnemonic to private key
function mnemonicToPrivateKey(mnemonic: string): string {
  // This is a simplified version - in production use proper HD wallet derivation
  const wallet = Wallet.fromMnemonic(mnemonic);
  return wallet.privateKey;
}

async function testSeiAgentKit() {
  try {
    logger.info('='.repeat(60));
    logger.info('🚀 Testing SEI Agent Kit Protocol Interactions');
    logger.info('='.repeat(60));

    if (!process.env.SEI_MNEMONIC) {
      throw new Error('SEI_MNEMONIC not found in environment');
    }

    // Convert mnemonic to private key
    const privateKey = mnemonicToPrivateKey(process.env.SEI_MNEMONIC);
    
    // Initialize SeiAgentKit
    const agent = new SeiAgentKit(privateKey, 'openai');
    
    logger.info(`\n📱 Wallet Address: ${agent.wallet_address}`);

    // Test 1: Check SEI Balance
    logger.info('\n🧪 Test 1: Checking SEI Balance');
    const seiBalance = await agent.getERC20Balance();
    logger.info(`💰 SEI Balance: ${seiBalance}`);

    // Test 2: Get Token Addresses
    logger.info('\n🧪 Test 2: Getting Token Addresses');
    const usdcAddress = await agent.getTokenAddressFromTicker('USDC');
    const usdtAddress = await agent.getTokenAddressFromTicker('USDT');
    logger.info(`USDC Address: ${usdcAddress}`);
    logger.info(`USDT Address: ${usdtAddress}`);

    // Test 3: Check USDC Balance
    if (usdcAddress) {
      logger.info('\n🧪 Test 3: Checking USDC Balance');
      const usdcBalance = await agent.getERC20Balance(usdcAddress as Address);
      logger.info(`💵 USDC Balance: ${usdcBalance}`);
    }

    // Test 4: Symphony Swap (SEI -> USDC)
    if (parseFloat(seiBalance) > 0.1 && usdcAddress) {
      logger.info('\n🧪 Test 4: Testing Symphony Swap (0.1 SEI -> USDC)');
      try {
        const swapResult = await agent.swap(
          '0.1',
          '0x0000000000000000000000000000000000000000' as Address, // Native SEI
          usdcAddress as Address
        );
        logger.info(`✅ Swap successful: ${swapResult}`);
      } catch (error: any) {
        logger.warn(`⚠️ Symphony swap not available: ${error.message}`);
      }
    } else {
      logger.info('\n⚠️ Insufficient SEI balance for swap test (need > 0.1 SEI)');
    }

    // Test 5: Takara Protocol - Check if we can interact
    logger.info('\n🧪 Test 5: Testing Takara Protocol');
    try {
      // Check redeemable amount for USDC
      const redeemable = await agent.getRedeemableAmount('USDC');
      logger.info(`📊 Takara USDC Redeemable: ${JSON.stringify(redeemable)}`);
      
      // Check borrow balance
      const borrowBalance = await agent.getBorrowBalance('USDC');
      logger.info(`💳 Takara USDC Borrow Balance: ${JSON.stringify(borrowBalance)}`);
    } catch (error: any) {
      logger.warn(`⚠️ Takara protocol not accessible: ${error.message}`);
    }

    // Test 6: Citrex Protocol - Get Products
    logger.info('\n🧪 Test 6: Testing Citrex Protocol');
    try {
      // Get all products
      const products = await agent.citrexGetProducts();
      logger.info(`📊 Citrex Products: ${products}`);
      
      // Get tickers
      const tickers = await agent.citrexGetTickers();
      logger.info(`📈 Citrex Tickers: ${tickers}`);
      
      // Get account health
      const health = await agent.citrexGetAccountHealth();
      logger.info(`💚 Citrex Account Health: ${health}`);
    } catch (error: any) {
      logger.warn(`⚠️ Citrex protocol not accessible: ${error.message}`);
    }

    // Test 7: If we have USDC, try Takara mint
    if (usdcAddress && parseFloat(await agent.getERC20Balance(usdcAddress as Address)) > 0) {
      logger.info('\n🧪 Test 7: Testing Takara Mint');
      try {
        const mintResult = await agent.mintTakara('USDC', '1.0');
        logger.info(`✅ Takara mint successful: ${JSON.stringify(mintResult)}`);
      } catch (error: any) {
        logger.warn(`⚠️ Takara mint failed: ${error.message}`);
      }
    }

    // Test 8: Simple Transfer Test (self-transfer)
    if (parseFloat(seiBalance) > 0.001) {
      logger.info('\n🧪 Test 8: Testing SEI Transfer');
      try {
        const transferResult = await agent.ERC20Transfer(
          '0.001',
          agent.wallet_address,
          'SEI'
        );
        logger.info(`✅ Transfer successful: ${transferResult}`);
      } catch (error: any) {
        logger.warn(`⚠️ Transfer failed: ${error.message}`);
      }
    }

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Protocol Test Summary:');
    logger.info('✅ SEI Agent Kit initialized successfully');
    logger.info(`${parseFloat(seiBalance) > 0 ? '✅' : '❌'} Wallet has SEI balance`);
    logger.info('✅ Token address lookup working');
    logger.info('📝 Symphony protocol - for swaps');
    logger.info('📝 Takara protocol - for lending/borrowing');
    logger.info('📝 Citrex protocol - for derivatives');
    logger.info('📝 Silo protocol - for lending');
    logger.info('='.repeat(60));

    // Next steps
    logger.info('\n📝 Next Steps:');
    if (parseFloat(seiBalance) === 0) {
      logger.info('1. Fund wallet from faucet: https://app.sei.io/faucet');
    }
    logger.info('2. Protocols may need testnet deployments to be fully functional');
    logger.info('3. Use sei-agent-kit methods for all protocol interactions');
    logger.info('4. Only implement custom contracts for unsupported protocols');

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testSeiAgentKit().then(() => {
  logger.info('\n✨ SEI Agent Kit test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});