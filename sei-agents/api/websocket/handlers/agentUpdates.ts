import { WebSocket } from 'ws';
import { Logger } from '../../../utils/logger';
import { AuthService } from '../../../core/services/AuthService';
import { AgentService } from '../../../core/services/AgentService';

const logger = new Logger('AgentWebSocketHandler');
const authService = new AuthService();
const agentService = new AgentService();

export interface AgentUpdateMessage {
  type: 'agent_update' | 'agent_performance' | 'agent_status' | 'agent_error';
  agentId: string;
  data: any;
  timestamp: string;
}

export interface WebSocketClient {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
  authenticated: boolean;
  lastPing: Date;
}

class AgentWebSocketHandler {
  private clients: Map<string, WebSocketClient> = new Map();
  private agentSubscriptions: Map<string, Set<string>> = new Map(); // agentId -> clientIds

  constructor() {
    // Cleanup disconnected clients every 30 seconds
    setInterval(() => {
      this.cleanupDisconnectedClients();
    }, 30000);

    // Send ping to all clients every 25 seconds
    setInterval(() => {
      this.pingClients();
    }, 25000);
  }

  async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const clientId = this.generateClientId();
    
    const client: WebSocketClient = {
      ws,
      userId: '',
      subscriptions: new Set(),
      authenticated: false,
      lastPing: new Date()
    };

    this.clients.set(clientId, client);

