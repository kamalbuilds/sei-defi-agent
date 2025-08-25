// API Configuration for NEXUS AI DeFi Platform

export const API_CONFIG = {
  // Backend API endpoints
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  
  // SEI Network Configuration
  SEI_RPC_URL: process.env.NEXT_PUBLIC_SEI_RPC_URL || 'https://evm-rpc.sei-apis.com',
  SEI_CHAIN_ID: 1329, // Mainnet
  
  // Token Addresses (SEI Mainnet)
  TOKENS: {
    WSEI: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7',
    USDC: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
    USDT: '0xB75D0B03c06A926e488e2659DF1A861F860bD3d1',
  },
  
  // Agent endpoints (updated for sei-agents structure)
  AGENTS: {
    PORTFOLIO: '/api/agents/portfolio',
    ARBITRAGE: '/api/agents/arbitrage',
    PAYMENT: '/api/agents/payment',
    DEFI: '/api/agents/defi',
  },
  
  // Protocol endpoints
  PROTOCOLS: {
    SYMPHONY: '/api/protocols/symphony',     // Swaps (via sei-agent-kit)
    TAKARA: '/api/protocols/takara',        // Lending
    CITREX: '/api/protocols/citrex',        // Derivatives
    SILO: '/api/protocols/silo',            // Additional lending
    CARBON: '/api/protocols/carbon',        // Trading strategies
  },
};

// WebSocket message types
export const WS_EVENTS = {
  // Agent events
  AGENT_STATUS: 'agent:status',
  AGENT_EXECUTE: 'agent:execute',
  AGENT_RESULT: 'agent:result',
  
  // Portfolio events
  PORTFOLIO_UPDATE: 'portfolio:update',
  PORTFOLIO_REBALANCE: 'portfolio:rebalance',
  
  // Arbitrage events
  ARBITRAGE_OPPORTUNITY: 'arbitrage:opportunity',
  ARBITRAGE_EXECUTE: 'arbitrage:execute',
  
  // Market events
  PRICE_UPDATE: 'price:update',
  MARKET_DATA: 'market:data',
};