# Data Structures and Interfaces

## Overview
This document defines the core data structures, interfaces, and type definitions used throughout the NEXUS AI DeFi platform, ensuring consistent data modeling across all components.

## Core Data Structures

### 1. Agent Data Structures
Fundamental structures for agent representation and management.

```typescript
export interface AgentIdentity {
  id: string;
  publicKey: string;
  address: string;
  signature: string;
  timestamp: number;
  nonce: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  version: string;
  inputs: CapabilityParameter[];
  outputs: CapabilityParameter[];
  gasEstimate: BigNumber;
  executionTime: number;
  reliability: number; // 0-100
}

export interface CapabilityParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  constraints?: ParameterConstraints;
}

export interface ParameterConstraints {
  min?: number;
  max?: number;
  enum?: string[];
  pattern?: string;
  precision?: number;
}

export interface AgentResource {
  type: ResourceType;
  allocated: BigNumber;
  available: BigNumber;
  reserved: BigNumber;
  utilization: number; // 0-100
}

export enum ResourceType {
  CPU = 'CPU',
  MEMORY = 'MEMORY',
  STORAGE = 'STORAGE',
  NETWORK = 'NETWORK',
  GAS = 'GAS',
  CAPITAL = 'CAPITAL'
}

export interface AgentMetrics {
  performance: PerformanceMetrics;
  financial: FinancialMetrics;
  operational: OperationalMetrics;
  reputation: ReputationMetrics;
}

export interface PerformanceMetrics {
  successRate: number;
  averageExecutionTime: number;
  throughput: number;
  errorRate: number;
  reliability: number;
  efficiency: number;
}

export interface FinancialMetrics {
  totalPnL: BigNumber;
  dailyPnL: BigNumber;
  weeklyPnL: BigNumber;
  monthlyPnL: BigNumber;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  averageReturn: number;
  volatility: number;
  totalVolume: BigNumber;
  feesPaid: BigNumber;
  feesEarned: BigNumber;
}

export interface OperationalMetrics {
  uptime: number;
  totalTasks: number;
  activeTasks: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskValue: BigNumber;
  resourceUtilization: { [key in ResourceType]: number };
}

export interface ReputationMetrics {
  score: number;
  rank: number;
  reviews: AgentReview[];
  badges: string[];
  certifications: string[];
  violations: number;
  lastUpdate: number;
}

export interface AgentReview {
  reviewer: string;
  rating: number;
  comment: string;
  timestamp: number;
  verified: boolean;
}
```

### 2. Task and Workflow Structures
Structures for task definition, execution, and coordination.

