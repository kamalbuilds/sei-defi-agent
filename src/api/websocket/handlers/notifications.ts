import { WebSocket } from 'ws';
import { Logger } from '../../../utils/logger';
import { AuthService } from '../../../core/services/AuthService';
import { NotificationService } from '../../../core/services/NotificationService';

const logger = new Logger('NotificationWebSocketHandler');
const authService = new AuthService();
const notificationService = new NotificationService();

export interface NotificationMessage {
  type: 'notification' | 'system_alert' | 'notification_read' | 'notification_deleted';
  data: any;
  timestamp: string;
}

export interface NotificationWebSocketClient {
  ws: WebSocket;
  userId: string;
  subscriptions: {
    notifications: boolean;
    systemAlerts: boolean;
  };
  authenticated: boolean;
  lastPing: Date;
  permissions: string[];
  preferences: {
    types: string[];
    priority: string[];
  };
}

class NotificationWebSocketHandler {
  private clients: Map<string, NotificationWebSocketClient> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map(); // userId -> clientIds
  private systemAlertSubscribers: Set<string> = new Set(); // clientIds subscribed to system alerts

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
    
    const client: NotificationWebSocketClient = {
      ws,
      userId: '',
      subscriptions: {
        notifications: false,
        systemAlerts: false
      },
      authenticated: false,
      lastPing: new Date(),
      permissions: [],
      preferences: {
        types: ['TRADE_EXECUTED', 'PORTFOLIO_REBALANCED', 'AGENT_STATUS_CHANGED', 'PAYMENT_PROCESSED'],
        priority: ['high', 'critical']
      }
    };

    this.clients.set(clientId, client);

