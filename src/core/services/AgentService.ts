import { Logger } from '../../utils/logger';

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: 'PORTFOLIO_MANAGER' | 'ARBITRAGE_BOT' | 'RISK_MANAGER' | 'MARKET_MAKER';
  status: 'DRAFT' | 'TESTING' | 'DEPLOYED' | 'PAUSED' | 'STOPPED';
  version: string;
  userId: string;
  config: Record<string, any>;
  performance?: AgentPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentPerformance {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  averageReturn: number;
  volatility: number;
  timeRange: string;
}

export interface AgentFilter {
  userId?: string;
  status?: string;
  type?: string;
  name?: string;
}

export class AgentService {
  private logger = new Logger('AgentService');
  private agents: Map<string, Agent> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockAgents: Agent[] = [
      {
        id: 'agent-1',
        name: 'Conservative Portfolio Manager',
        description: 'Low-risk portfolio management with focus on stable returns',
        type: 'PORTFOLIO_MANAGER',
        status: 'DEPLOYED',
        version: '1.0.0',
        userId: 'user-123',
        config: {
          riskTolerance: 'LOW',
          rebalanceFrequency: 'MONTHLY',
          maxAllocation: 0.3
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'agent-2',
        name: 'SEI Arbitrage Bot',
        description: 'Exploits price differences across DEXs on Sei',
        type: 'ARBITRAGE_BOT',
        status: 'TESTING',
        version: '1.2.0',
        userId: 'user-123',
        config: {
          minProfitThreshold: 0.005,
          maxSlippage: 0.01,
          protocols: ['dragonswap', 'yei-finance']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockAgents.forEach(agent => this.agents.set(agent.id, agent));
    this.logger.info('Mock agent data initialized', { count: mockAgents.length });
  }

  async findMany(filter?: AgentFilter): Promise<Agent[]> {
    let agents = Array.from(this.agents.values());

    if (filter) {
      if (filter.userId) {
        agents = agents.filter(agent => agent.userId === filter.userId);
      }
      if (filter.status) {
        agents = agents.filter(agent => agent.status === filter.status);
      }
      if (filter.type) {
        agents = agents.filter(agent => agent.type === filter.type);
      }
      if (filter.name) {
        agents = agents.filter(agent => 
          agent.name.toLowerCase().includes(filter.name.toLowerCase())
        );
      }
    }

    this.logger.info('Agents retrieved', { count: agents.length, filter });
    return agents;
  }

  async findById(id: string): Promise<Agent | null> {
    const agent = this.agents.get(id);
    if (agent) {
      this.logger.info('Agent found', { id, name: agent.name });
    } else {
      this.logger.warn('Agent not found', { id });
    }
    return agent || null;
  }

  async create(agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const agent: Agent = {
      ...agentData,
      id: `agent-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.agents.set(agent.id, agent);
    this.logger.info('Agent created', { id: agent.id, name: agent.name });
    return agent;
  }

  async update(id: string, updates: Partial<Agent>): Promise<Agent> {
    const existingAgent = this.agents.get(id);
    if (!existingAgent) {
      throw new Error('Agent not found');
    }

    const updatedAgent: Agent = {
      ...existingAgent,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    this.agents.set(id, updatedAgent);
    this.logger.info('Agent updated', { id, updates: Object.keys(updates) });
    return updatedAgent;
  }

  async delete(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status === 'DEPLOYED') {
      throw new Error('Cannot delete deployed agent');
    }

    this.agents.delete(id);
    this.logger.info('Agent deleted', { id });
  }

  async deploy(id: string): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status !== 'TESTING') {
      throw new Error('Agent must be in TESTING status to deploy');
    }

    const deployedAgent: Agent = {
      ...agent,
      status: 'DEPLOYED',
      updatedAt: new Date()
    };

    this.agents.set(id, deployedAgent);
    this.logger.info('Agent deployed', { id, name: agent.name });
    return deployedAgent;
  }

  async pause(id: string): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status !== 'DEPLOYED') {
      throw new Error('Only deployed agents can be paused');
    }

    const pausedAgent: Agent = {
      ...agent,
      status: 'PAUSED',
      updatedAt: new Date()
    };

    this.agents.set(id, pausedAgent);
    this.logger.info('Agent paused', { id, name: agent.name });
    return pausedAgent;
  }

  async getPerformance(id: string, timeRange: string = 'ALL'): Promise<AgentPerformance> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Mock performance data based on agent type
    const mockPerformance: AgentPerformance = {
      totalReturn: agent.type === 'ARBITRAGE_BOT' ? 0.15 : 0.08,
      sharpeRatio: agent.type === 'ARBITRAGE_BOT' ? 1.8 : 1.2,
      maxDrawdown: agent.type === 'PORTFOLIO_MANAGER' ? -0.05 : -0.12,
      winRate: agent.type === 'ARBITRAGE_BOT' ? 0.75 : 0.62,
      totalTrades: agent.type === 'ARBITRAGE_BOT' ? 1247 : 89,
      averageReturn: agent.type === 'ARBITRAGE_BOT' ? 0.0032 : 0.0089,
      volatility: agent.type === 'PORTFOLIO_MANAGER' ? 0.12 : 0.18,
      timeRange
    };

    this.logger.info('Performance data retrieved', { id, timeRange });
    return mockPerformance;
  }

  async getActiveAgents(userId?: string): Promise<Agent[]> {
    const filter: AgentFilter = { status: 'DEPLOYED' };
    if (userId) {
      filter.userId = userId;
    }
    return this.findMany(filter);
  }

  async getAgentsByType(type: Agent['type'], userId?: string): Promise<Agent[]> {
    const filter: AgentFilter = { type };
    if (userId) {
      filter.userId = userId;
    }
    return this.findMany(filter);
  }
}