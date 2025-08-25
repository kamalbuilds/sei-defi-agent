import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

// Types
export interface WebSocketConfig {
  url: string;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  timeout: number;
  enableLogging: boolean;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  disconnected: boolean;
  reconnecting: boolean;
  error: Error | null;
}

export interface SubscriptionOptions {
  autoReconnect?: boolean;
  maxRetries?: number;
  onError?: (error: Error) => void;
}

// Enhanced WebSocket Manager
export class EnhancedWebSocketManager extends EventEmitter {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private connectionState: ConnectionState;
  private reconnectAttempts: number = 0;
  private subscriptions: Map<string, SubscriptionOptions> = new Map();
  private messageQueue: Array<{ event: string; data: any }> = [];
  private authToken: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    super();
    this.config = config;
    this.connectionState = {
      connected: false,
      connecting: false,
      disconnected: true,
      reconnecting: false,
      error: null,
    };
    this.setMaxListeners(0); // Remove default limit
  }

  // Connection Management
  async connect(token?: string): Promise<void> {
    if (this.socket?.connected) {
      this.log('Already connected');
      return;
    }

    if (this.connectionState.connecting) {
      this.log('Connection already in progress');
      return;
    }

    this.authToken = token || this.authToken;
    this.updateConnectionState({ connecting: true, disconnected: false });

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.url, {
          transports: ['websocket', 'polling'],
          timeout: this.config.timeout,
          forceNew: true,
          auth: this.authToken ? { token: this.authToken } : undefined,
          query: {
            clientId: this.generateClientId(),
            userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'node',
          },
        });

        this.setupEventHandlers();
        
        this.socket.on('connect', () => {
          this.log('Connected successfully');
          this.reconnectAttempts = 0;
          this.updateConnectionState({
            connected: true,
            connecting: false,
            disconnected: false,
            reconnecting: false,
            error: null,
          });
          this.processMessageQueue();
          this.startHeartbeat();
          this.emit('connect');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          this.log('Connection error:', error.message);
          this.updateConnectionState({
            connected: false,
            connecting: false,
            disconnected: true,
            error,
          });
          this.emit('connect_error', error);
          reject(error);
        });

        // Set connection timeout
        setTimeout(() => {
          if (this.connectionState.connecting) {
            const timeoutError = new Error('Connection timeout');
            this.updateConnectionState({
              connecting: false,
              disconnected: true,
              error: timeoutError,
            });
            reject(timeoutError);
          }
        }, this.config.timeout);

      } catch (error) {
        this.updateConnectionState({
          connecting: false,
          disconnected: true,
          error: error as Error,
        });
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.log('Disconnecting...');
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.updateConnectionState({
      connected: false,
      connecting: false,
      disconnected: true,
      reconnecting: false,
      error: null,
    });

    this.subscriptions.clear();
    this.messageQueue = [];
    this.emit('disconnect', 'manual');
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', (reason) => {
      this.log('Disconnected:', reason);
      this.stopHeartbeat();
      this.updateConnectionState({
        connected: false,
        disconnected: true,
        reconnecting: false,
      });
      this.emit('disconnect', reason);

      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.handleReconnection();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.log(`Reconnected after ${attemptNumber} attempts`);
      this.reconnectAttempts = 0;
      this.updateConnectionState({
        connected: true,
        reconnecting: false,
        error: null,
      });
      this.processMessageQueue();
      this.startHeartbeat();
      this.emit('reconnect', attemptNumber);
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.log(`Reconnection attempt ${attemptNumber}`);
      this.updateConnectionState({ reconnecting: true });
      this.emit('reconnect_attempt', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      this.log('Reconnection error:', error.message);
      this.updateConnectionState({ error });
      this.emit('reconnect_error', error);
    });

    this.socket.on('reconnect_failed', () => {
      this.log('Reconnection failed');
      this.updateConnectionState({
        reconnecting: false,
        disconnected: true,
        error: new Error('Reconnection failed'),
      });
      this.emit('reconnect_failed');
    });

    // Data events
    this.socket.on('agent:status', (data) => this.handleMessage('agent:status', data));
    this.socket.on('portfolio:update', (data) => this.handleMessage('portfolio:update', data));
    this.socket.on('market:update', (data) => this.handleMessage('market:update', data));
    this.socket.on('arbitrage:opportunity', (data) => this.handleMessage('arbitrage:opportunity', data));
    this.socket.on('transaction:update', (data) => this.handleMessage('transaction:update', data));
    this.socket.on('risk:alert', (data) => this.handleMessage('risk:alert', data));
    this.socket.on('notification', (data) => this.handleMessage('notification', data));

    // Heartbeat
    this.socket.on('pong', (latency) => {
      this.emit('pong', latency);
    });

    // Error handling
    this.socket.on('error', (error) => {
      this.log('Socket error:', error);
      this.updateConnectionState({ error });
      this.emit('error', error);
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      this.updateConnectionState({
        reconnecting: false,
        error: new Error('Max reconnection attempts reached'),
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay(this.reconnectAttempts);
    
    this.log(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.connectionState.connected) {
        this.connect();
      }
    }, delay);
  }

  private calculateReconnectDelay(attempt: number): number {
    // Exponential backoff with jitter
    const base = this.config.reconnectDelay;
    const exponential = Math.min(base * Math.pow(2, attempt - 1), 30000);
    const jitter = Math.random() * 0.3 * exponential;
    return Math.floor(exponential + jitter);
  }

  // Message handling
  private handleMessage(event: string, data: any): void {
    try {
      this.emit(event, data);
    } catch (error) {
      this.log('Error handling message:', error);
      this.emit('message_error', { event, data, error });
    }
  }

  // Subscription management
  subscribe(event: string, options: SubscriptionOptions = {}): void {
    this.subscriptions.set(event, options);
    
    if (this.connectionState.connected) {
      this.sendMessage('subscribe', { event, options });
    }
  }

  unsubscribe(event: string): void {
    this.subscriptions.delete(event);
    
    if (this.connectionState.connected) {
      this.sendMessage('unsubscribe', { event });
    }
  }

  // Specialized subscription methods
  subscribeToAgent(agentId: string, options?: SubscriptionOptions): void {
    this.subscribe('agent:subscribe', { ...options, agentId });
    this.sendMessage('agent:subscribe', { agentId });
  }

  unsubscribeFromAgent(agentId: string): void {
    this.sendMessage('agent:unsubscribe', { agentId });
  }

  subscribeToPortfolio(address: string, options?: SubscriptionOptions): void {
    this.subscribe('portfolio:subscribe', { ...options, address });
    this.sendMessage('portfolio:subscribe', { address });
  }

  subscribeToMarketData(pairs: string[], options?: SubscriptionOptions): void {
    this.subscribe('market:subscribe', { ...options, pairs });
    this.sendMessage('market:subscribe', { pairs });
  }

  subscribeToArbitrage(options?: SubscriptionOptions): void {
    this.subscribe('arbitrage:subscribe', options);
    this.sendMessage('arbitrage:subscribe', {});
  }

  subscribeToNotifications(options?: SubscriptionOptions): void {
    this.subscribe('notifications:subscribe', options);
    this.sendMessage('notifications:subscribe', {});
  }

  // Message sending
  sendMessage(event: string, data: any = {}): void {
    if (!this.connectionState.connected) {
      this.queueMessage(event, data);
      return;
    }

    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  private queueMessage(event: string, data: any): void {
    this.messageQueue.push({ event, data });
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.connectionState.connected) {
      const { event, data } = this.messageQueue.shift()!;
      this.sendMessage(event, data);
    }
  }

  // Heartbeat
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState.connected && this.socket) {
        this.socket.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Authentication
  authenticate(token: string): void {
    this.authToken = token;
    if (this.connectionState.connected) {
      this.sendMessage('auth:update', { token });
    }
  }

  // Utility methods
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    this.emit('state_change', this.connectionState);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(...args: any[]): void {
    if (this.config.enableLogging) {
      console.log('[WebSocket]', ...args);
    }
  }

  // Public getters
  get isConnected(): boolean {
    return this.connectionState.connected;
  }

  get isConnecting(): boolean {
    return this.connectionState.connecting;
  }

  get isReconnecting(): boolean {
    return this.connectionState.reconnecting;
  }

  get state(): ConnectionState {
    return { ...this.connectionState };
  }

  get queueSize(): number {
    return this.messageQueue.length;
  }

  get subscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Statistics
  getStats(): any {
    return {
      connected: this.connectionState.connected,
      reconnectAttempts: this.reconnectAttempts,
      queueSize: this.messageQueue.length,
      subscriptions: this.subscriptions.size,
      clientId: this.socket?.id,
    };
  }

  // Cleanup
  destroy(): void {
    this.stopHeartbeat();
    this.disconnect();
    this.removeAllListeners();
  }
}

// Default configuration
const defaultConfig: WebSocketConfig = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  timeout: 20000,
  enableLogging: process.env.NODE_ENV === 'development',
};

// Export singleton instance
export const wsManager = new EnhancedWebSocketManager(defaultConfig);

// Export types
export type { WebSocketConfig, ConnectionState, SubscriptionOptions };
export default wsManager;