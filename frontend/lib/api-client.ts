import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'error';
  performance: {
    totalProfit: string;
    winRate: number;
    avgReturnPerTrade: number;
    sharpeRatio: number;
  };
  lastAction: string;
  description: string;
}

export interface Portfolio {
  totalValue: string;
  assets: Array<{
    token: string;
    amount: string;
    value: string;
    allocation: number;
    apy?: number;
  }>;
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
}

export interface ArbitrageOpportunity {
  id: string;
  buyExchange: string;
  sellExchange: string;
  token: string;
  profitEstimate: string;
  confidence: number;
  expiresAt: number;
}

class ApiClient {
  private socket: Socket | null = null;

  // REST API Methods
  async getAgents(): Promise<Agent[]> {
    try {
      const response = await fetch(`${API_URL}/api/agents`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  async getPortfolio(address: string): Promise<Portfolio | null> {
    try {
      const response = await fetch(`${API_URL}/api/portfolio/${address}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      return null;
    }
  }

  async getArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    try {
      const response = await fetch(`${API_URL}/api/arbitrage/opportunities`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching arbitrage opportunities:', error);
      return [];
    }
  }

  async executeArbitrage(opportunityId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/arbitrage/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opportunityId }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error executing arbitrage:', error);
      return false;
    }
  }

  async updateAgentConfig(agentId: string, config: any): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      return response.ok;
    } catch (error) {
      console.error('Error updating agent config:', error);
      return false;
    }
  }

  async startAgent(agentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/start`, {
        method: 'POST',
      });
      return response.ok;
    } catch (error) {
      console.error('Error starting agent:', error);
      return false;
    }
  }

  async stopAgent(agentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/stop`, {
        method: 'POST',
      });
      return response.ok;
    } catch (error) {
      console.error('Error stopping agent:', error);
      return false;
    }
  }

  async getMetrics(): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/metrics`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return {};
    }
  }

  // WebSocket Methods
  connectWebSocket(
    onConnect?: () => void,
    onDisconnect?: () => void,
    onError?: (error: Error) => void
  ): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      onConnect?.();
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      onDisconnect?.();
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    });

    return this.socket;
  }

  subscribeToAgentUpdates(agentId: string, callback: (data: any) => void): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('subscribe', {
      type: 'subscribe',
      payload: { agentId }
    });

    this.socket.on('agent_update', (data) => {
      if (data.agentId === agentId) {
        callback(data);
      }
    });
  }

  subscribeToArbitrage(callback: (opportunity: ArbitrageOpportunity) => void): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.on('arbitrage_opportunity', callback);
  }

  subscribeToPortfolioUpdates(callback: (portfolio: Portfolio) => void): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.on('portfolio_update', callback);
  }

  subscribeToAlerts(callback: (alert: any) => void): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.on('alert', callback);
  }

  executeCommand(command: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit('execute', {
        type: 'execute',
        payload: { command, params }
      });

      this.socket.once('execution_result', (result) => {
        resolve(result.payload);
      });

      setTimeout(() => {
        reject(new Error('Command execution timeout'));
      }, 10000);
    });
  }

  query(queryType: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit('query', {
        type: 'query',
        payload: { queryType, params }
      });

      this.socket.once('query_result', (result) => {
        resolve(result.payload);
      });

      setTimeout(() => {
        reject(new Error('Query timeout'));
      }, 5000);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;