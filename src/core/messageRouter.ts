import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { AgentMessage, MessagePriority, RoutingStrategy } from '../types';
import { Logger } from '../utils/logger';
import { MessageQueue } from '../infrastructure/redis/messageQueue';

export interface MessageRouterConfig {
  routingStrategy: 'round_robin' | 'load_balanced' | 'intelligent' | 'consensus';
  queueSize: number;
  retryAttempts: number;
  timeout: number;
}

interface Route {
  pattern: string | RegExp;
  handler: (message: AgentMessage) => Promise<void>;
  priority: number;
}

interface MessageMetrics {
  sent: number;
  delivered: number;
  failed: number;
  averageLatency: number;
  routeLatency: Map<string, number>;
}

export class MessageRouter extends EventEmitter {
  private redis: Redis;
  private messageQueue: MessageQueue;
  private routes: Map<string, Route[]> = new Map();
  private agentConnections: Map<string, WebSocket | any> = new Map();
  private pendingMessages: Map<string, AgentMessage> = new Map();
  private retryQueue: Map<string, { message: AgentMessage; attempts: number }> = new Map();
  private metrics: MessageMetrics;
  private config: MessageRouterConfig;
  private logger: Logger;
  private routingTable: Map<string, string[]> = new Map();
  private loadBalancer: LoadBalancer;
  private circuitBreaker: Map<string, CircuitBreaker> = new Map();

  constructor(config: MessageRouterConfig) {
    super();
    this.config = config;
    this.logger = new Logger('MessageRouter');
    this.redis = new Redis();
    this.messageQueue = new MessageQueue(this.redis);
    this.loadBalancer = new LoadBalancer();
    
    this.metrics = {
      sent: 0,
      delivered: 0,
      failed: 0,
      averageLatency: 0,
      routeLatency: new Map()
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize message queues
      await this.messageQueue.initialize();
      
      // Subscribe to Redis channels for routing
      await this.redis.subscribe(
        'nexus:routing:register',
        'nexus:routing:unregister',
        'nexus:messages:priority',
        'nexus:messages:broadcast'
      );
      
      this.redis.on('message', (channel: string, message: string) => {
        this.handleRedisMessage(channel, JSON.parse(message));
      });
      
      // Initialize routing strategies
      this.setupRoutingStrategies();
      
      // Start retry processor
      this.startRetryProcessor();
      
      this.logger.info('Message Router initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Message Router:', error);
      throw error;
    }
  }

  private setupRoutingStrategies(): void {
    // Register default routes for agent communication
    this.registerRoute('agent:*:task', async (message: AgentMessage) => {
      await this.routeToAgent(message);
    }, 10);
    
    this.registerRoute('orchestrator:*', async (message: AgentMessage) => {
      await this.routeToOrchestrator(message);
    }, 5);
    
    this.registerRoute('broadcast:*', async (message: AgentMessage) => {
      await this.broadcastMessage(message);
    }, 1);
    
    this.registerRoute('protocol:*', async (message: AgentMessage) => {
      await this.routeToProtocol(message);
    }, 8);
  }

  private registerRoute(
    pattern: string,
    handler: (message: AgentMessage) => Promise<void>,
    priority: number = 5
  ): void {
    const routes = this.routes.get(pattern) || [];
    routes.push({ pattern, handler, priority });
    routes.sort((a, b) => b.priority - a.priority);
    this.routes.set(pattern, routes);
    
    this.logger.debug(`Registered route: ${pattern} with priority ${priority}`);
  }

