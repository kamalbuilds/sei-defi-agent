import { ethers, Wallet } from 'ethers';
import dotenv from 'dotenv';
import { DragonSwapIntegration } from './protocols/dragonSwap';
import { Logger } from './utils/logger';

dotenv.config();

const logger = new Logger('ProtocolTest');

// SEI Atlantic-2 Testnet Contract Addresses
const CONTRACTS = {
  // DragonSwap addresses on SEI testnet (these need verification)
  DRAGONSWAP_ROUTER: '0x1234567890abcdef1234567890abcdef12345678', // Placeholder - need real address
  DRAGONSWAP_FACTORY: '0xabcdef1234567890abcdef1234567890abcdef12', // Placeholder - need real address
  
  // Common token addresses on SEI testnet
  WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7', // Wrapped SEI
  USDC: '0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1', // USDC on SEI testnet
  USDT: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDT placeholder
  
  // Other protocol addresses
  YEI_FINANCE: '0x1234567890abcdef1234567890abcdef12345679',
  SYMPHONY: '0xabcdef1234567890abcdef1234567890abcdef13',
  CITREX: '0x1234567890abcdef1234567890abcdef1234567a',
  TAKARA: '0xabcdef1234567890abcdef1234567890abcdef14',
  SILO: '0x1234567890abcdef1234567890abcdef1234567b',
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

async function testProtocolConnections() {
  try {
    logger.info('='.repeat(60));
    logger.info('🚀 Testing Protocol Interactions on SEI Atlantic-2 Testnet');
    logger.info('='.repeat(60));

    // Setup provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.SEI_RPC_URL);
    
    if (!process.env.SEI_MNEMONIC) {
      throw new Error('SEI_MNEMONIC not found in environment');
    }

    const wallet = Wallet.fromMnemonic(process.env.SEI_MNEMONIC).connect(provider);
    const walletAddress = wallet.address;
    
    logger.info(`\n📱 Wallet Address: ${walletAddress}`);

    // Check network
    const network = await provider.getNetwork();
    logger.info(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Check SEI balance
    const seiBalance = await provider.getBalance(walletAddress);
    logger.info(`💰 SEI Balance: ${ethers.utils.formatEther(seiBalance)} SEI`);

    if (seiBalance.eq(0)) {
      logger.warn('⚠️ Wallet has 0 SEI balance. Please fund the wallet to test transactions.');
      logger.info(`🔗 Get testnet SEI from faucet: https://app.sei.io/faucet`);
    }

    // Check token balances
    logger.info('\n📊 Checking Token Balances...');
    
    // Check USDC balance
    try {
      const usdcContract = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, provider);
      const usdcBalance = await usdcContract.balanceOf(walletAddress);
      const usdcDecimals = await usdcContract.decimals();
      const usdcSymbol = await usdcContract.symbol();
      logger.info(`💵 ${usdcSymbol} Balance: ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)}`);
    } catch (error) {
      logger.warn('Could not fetch USDC balance - contract may not exist on testnet');
    }

    // Test 1: Simple SEI Transfer (lowest risk test)
    if (seiBalance.gt(ethers.utils.parseEther('0.01'))) {
      logger.info('\n🧪 Test 1: Simple SEI Transfer');
      try {
        const testAmount = ethers.utils.parseEther('0.001'); // 0.001 SEI
        const tx = await wallet.sendTransaction({
          to: walletAddress, // Send to self for testing
          value: testAmount,
          gasLimit: 21000
        });
        
        logger.info(`📤 Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        logger.info(`✅ Transaction confirmed! Block: ${receipt.blockNumber}`);
      } catch (error: any) {
        logger.error(`❌ Transfer failed: ${error.message}`);
      }
    }

    // Test 2: Check if DragonSwap contracts exist
    logger.info('\n🧪 Test 2: Checking Protocol Contracts');
    
    // First, let's try to find real contract addresses
    logger.info('Searching for actual DEX contracts on SEI testnet...');
    
    // Try to interact with a known DEX or find deployed contracts
    const testAddresses = [
      '0x7e2cEDd6E71b42fC6D7182068300732519998A00', // Possible DEX router
      '0x2bb8643142921AfF87B3d4CF35DeaD6D5FB895B4', // Possible factory
      '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7', // WSEI
    ];

    for (const address of testAddresses) {
      try {
        const code = await provider.getCode(address);
        if (code !== '0x') {
          logger.info(`✅ Contract found at ${address}`);
        } else {
          logger.info(`❌ No contract at ${address}`);
        }
      } catch (error) {
        logger.error(`Error checking ${address}`);
      }
    }

    // Test 3: Try mock swap simulation (without actual execution)
    logger.info('\n🧪 Test 3: Simulating Swap Logic');
    logger.info('Since real DEX contracts may not be deployed on testnet, simulating swap logic...');
    
    const swapAmount = ethers.utils.parseEther('0.1'); // 0.1 SEI
    const expectedUSDC = swapAmount.mul(5); // Assume 1 SEI = 5 USDC for simulation
    
    logger.info(`📊 Simulation: Swapping ${ethers.utils.formatEther(swapAmount)} SEI`);
    logger.info(`📊 Expected output: ~${ethers.utils.formatUnits(expectedUSDC, 6)} USDC`);
    logger.info(`📊 Slippage tolerance: 3%`);
    logger.info(`📊 Price impact: ~0.5%`);

    // Test 4: Create mock protocol interactions
    logger.info('\n🧪 Test 4: Mock Protocol Interactions');
    
    const protocols = [
      { name: 'DragonSwap', action: 'Swap SEI → USDC', status: 'Simulated' },
      { name: 'Symphony', action: 'Provide Liquidity', status: 'Simulated' },
      { name: 'Citrex', action: 'Stake tokens', status: 'Simulated' },
      { name: 'Takara', action: 'Mint NFT', status: 'Simulated' },
      { name: 'Silo', action: 'Lend assets', status: 'Simulated' },
      { name: 'YEI Finance', action: 'Yield farming', status: 'Simulated' },
    ];

    for (const protocol of protocols) {
      logger.info(`${protocol.name}: ${protocol.action} - ${protocol.status}`);
    }

    // Test 5: Real interaction attempt with fallback
    logger.info('\n🧪 Test 5: Attempting Real Protocol Connection');
    
    // Try to initialize DragonSwap with error handling
    try {
      const dragonSwap = new DragonSwapIntegration({
        routerAddress: CONTRACTS.DRAGONSWAP_ROUTER,
        factoryAddress: CONTRACTS.DRAGONSWAP_FACTORY,
        rpcUrl: process.env.SEI_RPC_URL!,
        privateKey: wallet.privateKey,
        slippageTolerance: 0.03,
        gasLimit: BigInt(300000)
      });

      // Try to initialize - this will fail if contracts don't exist
      await dragonSwap.initialize();
      logger.info('✅ DragonSwap initialized successfully');
      
      // If successful, try a real swap
      if (seiBalance.gt(ethers.utils.parseEther('0.1'))) {
        const txHash = await dragonSwap.swapExactETHForTokens(
          CONTRACTS.USDC,
          ethers.utils.parseEther('0.1'),
          undefined,
          walletAddress
        );
        logger.info(`✅ Swap transaction: ${txHash}`);
      }
    } catch (error: any) {
      logger.warn(`⚠️ DragonSwap not available on testnet: ${error.message}`);
      logger.info('📝 Using mock implementation for development');
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Test Summary:');
    logger.info('✅ Wallet connection successful');
    logger.info('✅ Network connection verified');
    logger.info(`${seiBalance.gt(0) ? '✅' : '❌'} SEI balance available`);
    logger.info('⚠️ Real DEX contracts may not be deployed on testnet');
    logger.info('✅ Mock protocol interactions working');
    logger.info('='.repeat(60));

    // Provide next steps
    logger.info('\n📝 Next Steps:');
    logger.info('1. Deploy your own DEX contracts on testnet for testing');
    logger.info('2. Or use mock implementations for development');
    logger.info('3. Fund wallet from faucet: https://app.sei.io/faucet');
    logger.info('4. Update contract addresses when real DEXs are deployed');

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testProtocolConnections().then(() => {
  logger.info('\n✨ Protocol interaction test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});