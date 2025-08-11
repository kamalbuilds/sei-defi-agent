import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  AgentConfig, 
  AgentType, 
  AgentStatus, 
  AgentMessage, 
  MessageType,
  Task,
  ConsensusResult 
} from '../types';
import { logger } from '../utils/logger';
import { AgentRegistry } from './agentRegistry';
import { MessageBus } from './messageBus';
import { ConsensusEngine } from './consensusEngine';

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, AgentConfig>;
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private consensusEngine: ConsensusEngine;
  private tasks: Map<string, Task>;

  constructor() {
    super();
    this.agents = new Map();
    this.registry = new AgentRegistry({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    });
    this.messageBus = new MessageBus();
    this.consensusEngine = new ConsensusEngine({
      algorithm: 'raft',
      quorumSize: 3,
      timeout: 10000,
      maxProposals: 100
    });
    this.tasks = new Map();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.messageBus.on('message', this.handleMessage.bind(this));
    this.consensusEngine.on('consensus', this.handleConsensus.bind(this));
    
    await this.spawnCoreAgents();
    logger.info('Agent Orchestrator initialized');
  }

  private async spawnCoreAgents(): Promise<void> {
    const coreAgents = [
      { type: AgentType.PORTFOLIO_MANAGER, name: 'PortfolioManager_Alpha' },
      { type: AgentType.ARBITRAGE_HUNTER, name: 'ArbitrageHunter_Prime' },
      { type: AgentType.RISK_MANAGER, name: 'RiskGuardian_One' },
      { type: AgentType.EXECUTION, name: 'ExecutionEngine_Fast' },
      { type: AgentType.ANALYTICS, name: 'AnalyticsCore_Deep' },
      { type: AgentType.PAYMENT, name: 'PaymentProcessor_Secure' }
    ];

    for (const agentDef of coreAgents) {
      await this.spawnAgent(agentDef.type, agentDef.name);
    }
  }

  async spawnAgent(type: AgentType, name: string): Promise<string> {
    const agentId = `agent_${uuidv4()}`;
    
    const config: AgentConfig = {
      id: agentId,
      name,
      type,
      capabilities: this.getAgentCapabilities(type),
      status: AgentStatus.IDLE,
      wallet: this.generateAgentWallet(),
      reputation: 100,
      performance: {
        totalProfit: BigInt(0),
        totalLoss: BigInt(0),
        winRate: 0,
        avgReturnPerTrade: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalTransactions: 0
      }
    };

    this.agents.set(agentId, config);
    // For now, just create an agent config without registering
    // The actual agent registration happens when agent is created
    
    this.emit('agentSpawned', config);
    logger.info(`Agent spawned: ${name} (${agentId})`);
    
    return agentId;
  }

  private getAgentCapabilities(type: AgentType): string[] {
    const capabilities: { [key in AgentType]: string[] } = {
      [AgentType.PORTFOLIO_MANAGER]: [
        'portfolio_optimization',
        'risk_assessment',
        'rebalancing',
        'yield_farming'
      ],
      [AgentType.ARBITRAGE_HUNTER]: [
        'price_monitoring',
        'opportunity_detection',
        'flash_loans',
        'cross_dex_execution'
      ],
      [AgentType.RISK_MANAGER]: [
        'position_monitoring',
        'liquidation_protection',
        'hedging',
        'stop_loss_management'
      ],
      [AgentType.EXECUTION]: [
        'transaction_execution',
        'gas_optimization',
        'slippage_protection',
        'mev_protection'
      ],
      [AgentType.ANALYTICS]: [
        'market_analysis',
        'performance_tracking',
        'sentiment_analysis',
        'predictive_modeling'
      ],
      [AgentType.PAYMENT]: [
        'payment_processing',
        'escrow_management',
        'fee_distribution',
        'micropayments'
      ],
      [AgentType.STRATEGY]: [
        'strategy_development',
        'backtesting',
        'optimization',
        'signal_generation'
      ]
    };

    return capabilities[type] || [];
  }

  private generateAgentWallet(): string {
    // In production, this would generate a real wallet
    return `0x${Array(40).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;
  }

  async assignTask(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
    
    const eligibleAgents = this.findEligibleAgents(task);
    
    if (eligibleAgents.length === 0) {
      logger.warn(`No eligible agents for task ${task.id}`);
      return;
    }

    if (task.priority === 'CRITICAL' || eligibleAgents.length > 1) {
      await this.consensusEngine.requestConsensus(task, eligibleAgents);
    } else {
      await this.directAssignment(task, eligibleAgents[0]);
    }
  }

  private findEligibleAgents(task: Task): AgentConfig[] {
    const eligible: AgentConfig[] = [];
    
    for (const agent of this.agents.values()) {
      if (
        task.requiredAgents.includes(agent.type) &&
        agent.status === AgentStatus.IDLE &&
        agent.reputation > 50
      ) {
        eligible.push(agent);
      }
    }
    
    return eligible.sort((a, b) => b.reputation - a.reputation);
  }

  private async directAssignment(task: Task, agent: AgentConfig): Promise<void> {
    agent.status = AgentStatus.EXECUTING;
    
    const message: AgentMessage = {
      from: 'orchestrator',
      to: agent.id,
      type: MessageType.EXECUTION,
      payload: task,
      timestamp: Date.now(),
      signature: await this.signMessage(task)
    };
    
    await this.messageBus.send(message);
    logger.info(`Task ${task.id} assigned to ${agent.name}`);
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    logger.debug(`Message received: ${message.type} from ${message.from}`);
    
    switch (message.type) {
      case MessageType.REQUEST:
        await this.handleAgentRequest(message);
        break;
      case MessageType.ALERT:
        await this.handleAlert(message);
        break;
      case MessageType.COORDINATION:
        await this.handleCoordination(message);
        break;
      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async handleAgentRequest(message: AgentMessage): Promise<void> {
    const { service, params } = message.payload;
    
    const providers = this.findServiceProviders(service);
    
    if (providers.length > 0) {
      const response: AgentMessage = {
        from: providers[0].id,
        to: message.from,
        type: MessageType.RESPONSE,
        payload: { service, result: 'Service provided' },
        timestamp: Date.now(),
        signature: await this.signMessage({ service })
      };
      
      await this.messageBus.send(response);
    }
  }

  private findServiceProviders(service: string): AgentConfig[] {
    return Array.from(this.agents.values()).filter(agent =>
      agent.capabilities.includes(service) && 
      agent.status === AgentStatus.IDLE
    );
  }

  private async handleAlert(message: AgentMessage): Promise<void> {
    const { severity, description } = message.payload;
    
    logger.warn(`Alert from ${message.from}: ${description}`);
    
    if (severity === 'CRITICAL') {
      await this.pauseAllAgents();
      this.emit('criticalAlert', message);
    }
  }

  private async handleCoordination(message: AgentMessage): Promise<void> {
    const { taskId, status, result } = message.payload;
    
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    if (status === 'COMPLETED') {
      await this.completeTask(taskId, result);
    } else if (status === 'FAILED') {
      await this.reassignTask(taskId);
    }
  }

  private async handleConsensus(result: ConsensusResult): Promise<void> {
    const { taskId, agentId } = result as any;
    
    if (result.approved) {
      const task = this.tasks.get(taskId);
      const agent = this.agents.get(agentId);
      
      if (task && agent) {
        await this.directAssignment(task, agent);
      }
    }
  }

  private async completeTask(taskId: string, result: any): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    this.tasks.delete(taskId);
    this.emit('taskCompleted', { taskId, result });
    
    logger.info(`Task ${taskId} completed successfully`);
  }

  private async reassignTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    logger.info(`Reassigning task ${taskId}`);
    await this.assignTask(task);
  }

  private async pauseAllAgents(): Promise<void> {
    for (const agent of this.agents.values()) {
      agent.status = AgentStatus.PAUSED;
    }
    logger.warn('All agents paused due to critical alert');
  }

  private async signMessage(data: any): Promise<string> {
    // Implement message signing
    return `signature_${Date.now()}`;
  }

  async getAgentStatus(agentId: string): Promise<AgentConfig | undefined> {
    return this.agents.get(agentId);
  }

  async getAllAgents(): Promise<AgentConfig[]> {
    return Array.from(this.agents.values());
  }

  async updateAgentReputation(agentId: string, change: number): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.reputation = Math.max(0, Math.min(100, agent.reputation + change));
      logger.info(`Agent ${agent.name} reputation updated to ${agent.reputation}`);
    }
  }

  async stopAllAgents(): Promise<void> {
    for (const agent of this.agents.values()) {
      agent.status = AgentStatus.STOPPED;
    }
    logger.info('All agents stopped');
  }
}

// Export singleton instance
export const orchestrator = new AgentOrchestrator();

// Export startup function
export async function startAgentOrchestrator(): Promise<void> {
  await orchestrator.initialize();
}

// Export individual functions for direct use
export const spawnAgent = (type: AgentType, name: string) => orchestrator.spawnAgent(type, name);
export const stopAllAgents = () => orchestrator.stopAllAgents();