```typescript
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  description: string;
  requirements: TaskRequirements;
  constraints: TaskConstraints;
  reward: TaskReward;
  deadline: number;
  dependencies: string[];
  assignedAgents: string[];
  progress: TaskProgress;
  metadata: TaskMetadata;
  created: number;
  updated: number;
}

export enum TaskType {
  PORTFOLIO_OPTIMIZATION = 'PORTFOLIO_OPTIMIZATION',
  ARBITRAGE_EXECUTION = 'ARBITRAGE_EXECUTION',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  MARKET_ANALYSIS = 'MARKET_ANALYSIS',
  YIELD_FARMING = 'YIELD_FARMING',
  LIQUIDITY_PROVISION = 'LIQUIDITY_PROVISION',
  TRADING_EXECUTION = 'TRADING_EXECUTION',
  DATA_ANALYSIS = 'DATA_ANALYSIS',
  MONITORING = 'MONITORING',
  CUSTOM = 'CUSTOM'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface TaskRequirements {
  capabilities: string[];
  minReputation: number;
  maxAgents: number;
  estimatedTime: number;
  requiredResources: { [key in ResourceType]?: BigNumber };
  specializations?: string[];
}

export interface TaskConstraints {
  maxGasCost: BigNumber;
  maxSlippage: number;
  riskTolerance: RiskTolerance;
  timeConstraints: TimeConstraint[];
  regulatoryConstraints: string[];
  geographicConstraints: string[];
}

export enum RiskTolerance {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH'
}

export interface TimeConstraint {
  type: 'BEFORE' | 'AFTER' | 'BETWEEN';
  timestamp: number;
  endTimestamp?: number;
  timezone?: string;
}

export interface TaskReward {
  baseAmount: BigNumber;
  token: string;
  bonusStructure: BonusStructure[];
  paymentSchedule: PaymentSchedule;
  conditions: RewardCondition[];
}

export interface BonusStructure {
  metric: string;
  threshold: number;
  multiplier: number;
  maxBonus: BigNumber;
}

export interface PaymentSchedule {
  type: 'IMMEDIATE' | 'ON_COMPLETION' | 'MILESTONE' | 'VESTING';
  milestones?: PaymentMilestone[];
  vestingPeriod?: number;
  cliffPeriod?: number;
}

export interface PaymentMilestone {
  name: string;
  percentage: number;
  condition: string;
  amount: BigNumber;
}

export interface RewardCondition {
  type: string;
  parameters: any;
  weight: number;
}

export interface TaskProgress {
  percentage: number;
  milestones: MilestoneProgress[];
  estimatedCompletion: number;
  blockers: TaskBlocker[];
  updates: ProgressUpdate[];
}

export interface MilestoneProgress {
  id: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: number;
  estimatedCompletion: number;
}

export interface TaskBlocker {
  id: string;
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedResolutionTime: number;
  assignedResolver?: string;
}

export interface ProgressUpdate {
  timestamp: number;
  agent: string;
  type: 'STATUS_CHANGE' | 'MILESTONE_COMPLETED' | 'BLOCKER_IDENTIFIED' | 'CUSTOM';
  message: string;
  data?: any;
}

export interface TaskMetadata {
  tags: string[];
  category: string;
  complexity: number;
  estimatedValue: BigNumber;
  relatedTasks: string[];
  customFields: { [key: string]: any };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  conditions: WorkflowCondition[];
  variables: WorkflowVariable[];
  metadata: WorkflowMetadata;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'TASK' | 'DECISION' | 'PARALLEL' | 'LOOP' | 'WAIT';
  taskTemplate?: Task;
  conditions?: WorkflowCondition[];
  branches?: WorkflowBranch[];
  loopCondition?: LoopCondition;
  waitCondition?: WaitCondition;
  timeoutSeconds?: number;
}

export interface WorkflowTrigger {
  type: 'TIME' | 'EVENT' | 'CONDITION' | 'MANUAL';
  schedule?: CronExpression;
  eventType?: string;
  condition?: WorkflowCondition;
}

export interface WorkflowCondition {
  expression: string;
  variables: string[];
  operators: string[];
}

export interface WorkflowVariable {
  name: string;
  type: string;
  defaultValue?: any;
  required: boolean;
  scope: 'GLOBAL' | 'STEP' | 'BRANCH';
}
```

### 3. Market and Financial Data Structures
Comprehensive market data representation and financial calculations.

