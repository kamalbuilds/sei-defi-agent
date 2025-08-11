import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { Agent, AgentStatus, AgentCapability } from '../types';
import { Logger } from '../utils/logger';
import { HealthMonitor } from '../infrastructure/monitoring/healthMonitor';

export interface AgentRegistryConfig {
  maxAgents: number;
  healthCheckInterval: number;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private agentTypes: Map<string, number> = new Map();
  private capabilities: Map<string, string[]> = new Map();
  private healthMonitor: HealthMonitor;
  private redis: Redis; // For regular Redis operations
  private redisPubSub: Redis; // Dedicated connection for pub/sub operations
  private logger: Logger;
  private config: AgentRegistryConfig;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: AgentRegistryConfig) {
    super();
    this.config = config;
    this.logger = new Logger('AgentRegistry');
    // Create separate Redis connections
    this.redis = new Redis(config.redis); // For regular commands
    this.redisPubSub = new Redis(config.redis); // For pub/sub operations
    this.healthMonitor = new HealthMonitor();
    
    // Handle Redis connection errors
    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error (regular):', error);
    });
    
    this.redisPubSub.on('error', (error) => {
      this.logger.error('Redis connection error (pub/sub):', error);
    });
    
    // Handle reconnection events
    this.redis.on('connect', () => {
      this.logger.info('Redis connection established (regular)');
    });
    
    this.redisPubSub.on('connect', () => {
      this.logger.info('Redis connection established (pub/sub)');
    });
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Redis subscriptions for agent coordination using dedicated pub/sub connection
      await this.redisPubSub.subscribe('agent:register', 'agent:heartbeat', 'agent:capabilities');
      
      this.redisPubSub.on('message', (channel: string, message: string) => {
        this.handleRedisMessage(channel, JSON.parse(message));
      });
      
      // Start heartbeat monitoring
      this.heartbeatInterval = setInterval(() => {
        this.performHeartbeatCheck();
      }, this.config.healthCheckInterval);
      
      // Load existing agents from Redis (for persistence)
      await this.loadPersistedAgents();
      
      this.logger.info('Agent Registry initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Agent Registry:', error);
      throw error;
    }
  }

  async registerAgent(agent: Agent): Promise<void> {
    try {
      // Validate agent configuration
      this.validateAgent(agent);
      
      // Check capacity limits
      if (this.agents.size >= this.config.maxAgents) {
        throw new Error(`Maximum agent capacity reached: ${this.config.maxAgents}`);
      }
      
      // Check for duplicate IDs
      if (this.agents.has(agent.id)) {
        throw new Error(`Agent with ID ${agent.id} already exists`);
      }
      
      // Store agent locally
      this.agents.set(agent.id, agent);
      
      // Update type counters
      const currentCount = this.agentTypes.get(agent.type) || 0;
      this.agentTypes.set(agent.type, currentCount + 1);
      
      // Store capabilities mapping
      this.capabilities.set(agent.id, agent.capabilities);
      
      // Persist to Redis
      await this.redis.hset('nexus:agents', agent.id, JSON.stringify(agent));
      await this.redis.sadd(`nexus:agents:${agent.type}`, agent.id);
      
      // Start health monitoring
      this.healthMonitor.startMonitoring(agent.id);
      
      // Notify other components
      await this.redisPubSub.publish('agent:register', JSON.stringify({
        action: 'registered',
        agent: agent
      }));
      
      this.emit('agentRegistered', agent);
      this.logger.info(`Agent registered: ${agent.id} (${agent.type})`);
      
    } catch (error) {
      this.logger.error(`Failed to register agent ${agent.id}:`, error);
      throw error;
    }
  }

  async deregisterAgent(agentId: string): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      // Remove from local storage
      this.agents.delete(agentId);
      
      // Update type counters
      const currentCount = this.agentTypes.get(agent.type) || 0;
      this.agentTypes.set(agent.type, Math.max(0, currentCount - 1));
      
      // Remove capabilities
      this.capabilities.delete(agentId);
      
      // Remove from Redis
      await this.redis.hdel('nexus:agents', agentId);
      await this.redis.srem(`nexus:agents:${agent.type}`, agentId);
      
      // Stop health monitoring
      this.healthMonitor.stopMonitoring(agentId);
      
      // Notify other components
      await this.redisPubSub.publish('agent:register', JSON.stringify({
        action: 'deregistered',
        agentId: agentId
      }));
      
      this.emit('agentDeregistered', agentId);
      this.logger.info(`Agent deregistered: ${agentId}`);
      
    } catch (error) {
      this.logger.error(`Failed to deregister agent ${agentId}:`, error);
      throw error;
    }
  }

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    const previousStatus = agent.status;
    agent.status = status;
    agent.lastHeartbeat = new Date();
    
    // Update in Redis
    await this.redis.hset('nexus:agents', agentId, JSON.stringify(agent));
    
    // Notify status change
    await this.redisPubSub.publish('agent:status', JSON.stringify({
      agentId,
      previousStatus,
      newStatus: status,
      timestamp: new Date()
    }));
    
    this.emit('agentStatusChanged', { agentId, previousStatus, newStatus: status });
    this.logger.debug(`Agent ${agentId} status changed from ${previousStatus} to ${status}`);
  }

  async updateAgentCapabilities(agentId: string, capabilities: string[]): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    agent.capabilities = capabilities;
    this.capabilities.set(agentId, capabilities);
    
    // Update in Redis
    await this.redis.hset('nexus:agents', agentId, JSON.stringify(agent));
    
    // Notify capability update
    await this.redisPubSub.publish('agent:capabilities', JSON.stringify({
      agentId,
      capabilities,
      timestamp: new Date()
    }));
    
    this.emit('agentCapabilitiesUpdated', { agentId, capabilities });
    this.logger.info(`Agent ${agentId} capabilities updated`);
  }

  private validateAgent(agent: Agent): void {
    if (!agent.id || !agent.type || !agent.capabilities) {
      throw new Error('Invalid agent configuration: missing required fields');
    }
    
    if (agent.capabilities.length === 0) {
      throw new Error('Agent must have at least one capability');
    }
    
    const validTypes = ['portfolio', 'arbitrage', 'risk', 'execution', 'analytics', 'payment'];
    if (!validTypes.includes(agent.type)) {
      throw new Error(`Invalid agent type: ${agent.type}`);
    }
  }

  private async loadPersistedAgents(): Promise<void> {
    try {
      const agentData = await this.redis.hgetall('nexus:agents');
      
      for (const [agentId, agentJson] of Object.entries(agentData)) {
        try {
          const agent: Agent = JSON.parse(agentJson);
          this.agents.set(agentId, agent);
          
          // Update type counters
          const currentCount = this.agentTypes.get(agent.type) || 0;
          this.agentTypes.set(agent.type, currentCount + 1);
          
          // Store capabilities
          this.capabilities.set(agentId, agent.capabilities);
          
          // Start monitoring if agent is active
          if (agent.status === 'active') {
            this.healthMonitor.startMonitoring(agentId);
          }
          
        } catch (error) {
          this.logger.error(`Failed to load agent ${agentId}:`, error);
          // Remove corrupted agent data
          await this.redis.hdel('nexus:agents', agentId);
        }
      }
      
      this.logger.info(`Loaded ${this.agents.size} persisted agents`);
      
    } catch (error) {
      this.logger.error('Failed to load persisted agents:', error);
    }
  }

  private async performHeartbeatCheck(): Promise<void> {
    const now = new Date();
    const timeout = 60000; // 1 minute timeout
    
    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'active' && agent.lastHeartbeat) {
        const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > timeout) {
          this.logger.warn(`Agent ${agentId} missed heartbeat, marking as unhealthy`);
          agent.status = 'unhealthy';
          
          await this.redisPubSub.publish('agent:health', JSON.stringify({
            agentId,
            status: 'unhealthy',
            reason: 'missed_heartbeat',
            timestamp: now
          }));
          
          this.emit('agentUnhealthy', { agentId, reason: 'missed_heartbeat' });
        }
      }
    }
  }

  private handleRedisMessage(channel: string, message: any): void {
    switch (channel) {
      case 'agent:heartbeat':
        this.handleHeartbeatMessage(message);
        break;
      case 'agent:capabilities':
        this.handleCapabilityUpdate(message);
        break;
      default:
        this.logger.debug(`Received message on ${channel}:`, message);
    }
  }

  private async handleHeartbeatMessage(message: any): Promise<void> {
    const { agentId, timestamp, metrics } = message;
    
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date(timestamp);
      
      if (metrics) {
        agent.performanceMetrics = { ...agent.performanceMetrics, ...metrics };
      }
      
      // Update status if agent was unhealthy
      if (agent.status === 'unhealthy') {
        agent.status = 'active';
        this.emit('agentRecovered', { agentId });
      }
    }
  }

  private handleCapabilityUpdate(message: any): void {
    const { agentId, capabilities } = message;
    
    if (this.agents.has(agentId)) {
      this.capabilities.set(agentId, capabilities);
      this.emit('agentCapabilitiesUpdated', { agentId, capabilities });
    }
  }

  // Query methods
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByType(type: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.type === type);
  }

  getAgentsByStatus(status: AgentStatus): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.status === status);
  }

  getAgentsByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.capabilities.includes(capability)
    );
  }

  findBestAgent(criteria: {
    type?: string;
    capabilities?: string[];
    status?: AgentStatus;
    minReputation?: number;
  }): Agent | undefined {
    let candidates = Array.from(this.agents.values());
    
    // Apply filters
    if (criteria.type) {
      candidates = candidates.filter(agent => agent.type === criteria.type);
    }
    
    if (criteria.capabilities) {
      candidates = candidates.filter(agent => 
        criteria.capabilities!.every(cap => agent.capabilities.includes(cap))
      );
    }
    
    if (criteria.status) {
      candidates = candidates.filter(agent => agent.status === criteria.status);
    }
    
    // Score agents based on performance metrics
    const scoredCandidates = candidates.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent)
    }));
    
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    return scoredCandidates.length > 0 ? scoredCandidates[0].agent : undefined;
  }

  private calculateAgentScore(agent: Agent): number {
    const metrics = agent.performanceMetrics;
    
    // Base score on efficiency and error rate
    let score = (metrics.efficiency || 0.5) * 100;
    
    // Penalize high error rates
    const errorPenalty = (metrics.errorRate || 0) * 50;
    score -= errorPenalty;
    
    // Bonus for low latency
    const latencyBonus = Math.max(0, (5000 - (metrics.averageLatency || 5000)) / 100);
    score += latencyBonus;
    
    // Bonus for high task completion
    const taskBonus = (metrics.tasksCompleted || 0) / 10;
    score += taskBonus;
    
    return Math.max(0, score);
  }

  getRegistryStats(): {
    totalAgents: number;
    agentsByType: Record<string, number>;
    agentsByStatus: Record<string, number>;
    capabilities: Record<string, number>;
  } {
    const agentsByStatus: Record<string, number> = {};
    const capabilityCount: Record<string, number> = {};
    
    for (const agent of this.agents.values()) {
      // Count by status
      agentsByStatus[agent.status] = (agentsByStatus[agent.status] || 0) + 1;
      
      // Count capabilities
      for (const capability of agent.capabilities) {
        capabilityCount[capability] = (capabilityCount[capability] || 0) + 1;
      }
    }
    
    return {
      totalAgents: this.agents.size,
      agentsByType: Object.fromEntries(this.agentTypes),
      agentsByStatus,
      capabilities: capabilityCount
    };
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Stop all health monitoring
    for (const agentId of this.agents.keys()) {
      this.healthMonitor.stopMonitoring(agentId);
    }
    
    // Unsubscribe from Redis pub/sub connection
    await this.redisPubSub.unsubscribe('agent:register', 'agent:heartbeat', 'agent:capabilities');
    
    // Close both Redis connections
    await this.redis.disconnect();
    await this.redisPubSub.disconnect();
    
    this.logger.info('Agent Registry shut down');
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry({
  maxAgents: parseInt(process.env.MAX_AGENTS || '50'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});

// Export initialization function
export async function initializeAgentRegistry(): Promise<void> {
  await agentRegistry.initialize();
}

export default AgentRegistry;