    logger.info('New WebSocket connection', { clientId });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(clientId, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { 
          error: (error as any).message, 
          clientId 
        });
        this.sendError(clientId, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { error: (error as any).message, clientId });
      this.handleDisconnection(clientId);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = new Date();
      }
    });

    // Send welcome message
    this.sendMessage(clientId, {
      type: 'connection_established',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  private async handleMessage(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      switch (message.type) {
        case 'authenticate':
          await this.handleAuthentication(clientId, message);
          break;

        case 'subscribe_agent':
          await this.handleAgentSubscription(clientId, message);
          break;

        case 'unsubscribe_agent':
          await this.handleAgentUnsubscription(clientId, message);
          break;

        case 'subscribe_all_agents':
          await this.handleAllAgentsSubscription(clientId);
          break;

        case 'get_agent_status':
          await this.handleAgentStatusRequest(clientId, message);
          break;

        case 'ping':
          this.sendMessage(clientId, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;

        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', { 
        error: (error as any).message, 
        messageType: message.type, 
        clientId 
      });
      this.sendError(clientId, 'Failed to process message');
    }
  }

  private async handleAuthentication(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const { token } = message;
      if (!token) {
        this.sendError(clientId, 'Authentication token required');
        return;
      }

      const user = await authService.verifyToken(token);
      if (!user) {
        this.sendError(clientId, 'Invalid authentication token');
        return;
      }

      client.userId = user.id;
      client.authenticated = true;

      this.sendMessage(clientId, {
        type: 'authenticated',
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      logger.info('WebSocket client authenticated', { clientId, userId: user.id });
    } catch (error) {
      logger.error('Authentication failed', { error: (error as any).message, clientId });
      this.sendError(clientId, 'Authentication failed');
    }
  }

  private async handleAgentSubscription(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { agentId } = message;
    if (!agentId) {
      this.sendError(clientId, 'Agent ID required');
      return;
    }

    // Verify user has access to this agent
    const agent = await agentService.findById(agentId);
    if (!agent) {
      this.sendError(clientId, 'Agent not found');
      return;
    }

    if (agent.userId !== client.userId && !await this.isAdmin(client.userId)) {
      this.sendError(clientId, 'Access denied to this agent');
      return;
    }

    // Add subscription
    client.subscriptions.add(agentId);
    
    if (!this.agentSubscriptions.has(agentId)) {
      this.agentSubscriptions.set(agentId, new Set());
    }
    this.agentSubscriptions.get(agentId)!.add(clientId);

    this.sendMessage(clientId, {
      type: 'subscribed',
      agentId,
      timestamp: new Date().toISOString()
    });

    // Send current agent status
    const status = await agentService.getStatus(agentId);
    this.sendMessage(clientId, {
      type: 'agent_status',
      agentId,
      data: status,
      timestamp: new Date().toISOString()
    });

    logger.info('Client subscribed to agent', { clientId, agentId, userId: client.userId });
  }

  private async handleAgentUnsubscription(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { agentId } = message;
    if (!agentId) {
      this.sendError(clientId, 'Agent ID required');
      return;
    }

    client.subscriptions.delete(agentId);
    
    const agentClients = this.agentSubscriptions.get(agentId);
    if (agentClients) {
      agentClients.delete(clientId);
      if (agentClients.size === 0) {
        this.agentSubscriptions.delete(agentId);
      }
    }

    this.sendMessage(clientId, {
      type: 'unsubscribed',
      agentId,
      timestamp: new Date().toISOString()
    });

    logger.info('Client unsubscribed from agent', { clientId, agentId });
  }

  private async handleAllAgentsSubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    // Get all user's agents
    const agents = await agentService.findByUserId(client.userId);
    
    for (const agent of agents) {
      client.subscriptions.add(agent.id);
      
      if (!this.agentSubscriptions.has(agent.id)) {
        this.agentSubscriptions.set(agent.id, new Set());
      }
      this.agentSubscriptions.get(agent.id)!.add(clientId);
    }

    this.sendMessage(clientId, {
      type: 'subscribed_all',
      agentCount: agents.length,
      timestamp: new Date().toISOString()
    });

    logger.info('Client subscribed to all agents', { 
      clientId, 
      agentCount: agents.length,
      userId: client.userId 
    });
  }

  private async handleAgentStatusRequest(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { agentId } = message;
    if (!agentId) {
      this.sendError(clientId, 'Agent ID required');
      return;
    }

    // Verify access
    const agent = await agentService.findById(agentId);
    if (!agent || (agent.userId !== client.userId && !await this.isAdmin(client.userId))) {
      this.sendError(clientId, 'Agent not found or access denied');
      return;
    }

    const status = await agentService.getStatus(agentId);
    this.sendMessage(clientId, {
      type: 'agent_status',
      agentId,
      data: status,
      timestamp: new Date().toISOString()
    });
  }

  // Public methods for broadcasting updates
  public broadcastAgentUpdate(agentId: string, data: any): void {
    const message: AgentUpdateMessage = {
      type: 'agent_update',
      agentId,
      data,
      timestamp: new Date().toISOString()
    };

    this.broadcastToAgentSubscribers(agentId, message);
  }

  public broadcastAgentPerformance(agentId: string, performance: any): void {
    const message: AgentUpdateMessage = {
      type: 'agent_performance',
      agentId,
      data: performance,
      timestamp: new Date().toISOString()
    };

    this.broadcastToAgentSubscribers(agentId, message);
  }

  public broadcastAgentStatus(agentId: string, status: any): void {
    const message: AgentUpdateMessage = {
      type: 'agent_status',
      agentId,
      data: status,
      timestamp: new Date().toISOString()
    };

    this.broadcastToAgentSubscribers(agentId, message);
  }

  public broadcastAgentError(agentId: string, error: any): void {
    const message: AgentUpdateMessage = {
      type: 'agent_error',
      agentId,
      data: { error: (error as any).message, code: error.code },
      timestamp: new Date().toISOString()
    };

    this.broadcastToAgentSubscribers(agentId, message);
  }

  private broadcastToAgentSubscribers(agentId: string, message: any): void {
    const subscribers = this.agentSubscriptions.get(agentId);
    if (!subscribers) return;

    const disconnectedClients: string[] = [];

    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN) {
        disconnectedClients.push(clientId);
        continue;
      }

      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send message to client', { 
          error: (error as any).message, 
          clientId, 
          agentId 
        });
        disconnectedClients.push(clientId);
      }
    }

    // Cleanup disconnected clients
    for (const clientId of disconnectedClients) {
      subscribers.delete(clientId);
    }
  }

  private sendMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send message', { error: (error as any).message, clientId });
    }
  }

  private sendError(clientId: string, error: string): void {
    this.sendMessage(clientId, {
      type: 'error',
      error,
      timestamp: new Date().toISOString()
    });
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all agent subscriptions
    for (const agentId of client.subscriptions) {
      const agentClients = this.agentSubscriptions.get(agentId);
      if (agentClients) {
        agentClients.delete(clientId);
        if (agentClients.size === 0) {
          this.agentSubscriptions.delete(agentId);
        }
      }
    }

    this.clients.delete(clientId);

    logger.info('WebSocket client disconnected', { 
      clientId, 
      userId: client.userId,
      subscriptions: client.subscriptions.size 
    });
  }

  private cleanupDisconnectedClients(): void {
    const disconnectedClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.CLOSED || 
          client.ws.readyState === WebSocket.CLOSING ||
          new Date().getTime() - client.lastPing.getTime() > 60000) { // 60 second timeout
        disconnectedClients.push(clientId);
      }
    }

    for (const clientId of disconnectedClients) {
      this.handleDisconnection(clientId);
    }

    if (disconnectedClients.length > 0) {
      logger.info('Cleaned up disconnected clients', { count: disconnectedClients.length });
    }
  }

  private pingClients(): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          logger.error('Failed to ping client', { error: (error as any).message, clientId });
        }
      }
    }
  }

  private generateClientId(): string {
    return `agent_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async isAdmin(userId: string): Promise<boolean> {
    try {
      const user = await authService.getUserById(userId);
      return user?.role === 'admin';
    } catch {
      return false;
    }
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      totalAgentSubscriptions: this.agentSubscriptions.size,
      totalSubscriptions: Array.from(this.clients.values()).reduce((sum, c) => sum + c.subscriptions.size, 0)
    };
  }
}

export const agentWebSocketHandler = new AgentWebSocketHandler();