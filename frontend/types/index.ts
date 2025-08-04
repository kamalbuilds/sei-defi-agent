// Base types
export interface Agent {
  id: string
  name: string
  type: AgentType
  status: AgentStatus
  performance: string
  lastAction: string
  description: string
  config?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export type AgentType = 
  | 'arbitrage' 
  | 'portfolio' 
  | 'risk' 
  | 'yield' 
  | 'liquidation' 
  | 'mev'

export type AgentStatus = 'active' | 'idle' | 'paused' | 'error'

// Portfolio types
export interface Portfolio {
  id: string
  address: string
  totalValue: string
  assets: Asset[]
  performance: PerformanceMetrics
  lastUpdated: string
}

export interface Asset {
  symbol: string
  name: string
  balance: string
  value: string
  allocation: number
  change24h: string
  changeValue: string
  isPositive: boolean
}

export interface PerformanceMetrics {
  totalValue: string
  change24h: string
  change7d: string
  change30d: string
  roi: string
  sharpeRatio: number
  maxDrawdown: number
  volatility: number
}

// Transaction types
export interface Transaction {
  id: string
  type: TransactionType
  status: TransactionStatus
  amount: string
  asset: string
  price?: string
  total: string
  fee: string
  timestamp: string
  txHash: string
  blockNumber?: number
  confirmations?: number
}

export type TransactionType = 'buy' | 'sell' | 'swap' | 'deposit' | 'withdrawal'
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

// Arbitrage types
export interface ArbitrageOpportunity {
  id: string
  fromExchange: string
  toExchange: string
  asset: string
  buyPrice: number
  sellPrice: number
  profit: number
  profitPercentage: number
  volume: number
  gasEstimate: number
  netProfit: number
  timeWindow: string
  urgency: 'low' | 'medium' | 'high'
}

// Risk types
export interface RiskMetric {
  label: string
  value: string
  status: RiskLevel
  change?: string
  description: string
  percentage?: number
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// Strategy types
export interface Strategy {
  id: string
  name: string
  category: StrategyCategory
  description: string
  estimatedApy: string
  riskLevel: RiskLevel
  timeHorizon: TimeHorizon
  minCapital: string
  features: string[]
  complexity: StrategyComplexity
  tags: string[]
  isActive: boolean
  config: Record<string, any>
}

export type StrategyCategory = 'arbitrage' | 'portfolio' | 'yield' | 'risk' | 'advanced'
export type TimeHorizon = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
export type StrategyComplexity = 'beginner' | 'intermediate' | 'advanced'

// Market data types
export interface MarketData {
  pair: string
  price: string
  change24h: string
  volume: string
  high24h: string
  low24h: string
  marketCap?: string
  lastUpdated: string
}

// WebSocket event types
export interface WSAgentUpdate {
  agentId: string
  status: AgentStatus
  performance: string
  lastAction: string
  timestamp: string
}

export interface WSPortfolioUpdate {
  address: string
  totalValue: string
  change24h: string
  assets: Asset[]
  timestamp: string
}

export interface WSMarketUpdate {
  pair: string
  price: string
  change24h: string
  volume: string
  timestamp: string
}

export interface WSArbitrageUpdate {
  opportunity: ArbitrageOpportunity
  timestamp: string
}

export interface WSTransactionUpdate {
  transaction: Transaction
  timestamp: string
}

export interface WSRiskAlert {
  type: 'warning' | 'critical'
  message: string
  metric: string
  value: string
  threshold: string
  timestamp: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

// Form types
export interface CreateAgentForm {
  name: string
  type: AgentType
  config: Record<string, any>
}

export interface PaymentForm {
  type: 'deposit' | 'withdraw' | 'swap'
  fromAsset: string
  toAsset?: string
  amount: string
  recipient?: string
  network: string
}

// Chart data types
export interface ChartDataPoint {
  timestamp: string
  value: number
  label?: string
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartDataset {
  label: string
  data: number[]
  borderColor: string
  backgroundColor: string
  fill?: boolean
  tension?: number
}

// Utility types
export type Nullable<T> = T | null
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// State types for React components
export interface AppState {
  user: {
    address: string | null
    isConnected: boolean
    balance: string
  }
  agents: Agent[]
  portfolio: Portfolio | null
  transactions: Transaction[]
  arbitrageOpportunities: ArbitrageOpportunity[]
  marketData: MarketData[]
  isLoading: boolean
  error: string | null
}

// Hook return types
export interface UseAgentReturn {
  agents: Agent[]
  loading: boolean
  error: string | null
  createAgent: (data: CreateAgentForm) => Promise<Agent>
  updateAgent: (id: string, data: Partial<Agent>) => Promise<Agent>
  deleteAgent: (id: string) => Promise<void>
  startAgent: (id: string) => Promise<void>
  stopAgent: (id: string) => Promise<void>
}

export interface UsePortfolioReturn {
  portfolio: Portfolio | null
  loading: boolean
  error: string | null
  refreshPortfolio: () => Promise<void>
  rebalance: (allocations: Record<string, number>) => Promise<void>
}

export interface UseTransactionsReturn {
  transactions: Transaction[]
  loading: boolean
  error: string | null
  submitTransaction: (data: PaymentForm) => Promise<Transaction>
  getTransactionHistory: (filters?: any) => Promise<Transaction[]>
}