    logger.info('New notification WebSocket connection', { clientId });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(clientId, message);
      } catch (error) {
        logger.error('Failed to parse notification WebSocket message', { 
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
      logger.error('Notification WebSocket error', { error: (error as any).message, clientId });
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
      availableTypes: ['TRADE_EXECUTED', 'PORTFOLIO_REBALANCED', 'AGENT_STATUS_CHANGED', 
                       'PAYMENT_PROCESSED', 'SYSTEM_MAINTENANCE', 'PRICE_ALERT'],
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

        case 'subscribe_notifications':
          await this.handleNotificationSubscription(clientId, message);
          break;

        case 'unsubscribe_notifications':
          await this.handleNotificationUnsubscription(clientId);
          break;

        case 'subscribe_system_alerts':
          await this.handleSystemAlertSubscription(clientId);
          break;

        case 'unsubscribe_system_alerts':
          await this.handleSystemAlertUnsubscription(clientId);
          break;

        case 'mark_as_read':
          await this.handleMarkAsRead(clientId, message);
          break;

        case 'mark_all_as_read':
          await this.handleMarkAllAsRead(clientId);
          break;

        case 'delete_notification':
          await this.handleDeleteNotification(clientId, message);
          break;

        case 'update_preferences':
          await this.handleUpdatePreferences(clientId, message);
          break;

        case 'get_unread_count':
          await this.handleUnreadCountRequest(clientId);
          break;

        case 'get_recent_notifications':
          await this.handleRecentNotificationsRequest(clientId, message);
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
      logger.error('Error handling notification WebSocket message', { 
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

      // Load user notification preferences
      const preferences = await notificationService.getUserPreferences(user.id);
      if (preferences) {
        client.preferences = preferences;
      }

      this.sendMessage(clientId, {
        type: 'authenticated',
        userId: user.id,
        permissions: client.permissions,
        preferences: client.preferences,
        timestamp: new Date().toISOString()
      });

      logger.info('Notification WebSocket client authenticated', { 
        clientId, 
        userId: user.id,
        permissions: client.permissions.length
      });
    } catch (error) {
      logger.error('Notification authentication failed', { error: (error as any).message, clientId });
      this.sendError(clientId, 'Authentication failed');
    }
  }

  private async handleNotificationSubscription(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { preferences } = message;
    if (preferences) {
      client.preferences = { ...client.preferences, ...preferences };
      await notificationService.updateUserPreferences(client.userId, client.preferences);
    }

    client.subscriptions.notifications = true;
    
    // Add to user subscriptions map
    if (!this.userSubscriptions.has(client.userId)) {
      this.userSubscriptions.set(client.userId, new Set());
    }
    this.userSubscriptions.get(client.userId)!.add(clientId);

    this.sendMessage(clientId, {
      type: 'subscribed_notifications',
      preferences: client.preferences,
      timestamp: new Date().toISOString()
    });

    // Send unread count
    const unreadCount = await notificationService.getUnreadCount(client.userId);
    this.sendMessage(clientId, {
      type: 'unread_count',
      count: unreadCount,
      timestamp: new Date().toISOString()
    });

    logger.info('Client subscribed to notifications', { 
      clientId, 
      userId: client.userId,
      preferences: client.preferences
    });
  }

  private async handleNotificationUnsubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.notifications = false;
    
    // Remove from user subscriptions
    const userClients = this.userSubscriptions.get(client.userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        this.userSubscriptions.delete(client.userId);
      }
    }

    this.sendMessage(clientId, {
      type: 'unsubscribed_notifications',
      timestamp: new Date().toISOString()
    });

    logger.info('Client unsubscribed from notifications', { clientId, userId: client.userId });
  }

  private async handleSystemAlertSubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    // Check permissions for system alerts
    if (!client.permissions.includes('VIEW_SYSTEM_ALERTS') && client.permissions.includes('admin') === false) {
      this.sendError(clientId, 'System alert viewing permission required');
      return;
    }

    client.subscriptions.systemAlerts = true;
    this.systemAlertSubscribers.add(clientId);

    this.sendMessage(clientId, {
      type: 'subscribed_system_alerts',
      timestamp: new Date().toISOString()
    });

    logger.info('Client subscribed to system alerts', { clientId, userId: client.userId });
  }

  private async handleSystemAlertUnsubscription(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.systemAlerts = false;
    this.systemAlertSubscribers.delete(clientId);

    this.sendMessage(clientId, {
      type: 'unsubscribed_system_alerts',
      timestamp: new Date().toISOString()
    });

    logger.info('Client unsubscribed from system alerts', { clientId, userId: client.userId });
  }

  private async handleMarkAsRead(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { notificationId } = message;
    if (!notificationId) {
      this.sendError(clientId, 'Notification ID required');
      return;
    }

    try {
      await notificationService.markAsRead(notificationId, client.userId);
      
      this.sendMessage(clientId, {
        type: 'notification_marked_read',
        notificationId,
        timestamp: new Date().toISOString()
      });

      // Send updated unread count
      const unreadCount = await notificationService.getUnreadCount(client.userId);
      this.sendMessage(clientId, {
        type: 'unread_count',
        count: unreadCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendError(clientId, `Failed to mark notification as read: ${(error as any).message}`);
    }
  }

  private async handleMarkAllAsRead(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    try {
      await notificationService.markAllAsRead(client.userId);
      
      this.sendMessage(clientId, {
        type: 'all_notifications_marked_read',
        timestamp: new Date().toISOString()
      });

      // Send updated unread count
      this.sendMessage(clientId, {
        type: 'unread_count',
        count: 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendError(clientId, `Failed to mark all notifications as read: ${(error as any).message}`);
    }
  }

  private async handleDeleteNotification(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { notificationId } = message;
    if (!notificationId) {
      this.sendError(clientId, 'Notification ID required');
      return;
    }

    try {
      await notificationService.deleteNotification(notificationId, client.userId);
      
      this.sendMessage(clientId, {
        type: 'notification_deleted',
        notificationId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendError(clientId, `Failed to delete notification: ${(error as any).message}`);
    }
  }

  private async handleUpdatePreferences(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { preferences } = message;
    if (!preferences) {
      this.sendError(clientId, 'Preferences required');
      return;
    }

    try {
      client.preferences = { ...client.preferences, ...preferences };
      await notificationService.updateUserPreferences(client.userId, client.preferences);
      
      this.sendMessage(clientId, {
        type: 'preferences_updated',
        preferences: client.preferences,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendError(clientId, `Failed to update preferences: ${(error as any).message}`);
    }
  }

  private async handleUnreadCountRequest(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    try {
      const unreadCount = await notificationService.getUnreadCount(client.userId);
      this.sendMessage(clientId, {
        type: 'unread_count',
        count: unreadCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.sendError(clientId, `Failed to get unread count: ${(error as any).message}`);
    }
  }

  private async handleRecentNotificationsRequest(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { limit = 20, offset = 0 } = message;

    try {
      const notifications = await notificationService.getRecentNotifications(
        client.userId, 
        { limit, offset }
      );
      
      this.sendMessage(clientId, {
        type: 'recent_notifications',
        notifications,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.sendError(clientId, `Failed to get recent notifications: ${(error as any).message}`);
    }
  }

  // Public methods for broadcasting notifications
  public broadcastNotification(userId: string, notification: any): void {
    const message: NotificationMessage = {
      type: 'notification',
      data: notification,
      timestamp: new Date().toISOString()
    };

    this.broadcastToUser(userId, message);
  }

  public broadcastSystemAlert(alert: any): void {
    const message: NotificationMessage = {
      type: 'system_alert',
      data: alert,
      timestamp: new Date().toISOString()
    };

    this.broadcastToSystemAlertSubscribers(message);
  }

  public broadcastNotificationRead(userId: string, notificationId: string): void {
    const message: NotificationMessage = {
      type: 'notification_read',
      data: { notificationId },
      timestamp: new Date().toISOString()
    };

    this.broadcastToUser(userId, message);
  }

  public broadcastNotificationDeleted(userId: string, notificationId: string): void {
    const message: NotificationMessage = {
      type: 'notification_deleted',
      data: { notificationId },
      timestamp: new Date().toISOString()
    };

    this.broadcastToUser(userId, message);
  }

  private broadcastToUser(userId: string, message: any): void {
    const userClients = this.userSubscriptions.get(userId);
    if (!userClients) return;

    const disconnectedClients: string[] = [];

    for (const clientId of userClients) {
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN || !client.subscriptions.notifications) {
        disconnectedClients.push(clientId);
        continue;
      }

      // Check if notification matches user preferences
      if (message.type === 'notification' && !this.matchesPreferences(client, message.data)) {
        continue;
      }

      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send notification to client', { 
          error: (error as any).message, 
          clientId, 
          userId 
        });
        disconnectedClients.push(clientId);
      }
    }

    // Cleanup disconnected clients
    for (const clientId of disconnectedClients) {
      userClients.delete(clientId);
    }
  }

  private broadcastToSystemAlertSubscribers(message: any): void {
    const disconnectedClients: string[] = [];

    for (const clientId of this.systemAlertSubscribers) {
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN) {
        disconnectedClients.push(clientId);
        continue;
      }

      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send system alert to client', { 
          error: (error as any).message, 
          clientId 
        });
        disconnectedClients.push(clientId);
      }
    }

    // Cleanup disconnected clients
    for (const clientId of disconnectedClients) {
      this.systemAlertSubscribers.delete(clientId);
    }
  }

  private matchesPreferences(client: NotificationWebSocketClient, notification: any): boolean {
    // Check notification type preferences
    if (client.preferences.types.length > 0 && 
        !client.preferences.types.includes(notification.type)) {
      return false;
    }

    // Check priority preferences
    if (client.preferences.priority.length > 0 && 
        notification.priority && 
        !client.preferences.priority.includes(notification.priority)) {
      return false;
    }

    return true;
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

    // Remove from user subscriptions
    if (client.userId) {
      const userClients = this.userSubscriptions.get(client.userId);
      if (userClients) {
        userClients.delete(clientId);
        if (userClients.size === 0) {
          this.userSubscriptions.delete(client.userId);
        }
      }
    }

    // Remove from system alert subscriptions
    this.systemAlertSubscribers.delete(clientId);

    this.clients.delete(clientId);

    logger.info('Notification WebSocket client disconnected', { 
      clientId, 
      userId: client.userId,
      notificationSubscribed: client.subscriptions.notifications,
      systemAlertsSubscribed: client.subscriptions.systemAlerts
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
      logger.info('Cleaned up disconnected notification clients', { count: disconnectedClients.length });
    }
  }

  private pingClients(): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          logger.error('Failed to ping notification client', { error: (error as any).message, clientId });
        }
      }
    }
  }

  private generateClientId(): string {
    return `notification_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      notificationSubscribers: Array.from(this.clients.values()).filter(c => c.subscriptions.notifications).length,
      systemAlertSubscribers: this.systemAlertSubscribers.size,
      uniqueUsers: this.userSubscriptions.size
    };
  }
}

export const notificationWebSocketHandler = new NotificationWebSocketHandler();