```typescript
export interface MarketData {
  assets: { [symbol: string]: AssetData };
  pairs: { [pairId: string]: TradingPairData };
  protocols: { [protocolName: string]: ProtocolData };
  timestamp: number;
  source: string;
  confidence: number;
}

export interface AssetData {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  price: PriceData;
  volume: VolumeData;
  marketCap: BigNumber;
  totalSupply: BigNumber;
  circulatingSupply: BigNumber;
  volatility: VolatilityData;
  liquidity: LiquidityData;
  technicalIndicators: TechnicalIndicators;
}

export interface PriceData {
  current: BigNumber;
  change24h: number;
  change7d: number;
  change30d: number;
  high24h: BigNumber;
  low24h: BigNumber;
  ath: BigNumber;
  atl: BigNumber;
  timestamp: number;
  sources: PriceSource[];
}

export interface PriceSource {
  name: string;
  price: BigNumber;
  weight: number;
  confidence: number;
  timestamp: number;
}

export interface VolumeData {
  volume24h: BigNumber;
  volume7d: BigNumber;
  volume30d: BigNumber;
  volumeByExchange: { [exchange: string]: BigNumber };
  buyVolume: BigNumber;
  sellVolume: BigNumber;
  trades24h: number;
}

export interface VolatilityData {
  daily: number;
  weekly: number;
  monthly: number;
  annualized: number;
  historicalVolatility: number[];
  realizedVolatility: number;
  impliedVolatility?: number;
}

export interface LiquidityData {
  totalLiquidity: BigNumber;
  liquidityByProtocol: { [protocol: string]: BigNumber };
  bidAskSpread: number;
  marketDepth: MarketDepthLevel[];
  liquidityScore: number;
}

export interface MarketDepthLevel {
  price: BigNumber;
  quantity: BigNumber;
  side: 'BUY' | 'SELL';
  exchange: string;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: MACDData;
  bollingerBands: BollingerBandsData;
  movingAverages: MovingAverageData;
  support: BigNumber[];
  resistance: BigNumber[];
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  momentum: number;
}

export interface MACDData {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsData {
  upper: BigNumber;
  middle: BigNumber;
  lower: BigNumber;
  bandwidth: number;
  percentB: number;
}

export interface MovingAverageData {
  sma20: BigNumber;
  sma50: BigNumber;
  sma200: BigNumber;
  ema12: BigNumber;
  ema26: BigNumber;
}

export interface TradingPairData {
  baseAsset: string;
  quoteAsset: string;
  price: BigNumber;
  volume24h: BigNumber;
  liquidity: BigNumber;
  spread: number;
  priceImpact: PriceImpactData;
  orderBook: OrderBookData;
  recentTrades: TradeData[];
}

export interface PriceImpactData {
  impact1k: number;   // Price impact for $1k trade
  impact10k: number;  // Price impact for $10k trade
  impact100k: number; // Price impact for $100k trade
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midPrice: BigNumber;
}

export interface OrderBookLevel {
  price: BigNumber;
  quantity: BigNumber;
  total: BigNumber;
}

export interface TradeData {
  id: string;
  price: BigNumber;
  quantity: BigNumber;
  side: 'BUY' | 'SELL';
  timestamp: number;
  maker: boolean;
}
```

### 4. Protocol Integration Structures
Data structures for DeFi protocol interactions and integrations.