  async routeMessage(message: AgentMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validate message
      this.validateMessage(message);
      
      // Add to pending messages
      this.pendingMessages.set(message.id, message);
      
      // Apply circuit breaker if destination has been failing
      if (this.isCircuitBreakerOpen(message.to)) {
        throw new Error(`Circuit breaker open for destination: ${message.to}`);
      }
      
      // Find matching route
      const route = this.findMatchingRoute(message);
      
      if (!route) {
        throw new Error(`No route found for message to: ${message.to}`);
      }
      
      // Execute routing based on strategy
      await this.executeRouting(message, route);
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateRouteMetrics(message.to, latency, true);
      this.metrics.sent++;
      
      this.emit('messageRouted', { message, latency });
      this.logger.debug(`Message ${message.id} routed successfully to ${message.to}`);
      
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateRouteMetrics(message.to, latency, false);
      this.metrics.failed++;
      
      // Add to retry queue if retries are available
      if (this.shouldRetry(message)) {
        await this.addToRetryQueue(message);
      } else {
        this.emit('messageFailure', message, error);
        this.logger.error(`Message ${message.id} failed to route:`, error);
      }
    } finally {
      this.pendingMessages.delete(message.id);
    }
  }

  private validateMessage(message: AgentMessage): void {
    if (!message.id || !message.from || !message.to || !message.type) {
      throw new Error('Invalid message: missing required fields');
    }
    
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }
    
    // Check message size limits
    const messageSize = JSON.stringify(message).length;
    if (messageSize > 1024 * 1024) { // 1MB limit
      throw new Error(`Message too large: ${messageSize} bytes`);
    }
  }

  private findMatchingRoute(message: AgentMessage): Route | null {
    const messageType = `${message.to}:${message.type}`;
    
    for (const [pattern, routes] of this.routes) {
      for (const route of routes) {
        if (this.matchPattern(pattern, messageType)) {
          return route;
        }
      }
    }
    
    // Fallback to generic agent routing
    const genericRoutes = this.routes.get('agent:*:*');
    return genericRoutes ? genericRoutes[0] : null;
  }

  private matchPattern(pattern: string, messageType: string): boolean {
    // Simple wildcard matching
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(messageType);
  }

  private async executeRouting(message: AgentMessage, route: Route): Promise<void> {
    switch (this.config.routingStrategy) {
      case 'round_robin':
        await this.roundRobinRouting(message, route);
        break;
      case 'load_balanced':
        await this.loadBalancedRouting(message, route);
        break;
      case 'intelligent':
        await this.intelligentRouting(message, route);
        break;
      case 'consensus':
        await this.consensusRouting(message, route);
        break;
      default:
        await route.handler(message);
    }
  }

  private async roundRobinRouting(message: AgentMessage, route: Route): Promise<void> {
    const availableAgents = this.getAvailableAgents(message.to);
    
    if (availableAgents.length === 0) {
      throw new Error(`No available agents for routing to: ${message.to}`);
    }
    
    // Get next agent in round-robin fashion
    const agentIndex = this.metrics.sent % availableAgents.length;
    const selectedAgent = availableAgents[agentIndex];
    
    message.to = selectedAgent;
    await route.handler(message);
  }

  private async loadBalancedRouting(message: AgentMessage, route: Route): Promise<void> {
    const availableAgents = this.getAvailableAgents(message.to);
    
    if (availableAgents.length === 0) {
      throw new Error(`No available agents for load balanced routing to: ${message.to}`);
    }
    
    // Select agent with lowest load
    const selectedAgent = this.loadBalancer.selectAgent(availableAgents);
    message.to = selectedAgent;
    
    await route.handler(message);
  }

  private async intelligentRouting(message: AgentMessage, route: Route): Promise<void> {
    // Use ML/heuristics to select best route
    const routingDecision = await this.makeIntelligentRoutingDecision(message);
    
    if (routingDecision.multicast) {
      // Send to multiple agents
      const promises = routingDecision.targets.map(async (target) => {
        const clonedMessage = { ...message, to: target, id: `${message.id}-${target}` };
        await route.handler(clonedMessage);
      });
      
      await Promise.allSettled(promises);
    } else {
      message.to = routingDecision.targets[0];
      await route.handler(message);
    }
  }

  private async consensusRouting(message: AgentMessage, route: Route): Promise<void> {
    // For critical messages, require consensus from multiple agents
    const availableAgents = this.getAvailableAgents(message.to);
    const consensusSize = Math.min(3, availableAgents.length);
    
    if (consensusSize < 2) {
      // Fallback to regular routing
      await route.handler(message);
      return;
    }
    
    const selectedAgents = availableAgents.slice(0, consensusSize);
    const promises = selectedAgents.map(async (agent) => {
      const consensusMessage = {
        ...message,
        to: agent,
        id: `${message.id}-consensus-${agent}`,
        payload: {
          ...message.payload,
          requiresConsensus: true,
          consensusGroup: selectedAgents
        }
      };
      
      return route.handler(consensusMessage);
    });
    
    await Promise.allSettled(promises);
  }

  private async makeIntelligentRoutingDecision(message: AgentMessage): Promise<{
    targets: string[];
    multicast: boolean;
    confidence: number;
  }> {
    // Analyze message content and routing history
    const messageType = message.type;
    const priority = message.priority || 'normal';
    
    // Get historical performance for potential targets
    const availableAgents = this.getAvailableAgents(message.to);
    const agentPerformance = await this.getAgentPerformanceMetrics(availableAgents);
    
    // Score agents based on performance and suitability
    const scoredAgents = agentPerformance.map(agent => ({
      agentId: agent.id,
      score: this.calculateRoutingScore(agent, message)
    }));
    
    scoredAgents.sort((a, b) => b.score - a.score);
    
    // Decide on routing strategy
    if (priority === 'high' || messageType === 'critical_alert') {
      // Multicast to top 2 agents for redundancy
      return {
        targets: scoredAgents.slice(0, 2).map(a => a.agentId),
        multicast: true,
        confidence: 0.9
      };
    } else {
      // Send to best performing agent
      return {
        targets: [scoredAgents[0].agentId],
        multicast: false,
        confidence: 0.8
      };
    }
  }

  private calculateRoutingScore(agent: any, message: AgentMessage): number {
    let score = 100;
    
    // Factor in latency (lower is better)
    const avgLatency = this.metrics.routeLatency.get(agent.id) || 1000;
    score -= (avgLatency / 100);
    
    // Factor in error rate (lower is better)
    const errorRate = agent.errorRate || 0;
    score -= (errorRate * 100);
    
    // Factor in current load (lower is better)
    const currentLoad = this.loadBalancer.getAgentLoad(agent.id);
    score -= (currentLoad * 10);
    
    // Factor in message type compatibility
    if (agent.capabilities && agent.capabilities.includes(message.type)) {
      score += 20;
    }
    
    return Math.max(0, score);
  }

  private getAvailableAgents(pattern: string): string[] {
    const agents = this.routingTable.get(pattern) || [];
    
    // Filter out agents with open circuit breakers
    return agents.filter(agent => !this.isCircuitBreakerOpen(agent));
  }

  private async getAgentPerformanceMetrics(agentIds: string[]): Promise<any[]> {
    // Fetch performance metrics from Redis
    const pipeline = this.redis.pipeline();
    
    agentIds.forEach(agentId => {
      pipeline.hgetall(`nexus:agent:${agentId}:metrics`);
    });
    
    const results = await pipeline.exec();
    
    return agentIds.map((agentId, index) => ({
      id: agentId,
      ...(results?.[index]?.[1] || {})
    }));
  }

  private async routeToAgent(message: AgentMessage): Promise<void> {
    // Route message to specific agent
    const connection = this.agentConnections.get(message.to);
    
    if (connection) {
      // Direct connection available
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
        this.metrics.delivered++;
        this.emit('messageDelivered', message);
      } else {
        throw new Error(`Connection to ${message.to} is not open`);
      }
    } else {
      // Route through Redis queue
      await this.messageQueue.enqueue(`agent:${message.to}:inbox`, message);
      this.metrics.delivered++;
      this.emit('messageDelivered', message);
    }
  }

  private async routeToOrchestrator(message: AgentMessage): Promise<void> {
    // Route to orchestrator
    await this.messageQueue.enqueue('orchestrator:inbox', message);
    this.metrics.delivered++;
    this.emit('messageDelivered', message);
  }

  private async routeToProtocol(message: AgentMessage): Promise<void> {
    // Route to external protocol integrations
    const protocolName = message.to.split(':')[1];
    await this.messageQueue.enqueue(`protocol:${protocolName}:inbox`, message);
    this.metrics.delivered++;
    this.emit('messageDelivered', message);
  }

  private async broadcastMessage(message: AgentMessage): Promise<void> {
    // Broadcast to all connected agents
    const broadcastPromises: Promise<void>[] = [];
    
    // Broadcast via WebSocket connections
    for (const [agentId, connection] of this.agentConnections) {
      if (connection.readyState === WebSocket.OPEN) {
        const broadcastMsg = { ...message, to: agentId, id: `${message.id}-${agentId}` };
        broadcastPromises.push(
          new Promise((resolve, reject) => {
            try {
              connection.send(JSON.stringify(broadcastMsg));
              resolve();
            } catch (error) {
              reject(error);
            }
          })
        );
      }
    }
    
    // Broadcast via Redis
    await this.redis.publish('nexus:broadcast', JSON.stringify(message));
    
    await Promise.allSettled(broadcastPromises);
    this.metrics.delivered += broadcastPromises.length;
  }

  private shouldRetry(message: AgentMessage): boolean {
    const retryInfo = this.retryQueue.get(message.id);
    const attempts = retryInfo ? retryInfo.attempts : 0;
    
    return attempts < this.config.retryAttempts;
  }

  private async addToRetryQueue(message: AgentMessage): Promise<void> {
    const retryInfo = this.retryQueue.get(message.id) || { message, attempts: 0 };
    retryInfo.attempts++;
    
    this.retryQueue.set(message.id, retryInfo);
    
    // Schedule retry with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryInfo.attempts - 1), 30000);
    
    setTimeout(async () => {
      try {
        await this.routeMessage(retryInfo.message);
        this.retryQueue.delete(message.id);
      } catch (error) {
        if (!this.shouldRetry(message)) {
          this.retryQueue.delete(message.id);
          this.emit('messageFailure', message, error);
        }
      }
    }, delay);
    
    this.logger.debug(`Message ${message.id} added to retry queue (attempt ${retryInfo.attempts})`);
  }

  private startRetryProcessor(): void {
    setInterval(() => {
      // Clean up old retry entries
      const now = Date.now();
      
      for (const [messageId, retryInfo] of this.retryQueue) {
        if (now - retryInfo.message.timestamp > 300000) { // 5 minutes max retry time
          this.retryQueue.delete(messageId);
          this.emit('messageFailure', retryInfo.message, new Error('Max retry time exceeded'));
        }
      }
    }, 60000); // Run every minute
  }

  private updateRouteMetrics(destination: string, latency: number, success: boolean): void {
    const currentLatency = this.metrics.routeLatency.get(destination) || 0;
    const newLatency = (currentLatency + latency) / 2; // Simple moving average
    
    this.metrics.routeLatency.set(destination, newLatency);
    
    if (success) {
      this.recordCircuitBreakerSuccess(destination);
    } else {
      this.recordCircuitBreakerFailure(destination);
    }
  }

  private isCircuitBreakerOpen(destination: string): boolean {
    const breaker = this.circuitBreaker.get(destination);
    return breaker ? breaker.isOpen() : false;
  }

  private recordCircuitBreakerSuccess(destination: string): void {
    let breaker = this.circuitBreaker.get(destination);
    if (!breaker) {
      breaker = new CircuitBreaker();
      this.circuitBreaker.set(destination, breaker);
    }
    breaker.recordSuccess();
  }

  private recordCircuitBreakerFailure(destination: string): void {
    let breaker = this.circuitBreaker.get(destination);
    if (!breaker) {
      breaker = new CircuitBreaker();
      this.circuitBreaker.set(destination, breaker);
    }
    breaker.recordFailure();
  }

  private handleRedisMessage(channel: string, message: any): void {
    switch (channel) {
      case 'nexus:routing:register':
        this.handleAgentRegistration(message);
        break;
      case 'nexus:routing:unregister':
        this.handleAgentUnregistration(message);
        break;
      case 'nexus:messages:priority':
        this.handlePriorityMessage(message);
        break;
    }
  }

  private handleAgentRegistration(message: any): void {
    const { agentId, agentType, capabilities } = message;
    
    // Add to routing table
    const typeRoutes = this.routingTable.get(agentType) || [];
    if (!typeRoutes.includes(agentId)) {
      typeRoutes.push(agentId);
      this.routingTable.set(agentType, typeRoutes);
    }
    
    // Add capability-based routes
    capabilities.forEach((capability: string) => {
      const capRoutes = this.routingTable.get(capability) || [];
      if (!capRoutes.includes(agentId)) {
        capRoutes.push(agentId);
        this.routingTable.set(capability, capRoutes);
      }
    });
    
    this.logger.debug(`Agent ${agentId} registered for routing`);
  }

  private handleAgentUnregistration(message: any): void {
    const { agentId } = message;
    
    // Remove from all routing tables
    for (const [key, routes] of this.routingTable) {
      const index = routes.indexOf(agentId);
      if (index > -1) {
        routes.splice(index, 1);
        if (routes.length === 0) {
          this.routingTable.delete(key);
        }
      }
    }
    
    // Remove connection if exists
    this.agentConnections.delete(agentId);
    
    this.logger.debug(`Agent ${agentId} unregistered from routing`);
  }

  private async handlePriorityMessage(message: any): Promise<void> {
    // Handle high-priority messages immediately
    message.priority = 'high';
    await this.routeMessage(message);
  }

  // Public API methods
  registerAgentConnection(agentId: string, connection: WebSocket | any): void {
    this.agentConnections.set(agentId, connection);
    
    connection.on('close', () => {
      this.agentConnections.delete(agentId);
      this.logger.debug(`Agent ${agentId} connection closed`);
    });
    
    this.logger.debug(`Agent ${agentId} connection registered`);
  }

  unregisterAgentConnection(agentId: string): void {
    this.agentConnections.delete(agentId);
    this.logger.debug(`Agent ${agentId} connection unregistered`);
  }

  getRoutingStats(): MessageMetrics {
    return {
      ...this.metrics,
      averageLatency: Array.from(this.metrics.routeLatency.values())
        .reduce((sum, latency) => sum + latency, 0) / this.metrics.routeLatency.size || 0
    };
  }

  optimizeRouting(): void {
    // Implement routing optimization based on metrics
    const avgLatency = this.getRoutingStats().averageLatency;
    
    if (avgLatency > 2000) { // 2 second threshold
      // Switch to more aggressive load balancing
      this.loadBalancer.adjustAggressiveness(1.5);
      this.logger.info('Routing optimization: increased load balancing aggressiveness');
    }
  }

  async shutdown(): Promise<void> {
    // Close all agent connections
    for (const connection of this.agentConnections.values()) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close();
      }
    }
    
    // Unsubscribe from Redis
    await this.redis.unsubscribe();
    
    // Shutdown message queue
    await this.messageQueue.shutdown();
    
    this.logger.info('Message Router shut down');
  }
}

