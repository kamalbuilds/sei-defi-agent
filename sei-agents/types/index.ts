// BigNumber is no longer needed in ethers v6 - use native bigint instead

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  status: AgentStatus;
  wallet: string;
  reputation: number;
  performance: PerformanceMetrics;
}

export enum AgentType {
  PORTFOLIO_MANAGER = 'PORTFOLIO_MANAGER',
  ARBITRAGE_HUNTER = 'ARBITRAGE_HUNTER',
  ARBITRAGE = 'ARBITRAGE',
  RISK_MANAGER = 'RISK_MANAGER',
  EXECUTION = 'EXECUTION',
  ANALYTICS = 'ANALYTICS',
  PAYMENT = 'PAYMENT',
  STRATEGY = 'STRATEGY'
}

export enum AgentStatus {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  EXECUTING = 'EXECUTING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}

export interface PerformanceMetrics {
  totalProfit: bigint;
  totalLoss: bigint;
  winRate: number;
  avgReturnPerTrade: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTransactions: number;
}

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  params: StrategyParams;
  riskProfile: RiskProfile;
  active: boolean;
}

export enum StrategyType {
  YIELD_OPTIMIZATION = 'YIELD_OPTIMIZATION',
  ARBITRAGE = 'ARBITRAGE',
  MARKET_MAKING = 'MARKET_MAKING',
  TREND_FOLLOWING = 'TREND_FOLLOWING',
  MEAN_REVERSION = 'MEAN_REVERSION',
  DELTA_NEUTRAL = 'DELTA_NEUTRAL'
}

export interface StrategyParams {
  minReturn: number;
  maxRisk: number;
  timeHorizon: number;
  rebalanceFrequency: number;
  protocols: string[];
}

export interface RiskProfile {
  maxLeverage: number;
  stopLoss: number;
  takeProfit: number;
  maxPositionSize: bigint;
  maxDrawdown: number;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: any;
  timestamp: number;
  signature: string;
  payment?: PaymentDetails;
}

export enum MessageType {
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
  PAYMENT = 'PAYMENT',
  ALERT = 'ALERT',
  COORDINATION = 'COORDINATION',
  EXECUTION = 'EXECUTION',
  FIND_ARBITRAGE = 'FIND_ARBITRAGE',
  EXECUTE_ARBITRAGE = 'EXECUTE_ARBITRAGE',
  MONITOR_PRICES = 'MONITOR_PRICES',
  FLASH_LOAN_REQUEST = 'FLASH_LOAN_REQUEST',
  LIQUIDATION_OPPORTUNITY = 'LIQUIDATION_OPPORTUNITY',
  CROSS_CHAIN_ARBITRAGE = 'CROSS_CHAIN_ARBITRAGE',
  ARBITRAGE_OPPORTUNITIES = 'ARBITRAGE_OPPORTUNITIES',
  ARBITRAGE_EXECUTED = 'ARBITRAGE_EXECUTED',
  PRICE_DATA = 'PRICE_DATA',
  FLASH_LOAN_EXECUTED = 'FLASH_LOAN_EXECUTED',
  FLASH_LOAN_FAILED = 'FLASH_LOAN_FAILED',
  LIQUIDATION_EXECUTED = 'LIQUIDATION_EXECUTED',
  LIQUIDATION_FAILED = 'LIQUIDATION_FAILED',
  CROSS_CHAIN_ARBITRAGE_EXECUTED = 'CROSS_CHAIN_ARBITRAGE_EXECUTED',
  CROSS_CHAIN_ARBITRAGE_FAILED = 'CROSS_CHAIN_ARBITRAGE_FAILED'
}

export interface PaymentDetails {
  amount: bigint;
  token: string;
  condition?: SmartContractCondition;
  escrow?: boolean;
  deadline?: number;
}

export interface SmartContractCondition {
  contract: string;
  method: string;
  params: any[];
  expectedResult: any;
}

export interface Portfolio {
  id: string;
  owner: string;
  assets: Asset[];
  totalValue: bigint;
  performance: PerformanceMetrics;
  strategies: string[];
  riskProfile: RiskProfile;
}

export interface Asset {
  token: string;
  symbol: string;
  amount: bigint;
  value: bigint;
  allocation: number;
  protocol?: string;
  apy?: number;
}

export interface ArbitrageOpportunity {
  id: string;
  type: 'DEX' | 'CEX_DEX' | 'FUNDING_RATE' | 'CROSS_CHAIN';
  buyExchange: string;
  sellExchange: string;
  token: string;
  buyPrice: bigint;
  sellPrice: bigint;
  profitEstimate: bigint;
  gasEstimate: bigint;
  confidence: number;
  expiresAt: number;
}

export interface Transaction {
  id: string;
  hash?: string;
  from: string;
  to: string;
  value: bigint;
  data: string;
  status: TransactionStatus;
  gasUsed?: bigint;
  timestamp: number;
  agentId: string;
  strategyId?: string;
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface LendingPosition {
  protocol: string;
  asset: string;
  supplied: bigint;
  borrowed: bigint;
  collateralRatio: number;
  apy: number;
  liquidationThreshold: number;
}

export interface PerpPosition {
  exchange: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: bigint;
  entryPrice: bigint;
  markPrice: bigint;
  unrealizedPnl: bigint;
  fundingRate: number;
  leverage: number;
}

export interface OraclePrice {
  token: string;
  price: bigint;
  source: 'API3' | 'PYTH' | 'REDSTONE';
  timestamp: number;
  confidence: number;
}

export interface AgentService {
  id: string;
  provider: string;
  name: string;
  description: string;
  price: bigint;
  pricing: 'PER_REQUEST' | 'SUBSCRIPTION' | 'PERFORMANCE';
  rating: number;
  totalRequests: number;
}

export interface AgentCoordinationMessage {
  taskId: string;
  agents: string[];
  task: Task;
  consensus?: ConsensusResult;
}

export interface Task {
  id: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  params: any;
  requiredAgents: AgentType[];
  deadline?: number;
  reward?: bigint;
}

export interface ConsensusResult {
  approved: boolean;
  votes: { [agentId: string]: boolean };
  confidence: number;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  config: AgentConfig;
  status: AgentStatus;
  wallet: string;
  reputation: number;
  performance: PerformanceMetrics;
  strategies: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PriceData {
  asset?: string;
  token?: string;
  price: bigint;
  volume24h?: bigint;
  priceChange24h?: number;
  source: string;
  timestamp: number;
}