```typescript
export interface ProtocolData {
  name: string;
  version: string;
  address: string;
  chainId: number;
  type: ProtocolType;
  status: ProtocolStatus;
  tvl: BigNumber;
  volume24h: BigNumber;
  fees24h: BigNumber;
  apy: number;
  risks: RiskAssessment;
  supportedAssets: string[];
  features: ProtocolFeature[];
  governance: GovernanceInfo;
}

export enum ProtocolType {
  DEX = 'DEX',
  LENDING = 'LENDING',
  YIELD_FARMING = 'YIELD_FARMING',
  STAKING = 'STAKING',
  DERIVATIVES = 'DERIVATIVES',
  INSURANCE = 'INSURANCE',
  SYNTHETIC = 'SYNTHETIC',
  OPTIONS = 'OPTIONS',
  PERPETUALS = 'PERPETUALS'
}

export enum ProtocolStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DEPRECATED = 'DEPRECATED',
  EMERGENCY = 'EMERGENCY',
  MAINTENANCE = 'MAINTENANCE'
}

export interface RiskAssessment {
  overall: number;
  smartContract: number;
  liquidity: number;
  centralization: number;
  regulatory: number;
  technical: number;
  audits: AuditInfo[];
  incidents: SecurityIncident[];
}

export interface AuditInfo {
  auditor: string;
  date: number;
  report: string;
  findings: AuditFinding[];
  score: number;
}

export interface AuditFinding {
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
  status: 'OPEN' | 'RESOLVED' | 'MITIGATED';
}

export interface SecurityIncident {
  date: number;
  type: string;
  severity: string;
  impact: string;
  resolved: boolean;
  losses?: BigNumber;
}

export interface ProtocolFeature {
  name: string;
  enabled: boolean;
  parameters: { [key: string]: any };
  gasEstimate: BigNumber;
}

export interface GovernanceInfo {
  tokenAddress: string;
  votingPower: BigNumber;
  proposals: GovernanceProposal[];
  votingHistory: GovernanceVote[];
}

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: ProposalStatus;
  votesFor: BigNumber;
  votesAgainst: BigNumber;
  votesAbstain: BigNumber;
  startTime: number;
  endTime: number;
  executionTime?: number;
}

export enum ProposalStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED'
}

export interface GovernanceVote {
  proposalId: string;
  voter: string;
  support: boolean;
  weight: BigNumber;
  reason?: string;
  timestamp: number;
}

export interface ProtocolPosition {
  protocol: string;
  asset: string;
  positionType: PositionType;
  size: BigNumber;
  value: BigNumber;
  entryPrice?: BigNumber;
  currentPrice: BigNumber;
  unrealizedPnL: BigNumber;
  collateral?: BigNumber;
  debt?: BigNumber;
  healthFactor?: number;
  liquidationPrice?: BigNumber;
  apy?: number;
  rewards?: ProtocolReward[];
  risks: PositionRisk[];
}

export enum PositionType {
  LENDING = 'LENDING',
  BORROWING = 'BORROWING',
  LIQUIDITY_PROVIDING = 'LIQUIDITY_PROVIDING',
  STAKING = 'STAKING',
  FARMING = 'FARMING',
  TRADING = 'TRADING',
  DERIVATIVES = 'DERIVATIVES'
}

export interface ProtocolReward {
  token: string;
  amount: BigNumber;
  apy: number;
  claimable: boolean;
  vestingPeriod?: number;
  lockupPeriod?: number;
}

export interface PositionRisk {
  type: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  impact: BigNumber;
  probability: number;
  mitigation?: string;
}
```

### 5. Messaging and Communication Structures
Structures for agent communication and coordination protocols.

```typescript
export interface Message {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  priority: MessagePriority;
  payload: MessagePayload;
  metadata: MessageMetadata;
  timestamp: number;
  ttl?: number;
  signature: string;
  encryption?: EncryptionInfo;
}

export enum MessageType {
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
  NOTIFICATION = 'NOTIFICATION',
  COMMAND = 'COMMAND',
  EVENT = 'EVENT',
  HEARTBEAT = 'HEARTBEAT',
  ERROR = 'ERROR',
  ACKNOWLEDGMENT = 'ACKNOWLEDGMENT'
}

export enum MessagePriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
  EMERGENCY = 5
}

export interface MessagePayload {
  action: string;
  data: any;
  requestId?: string;
  correlationId?: string;
  sessionId?: string;
}

export interface MessageMetadata {
  source: string;
  destination: string;
  route?: string[];
  retryCount: number;
  maxRetries: number;
  timeout: number;
  deliveryMode: 'BEST_EFFORT' | 'AT_LEAST_ONCE' | 'EXACTLY_ONCE';
  compression?: 'GZIP' | 'DEFLATE' | 'BROTLI';
}

export interface EncryptionInfo {
  algorithm: string;
  keyId: string;
  iv: string;
  authTag: string;
}

export interface CommunicationChannel {
  id: string;
  name: string;
  type: ChannelType;
  participants: string[];
  configuration: ChannelConfiguration;
  status: ChannelStatus;
  metrics: ChannelMetrics;
}

export enum ChannelType {
  POINT_TO_POINT = 'POINT_TO_POINT',
  MULTICAST = 'MULTICAST',
  BROADCAST = 'BROADCAST',
  TOPIC = 'TOPIC',
  QUEUE = 'QUEUE'
}

export interface ChannelConfiguration {
  persistent: boolean;
  ordered: boolean;
  encrypted: boolean;
  maxMessageSize: number;
  retentionPeriod: number;
  rateLimits: RateLimit[];
}

export interface RateLimit {
  type: 'MESSAGES_PER_SECOND' | 'BYTES_PER_SECOND' | 'BURST';
  limit: number;
  window: number;
}

export enum ChannelStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
  ERROR = 'ERROR'
}

export interface ChannelMetrics {
  messagesReceived: number;
  messagesSent: number;
  bytesTransferred: number;
  averageLatency: number;
  errorRate: number;
  uptime: number;
}
```

