import { withFilter } from 'graphql-subscriptions';
import { PubSub } from './pubsub';
import { GraphQLContext, requireAuth } from './context';

export class SubscriptionManager {
  private pubsub: PubSub;

  constructor(pubsub: PubSub) {
    this.pubsub = pubsub;
  }

  // Agent subscriptions
  subscribeToAgentUpdates(context: GraphQLContext, agentId?: string) {
    const user = requireAuth(context);
    
    return withFilter(
      () => this.pubsub.asyncIterator(['AGENT_UPDATES']),
      (payload, variables) => {
        // Filter by agentId if provided
        if (agentId && payload.agentUpdates.id !== agentId) {
          return false;
        }
        
        // Users can only see their own agents
        return payload.userId === user.id || user.role === 'admin';
      }
    );
  }

  subscribeToAgentPerformance(context: GraphQLContext, agentId: string) {
    const user = requireAuth(context);
    
    return withFilter(
      () => this.pubsub.asyncIterator(['AGENT_PERFORMANCE']),
      async (payload) => {
        if (payload.agentId !== agentId) {
          return false;
        }
        
        // Verify ownership
        // This would typically check the database
        return payload.userId === user.id || user.role === 'admin';
      }
    );
  }

  // Portfolio subscriptions
  subscribeToPortfolioUpdates(context: GraphQLContext, portfolioId: string) {
    const user = requireAuth(context);
    
    return withFilter(
      () => this.pubsub.asyncIterator(['PORTFOLIO_UPDATES']),
      (payload) => {
        if (payload.portfolioUpdates.id !== portfolioId) {
          return false;
        }
        
        return payload.userId === user.id || user.role === 'admin';
      }
    );
  }

  subscribeToPortfolioValue(context: GraphQLContext, portfolioId: string) {
    const user = requireAuth(context);
    
    return withFilter(
      () => this.pubsub.asyncIterator(['PORTFOLIO_VALUE']),
      (payload) => {
        if (payload.portfolioId !== portfolioId) {
          return false;
        }
        
        return payload.userId === user.id || user.role === 'admin';
      }
    );
  }

  // Market data subscriptions
  subscribeToMarketData(context: GraphQLContext, symbols: string[]) {
    requireAuth(context);
    
    // Create iterator for all requested symbols
    const topics = symbols.map(symbol => `MARKET_DATA_${symbol.toUpperCase()}`);
    return this.pubsub.asyncIterator(topics);
  }

  subscribeToArbitrageOpportunities(context: GraphQLContext) {
    requireAuth(context);
    return this.pubsub.asyncIterator(['ARBITRAGE_OPPORTUNITIES']);
  }

  // Notification subscriptions
  subscribeToNotifications(context: GraphQLContext, userId: string) {
    const user = requireAuth(context);
    
    // Users can only subscribe to their own notifications
    if (user.id !== userId && user.role !== 'admin') {
      throw new Error('Access denied: You can only subscribe to your own notifications');
    }
    
    return this.pubsub.asyncIterator([`NOTIFICATIONS_${userId}`]);
  }

  subscribeToSystemAlerts(context: GraphQLContext) {
    const user = requireAuth(context);
    
    // Only admins can subscribe to system alerts
    if (user.role !== 'admin') {
      throw new Error('Access denied: Admin role required for system alerts');
    }
    
    return this.pubsub.asyncIterator(['SYSTEM_ALERTS']);
  }

  // Publishing methods
  publishAgentUpdate(agent: any, userId: string) {
    this.pubsub.publish('AGENT_UPDATES', {
      agentUpdates: agent,
      userId
    });
  }

  publishAgentPerformance(agentId: string, performance: any, userId: string) {
    this.pubsub.publish('AGENT_PERFORMANCE', {
      agentId,
      agentPerformance: performance,
      userId
    });
  }

  publishPortfolioUpdate(portfolio: any, userId: string) {
    this.pubsub.publish('PORTFOLIO_UPDATES', {
      portfolioUpdates: portfolio,
      userId
    });
  }

  publishPortfolioValue(portfolioId: string, value: number, userId: string) {
    this.pubsub.publish('PORTFOLIO_VALUE', {
      portfolioId,
      portfolioValue: value,
      userId
    });
  }

  publishMarketData(symbol: string, data: any) {
    this.pubsub.publish(`MARKET_DATA_${symbol.toUpperCase()}`, {
      marketData: data
    });
  }

  publishArbitrageOpportunity(opportunity: any) {
    this.pubsub.publish('ARBITRAGE_OPPORTUNITIES', {
      arbitrageOpportunities: opportunity
    });
  }

  publishNotification(notification: any, userId: string) {
    this.pubsub.publish(`NOTIFICATIONS_${userId}`, {
      notifications: notification,
      userId
    });
  }

  publishSystemAlert(alert: any) {
    this.pubsub.publish('SYSTEM_ALERTS', {
      systemAlerts: alert
    });
  }
}