// NEXUS AI DeFi Platform - Main Entry Point
import 'dotenv/config';
import { startAgentOrchestrator } from './core/agentOrchestrator';
import { initializeAgentRegistry } from './core/agentRegistry';
import { startMessageRouter } from './core/messageRouter';
import { initializeConsensus } from './core/consensusEngine';
import { connectProtocols } from './protocols';
import { startAPIServer } from './api';
import { initializeRedis } from './infrastructure/redis/pubsub';
import { startWebSocketServer } from './infrastructure/websocket/server';
import { logger } from './utils/logger';
import { startMonitoring } from './infrastructure/monitoring/metrics';

// Configuration
const config = {
  api: {
    port: process.env.API_PORT || 3000,
    wsPort: process.env.WS_PORT || 3001,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  sei: {
    rpcUrl: process.env.SEI_RPC_URL || 'https://rpc.sei-network.net',
    chainId: process.env.SEI_CHAIN_ID || 'pacific-1',
  },
  agents: {
    maxConcurrent: parseInt(process.env.MAX_AGENTS || '10'),
    defaultGasPrice: process.env.DEFAULT_GAS_PRICE || '0.1',
  },
};

// Main startup function
async function startNexusAI() {
  try {
    logger.info('🚀 Starting NEXUS AI DeFi Platform...');
    
    // Initialize core infrastructure
    logger.info('⚙️ Initializing core infrastructure...');
    await initializeRedis(config.redis.url);
    await startMonitoring();
    
    // Initialize agent systems
    logger.info('🤖 Initializing agent systems...');
    await initializeAgentRegistry();
    await startAgentOrchestrator();
    await startMessageRouter();
    await initializeConsensus();
    
    // Connect to DeFi protocols
    logger.info('🔗 Connecting to DeFi protocols...');
    await connectProtocols({
      yeiFinance: true,
      dragonSwap: true,
      symphony: true,
      citrex: true,
      takara: true,
      silo: true,
    });
    
    // Start API servers
    logger.info('🌐 Starting API servers...');
    await startAPIServer(config.api.port);
    await startWebSocketServer(config.api.wsPort);
    
    // Initialize default agents
    logger.info('🎯 Spawning default agents...');
    await spawnDefaultAgents();
    
    logger.info('✅ NEXUS AI DeFi Platform started successfully!');
    logger.info(`📊 Dashboard: http://localhost:${config.api.port}`);
    logger.info(`🔌 WebSocket: ws://localhost:${config.api.wsPort}`);
    logger.info(`📡 GraphQL: http://localhost:${config.api.port}/graphql`);
    
  } catch (error) {
    logger.error('❌ Failed to start NEXUS AI:', error);
    process.exit(1);
  }
}

// Spawn default agents
async function spawnDefaultAgents() {
  const { spawnAgent } = await import('./core/agentOrchestrator');
  
  // Spawn core agents
  const agents = [
    { type: 'PORTFOLIO_MANAGER', name: 'Portfolio Alpha' },
    { type: 'ARBITRAGE_HUNTER', name: 'Arbitrage Scanner' },
    { type: 'RISK_MANAGER', name: 'Risk Guardian' },
    { type: 'ANALYTICS', name: 'Market Analyzer' },
    { type: 'PAYMENT', name: 'Payment Processor' },
  ];
  
  for (const agent of agents) {
    await spawnAgent(agent.type, {
      name: agent.name,
      autoStart: true,
      config: {
        maxPositionSize: '10000',
        riskTolerance: 'medium',
        updateInterval: 60000, // 1 minute
      },
    });
    logger.info(`✅ Spawned ${agent.name} agent`);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n⏹️ Shutting down NEXUS AI...');
  
  try {
    // Stop all agents
    const { stopAllAgents } = await import('./core/agentOrchestrator');
    await stopAllAgents();
    
    // Close connections
    const { closeRedis } = await import('./infrastructure/redis/pubsub');
    await closeRedis();
    
    logger.info('👋 NEXUS AI shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the platform
startNexusAI();

export { config };