### 6. Monitoring and Analytics Structures
Data structures for system monitoring, metrics, and analytics.

```typescript
export interface SystemMetrics {
  timestamp: number;
  system: SystemHealthMetrics;
  agents: AgentSystemMetrics;
  protocols: ProtocolSystemMetrics;
  network: NetworkMetrics;
  performance: PerformanceMetrics;
}

export interface SystemHealthMetrics {
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  errorRate: number;
  throughput: number;
  responseTime: number;
}

export interface AgentSystemMetrics {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  busyAgents: number;
  erroredAgents: number;
  averageUtilization: number;
  taskQueueLength: number;
  averageResponseTime: number;
}

export interface ProtocolSystemMetrics {
  totalProtocols: number;
  activeProtocols: number;
  totalTVL: BigNumber;
  totalVolume24h: BigNumber;
  averageAPY: number;
  protocolErrors: number;
  failedTransactions: number;
}

export interface NetworkMetrics {
  messagesPerSecond: number;
  averageLatency: number;
  throughput: number;
  packetLoss: number;
  bandwidth: number;
  connectionCount: number;
  activeChannels: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  source: string;
  metrics: AlertMetric[];
  conditions: AlertCondition[];
  actions: AlertAction[];
  status: AlertStatus;
  created: number;
  updated: number;
  acknowledged?: number;
  resolved?: number;
}

export enum AlertType {
  SYSTEM = 'SYSTEM',
  AGENT = 'AGENT',
  PROTOCOL = 'PROTOCOL',
  FINANCIAL = 'FINANCIAL',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE'
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

export interface AlertMetric {
  name: string;
  value: number;
  threshold: number;
  unit: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  threshold: number;
  duration: number;
}

export interface AlertAction {
  type: 'EMAIL' | 'SMS' | 'WEBHOOK' | 'SLACK' | 'TELEGRAM' | 'CUSTOM';
  target: string;
  message: string;
  executed: boolean;
  timestamp?: number;
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  SUPPRESSED = 'SUPPRESSED'
}

export interface AnalyticsReport {
  id: string;
  name: string;
  type: ReportType;
  period: ReportPeriod;
  data: ReportData;
  insights: ReportInsight[];
  recommendations: ReportRecommendation[];
  generated: number;
}

export enum ReportType {
  PERFORMANCE = 'PERFORMANCE',
  FINANCIAL = 'FINANCIAL',
  OPERATIONAL = 'OPERATIONAL',
  RISK = 'RISK',
  COMPLIANCE = 'COMPLIANCE'
}

export interface ReportPeriod {
  start: number;
  end: number;
  interval: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
}

export interface ReportData {
  summary: { [key: string]: any };
  details: { [key: string]: any[] };
  charts: ChartData[];
  tables: TableData[];
}

export interface ChartData {
  type: 'LINE' | 'BAR' | 'PIE' | 'SCATTER' | 'HEATMAP';
  title: string;
  xAxis: string;
  yAxis: string;
  series: ChartSeries[];
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
  type?: string;
}

export interface TableData {
  title: string;
  columns: string[];
  rows: any[][];
  sortable: boolean;
  pagination?: boolean;
}

export interface ReportInsight {
  type: 'TREND' | 'ANOMALY' | 'CORRELATION' | 'PREDICTION';
  title: string;
  description: string;
  confidence: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  data: any;
}

export interface ReportRecommendation {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string;
  resources: string[];
}
```

These comprehensive data structures provide the foundation for type-safe, consistent data modeling throughout the NEXUS AI DeFi platform, ensuring reliable communication, accurate computations, and maintainable code.