// Helper classes
class LoadBalancer {
  private agentLoads: Map<string, number> = new Map();
  private aggressiveness: number = 1.0;
  
  selectAgent(agents: string[]): string {
    // Select agent with lowest load
    let minLoad = Infinity;
    let selectedAgent = agents[0];
    
    for (const agent of agents) {
      const load = this.agentLoads.get(agent) || 0;
      if (load < minLoad) {
        minLoad = load;
        selectedAgent = agent;
      }
    }
    
    // Increase load for selected agent
    const currentLoad = this.agentLoads.get(selectedAgent) || 0;
    this.agentLoads.set(selectedAgent, currentLoad + this.aggressiveness);
    
    return selectedAgent;
  }
  
  getAgentLoad(agentId: string): number {
    return this.agentLoads.get(agentId) || 0;
  }
  
  adjustAggressiveness(factor: number): void {
    this.aggressiveness = factor;
  }
  
  decrementLoad(agentId: string): void {
    const currentLoad = this.agentLoads.get(agentId) || 0;
    this.agentLoads.set(agentId, Math.max(0, currentLoad - 1));
  }
}

class CircuitBreaker {
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly failureThreshold: number = 5;
  private readonly recoveryTime: number = 30000; // 30 seconds
  
  recordSuccess(): void {
    this.successes++;
    this.failures = 0;
    
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
  }
  
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTime) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false;
  }
}

export default MessageRouter;