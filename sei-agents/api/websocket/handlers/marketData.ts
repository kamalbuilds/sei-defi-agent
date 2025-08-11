import { WebSocket } from 'ws';
import { Logger } from '../../../utils/logger';
import { AuthService } from '../../../core/services/AuthService';
import { MarketDataService } from '../../../core/services/MarketDataService';

const logger = new Logger('MarketDataWebSocketHandler');
const authService = new AuthService();
const marketDataService = new MarketDataService();

export interface MarketDataMessage {
  type: 'price_update' | 'volume_update' | 'market_status' | 'arbitrage_opportunity';
  symbol?: string;
  data: any;
  timestamp: string;
}

export interface MarketWebSocketClient {
  ws: WebSocket;
  userId: string;
  subscriptions: {
    symbols: Set<string>;
    arbitrage: boolean;
    marketStatus: boolean;
  };
  authenticated: boolean;
  lastPing: Date;
  permissions: string[];
}

class MarketDataWebSocketHandler {
  private clients: Map<string, MarketWebSocketClient> = new Map();
  private symbolSubscriptions: Map<string, Set<string>> = new Map(); // symbol -> clientIds
  private arbitrageSubscribers: Set<string> = new Set(); // clientIds subscribed to arbitrage
  private marketStatusSubscribers: Set<string> = new Set(); // clientIds subscribed to market status

  constructor() {
    // Cleanup disconnected clients every 30 seconds
    setInterval(() => {
      this.cleanupDisconnectedClients();
    }, 30000);

    // Send ping to all clients every 25 seconds
    setInterval(() => {
      this.pingClients();
    }, 25000);

    // Initialize market data streams
    this.initializeMarketDataStreams();
  }

  async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const clientId = this.generateClientId();
    
    const client: MarketWebSocketClient = {
      ws,
      userId: '',
      subscriptions: {
        symbols: new Set(),
        arbitrage: false,
        marketStatus: false
      },
      authenticated: false,
      lastPing: new Date(),
      permissions: []
    };

    this.clients.set(clientId, client);

    logger.info('New market data WebSocket connection', { clientId });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(clientId, message);
      } catch (error) {
        logger.error('Failed to parse market data WebSocket message', { 
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
      logger.error('Market data WebSocket error', { error: (error as any).message, clientId });
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
      availableFeatures: ['price_updates', 'volume_updates', 'market_status', 'arbitrage_opportunities'],
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

        case 'subscribe_symbol':
          await this.handleSymbolSubscription(clientId, message);
          break;

        case 'unsubscribe_symbol':
          await this.handleSymbolUnsubscription(clientId, message);
          break;

        case 'subscribe_arbitrage':
          await this.handleArbitrageSubscription(clientId);
          break;

        case 'unsubscribe_arbitrage':
          await this.handleArbitrageUnsubscription(clientId);
          break;

        case 'subscribe_market_status':
          await this.handleMarketStatusSubscription(clientId);
          break;

        case 'unsubscribe_market_status':
          await this.handleMarketStatusUnsubscription(clientId);
          break;

        case 'get_current_price':
          await this.handleCurrentPriceRequest(clientId, message);
          break;

        case 'get_market_overview':
          await this.handleMarketOverviewRequest(clientId);
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
      logger.error('Error handling market data WebSocket message', { 
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
      client.permissions = user.permissions || [];

      this.sendMessage(clientId, {
        type: 'authenticated',
        userId: user.id,
        permissions: client.permissions,
        timestamp: new Date().toISOString()
      });

      logger.info('Market data WebSocket client authenticated', { 
        clientId, 
        userId: user.id,
        permissions: client.permissions.length
      });
    } catch (error) {
      logger.error('Market data authentication failed', { error: (error as any).message, clientId });
      this.sendError(clientId, 'Authentication failed');
    }
  }

  private async handleSymbolSubscription(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { symbols } = message;
    if (!symbols || !Array.isArray(symbols)) {
      this.sendError(clientId, 'Symbols array required');
      return;
    }

    // Limit number of symbols per client
    const maxSymbols = client.permissions.includes('UNLIMITED_SUBSCRIPTIONS') ? 1000 : 50;
    if (client.subscriptions.symbols.size + symbols.length > maxSymbols) {
      this.sendError(clientId, `Maximum ${maxSymbols} symbols allowed per client`);
      return;
    }

    const subscribedSymbols: string[] = [];

    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase();
      
      // Add to client subscriptions
      client.subscriptions.symbols.add(normalizedSymbol);
      
      // Add to global symbol subscriptions
      if (!this.symbolSubscriptions.has(normalizedSymbol)) {
        this.symbolSubscriptions.set(normalizedSymbol, new Set());
      }
      this.symbolSubscriptions.get(normalizedSymbol)!.add(clientId);
      
      subscribedSymbols.push(normalizedSymbol);
    }

    this.sendMessage(clientId, {
      type: 'subscribed_symbols',
      symbols: subscribedSymbols,
      timestamp: new Date().toISOString()
    });

    // Send current prices for subscribed symbols
    try {
      const currentData = await marketDataService.getMultipleSymbols(subscribedSymbols);
      for (const data of currentData) {
        this.sendMessage(clientId, {
          type: 'price_update',
          symbol: data.symbol,
          data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to fetch current prices for new subscriptions', {
        error: (error as any).message,
        symbols: subscribedSymbols,
        clientId
      });
    }

    logger.info('Client subscribed to symbols', { 
      clientId, 
      symbols: subscribedSymbols,
      totalSubscriptions: client.subscriptions.symbols.size
    });
  }

  private async handleSymbolUnsubscription(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { symbols } = message;
    if (!symbols || !Array.isArray(symbols)) {
      this.sendError(clientId, 'Symbols array required');
      return;
    }

    const unsubscribedSymbols: string[] = [];

    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase();
      
      // Remove from client subscriptions
      if (client.subscriptions.symbols.has(normalizedSymbol)) {
        client.subscriptions.symbols.delete(normalizedSymbol);
        unsubscribedSymbols.push(normalizedSymbol);
      }
      
      // Remove from global symbol subscriptions
      const symbolClients = this.symbolSubscriptions.get(normalizedSymbol);
      if (symbolClients) {
        symbolClients.delete(clientId);
        if (symbolClients.size === 0) {
          this.symbolSubscriptions.delete(normalizedSymbol);
        }
      }
    }

    this.sendMessage(clientId, {
      type: 'unsubscribed_symbols',
      symbols: unsubscribedSymbols,
      timestamp: new Date().toISOString()
    });

    logger.info('Client unsubscribed from symbols', { 
      clientId, 
      symbols: unsubscribedSymbols 
    });
  }

  private async handleArbitrageSubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    // Check permissions for arbitrage data
    if (!client.permissions.includes('VIEW_ARBITRAGE')) {
      this.sendError(clientId, 'Arbitrage viewing permission required');
      return;
    }

    client.subscriptions.arbitrage = true;
    this.arbitrageSubscribers.add(clientId);

    this.sendMessage(clientId, {
      type: 'subscribed_arbitrage',
      timestamp: new Date().toISOString()
    });

    logger.info('Client subscribed to arbitrage opportunities', { clientId });
  }

  private async handleArbitrageUnsubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.arbitrage = false;
    this.arbitrageSubscribers.delete(clientId);

    this.sendMessage(clientId, {
      type: 'unsubscribed_arbitrage',
      timestamp: new Date().toISOString()
    });

    logger.info('Client unsubscribed from arbitrage opportunities', { clientId });
  }

  private async handleMarketStatusSubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    client.subscriptions.marketStatus = true;
    this.marketStatusSubscribers.add(clientId);

    this.sendMessage(clientId, {
      type: 'subscribed_market_status',
      timestamp: new Date().toISOString()
    });

    // Send current market status
    const status = await marketDataService.getMarketStatus();
    this.sendMessage(clientId, {
      type: 'market_status',
      data: status,
      timestamp: new Date().toISOString()
    });

    logger.info('Client subscribed to market status', { clientId });
  }

  private async handleMarketStatusUnsubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.marketStatus = false;
    this.marketStatusSubscribers.delete(clientId);

    this.sendMessage(clientId, {
      type: 'unsubscribed_market_status',
      timestamp: new Date().toISOString()
    });

    logger.info('Client unsubscribed from market status', { clientId });
  }

  private async handleCurrentPriceRequest(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { symbol } = message;
    if (!symbol) {
      this.sendError(clientId, 'Symbol required');
      return;
    }

    try {
      const data = await marketDataService.getCurrentPrice(symbol.toUpperCase());
      this.sendMessage(clientId, {
        type: 'current_price',
        symbol: symbol.toUpperCase(),
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.sendError(clientId, `Failed to fetch price for ${symbol}: ${(error as any).message}`);
    }
  }

  private async handleMarketOverviewRequest(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    try {
      const overview = await marketDataService.getMarketOverview();
      this.sendMessage(clientId, {
        type: 'market_overview',
        data: overview,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.sendError(clientId, `Failed to fetch market overview: ${(error as any).message}`);
    }
  }

  // Public methods for broadcasting market data
  public broadcastPriceUpdate(symbol: string, data: any): void {
    const message: MarketDataMessage = {
      type: 'price_update',
      symbol,
      data,
      timestamp: new Date().toISOString()
    };

    this.broadcastToSymbolSubscribers(symbol, message);
  }

  public broadcastVolumeUpdate(symbol: string, data: any): void {
    const message: MarketDataMessage = {
      type: 'volume_update',
      symbol,
      data,
      timestamp: new Date().toISOString()
    };

    this.broadcastToSymbolSubscribers(symbol, message);
  }

  public broadcastMarketStatus(status: any): void {
    const message: MarketDataMessage = {
      type: 'market_status',
      data: status,
      timestamp: new Date().toISOString()
    };

    this.broadcastToMarketStatusSubscribers(message);
  }

  public broadcastArbitrageOpportunity(opportunity: any): void {
    const message: MarketDataMessage = {
      type: 'arbitrage_opportunity',
      data: opportunity,
      timestamp: new Date().toISOString()
    };

    this.broadcastToArbitrageSubscribers(message);
  }

  private broadcastToSymbolSubscribers(symbol: string, message: any): void {
    const subscribers = this.symbolSubscriptions.get(symbol);
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
        logger.error('Failed to send price update to client', { 
          error: (error as any).message, 
          clientId, 
          symbol 
        });
        disconnectedClients.push(clientId);
      }
    }

    // Cleanup disconnected clients
    for (const clientId of disconnectedClients) {
      subscribers.delete(clientId);
    }
  }

  private broadcastToArbitrageSubscribers(message: any): void {
    this.broadcastToSubscriberSet(this.arbitrageSubscribers, message, 'arbitrage');
  }

  private broadcastToMarketStatusSubscribers(message: any): void {
    this.broadcastToSubscriberSet(this.marketStatusSubscribers, message, 'market_status');
  }

  private broadcastToSubscriberSet(subscribers: Set<string>, message: any, type: string): void {
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
        logger.error(`Failed to send ${type} update to client`, { 
          error: (error as any).message, 
          clientId 
        });
        disconnectedClients.push(clientId);
      }
    }

    // Cleanup disconnected clients
    for (const clientId of disconnectedClients) {
      subscribers.delete(clientId);
    }
  }

  private initializeMarketDataStreams(): void {
    // Initialize price data streams
    marketDataService.onPriceUpdate((symbol: string, data: any) => {
      this.broadcastPriceUpdate(symbol, data);
    });

    marketDataService.onVolumeUpdate((symbol: string, data: any) => {
      this.broadcastVolumeUpdate(symbol, data);
    });

    marketDataService.onMarketStatusChange((status: any) => {
      this.broadcastMarketStatus(status);
    });

    marketDataService.onArbitrageOpportunity((opportunity: any) => {
      this.broadcastArbitrageOpportunity(opportunity);
    });
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

    // Remove from symbol subscriptions
    for (const symbol of client.subscriptions.symbols) {
      const symbolClients = this.symbolSubscriptions.get(symbol);
      if (symbolClients) {
        symbolClients.delete(clientId);
        if (symbolClients.size === 0) {
          this.symbolSubscriptions.delete(symbol);
        }
      }
    }

    // Remove from other subscriptions
    this.arbitrageSubscribers.delete(clientId);
    this.marketStatusSubscribers.delete(clientId);

    this.clients.delete(clientId);

    logger.info('Market data WebSocket client disconnected', { 
      clientId, 
      userId: client.userId,
      symbolSubscriptions: client.subscriptions.symbols.size,
      arbitrageSubscribed: client.subscriptions.arbitrage,
      marketStatusSubscribed: client.subscriptions.marketStatus
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
      logger.info('Cleaned up disconnected market data clients', { count: disconnectedClients.length });
    }
  }

  private pingClients(): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          logger.error('Failed to ping market data client', { error: (error as any).message, clientId });
        }
      }
    }
  }

  private generateClientId(): string {
    return `market_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      symbolSubscriptions: this.symbolSubscriptions.size,
      arbitrageSubscribers: this.arbitrageSubscribers.size,
      marketStatusSubscribers: this.marketStatusSubscribers.size,
      totalSymbolSubscriptions: Array.from(this.clients.values()).reduce((sum, c) => sum + c.subscriptions.symbols.size, 0)
    };
  }
}

export const marketDataWebSocketHandler = new MarketDataWebSocketHandler();