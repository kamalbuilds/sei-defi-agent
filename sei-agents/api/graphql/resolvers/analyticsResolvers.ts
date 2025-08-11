import { GraphQLContext, requireAuth, requirePermission } from '../context';
import { AnalyticsService } from '../../../core/services/AnalyticsService';
import { MarketDataService } from '../../../core/services/MarketDataService';
import { PerformanceService } from '../../../core/services/PerformanceService';

export const analyticsResolvers = {
  Query: {
    analytics: async (_: any, { type, params }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const analyticsService = new AnalyticsService();
      
      // Ensure user has access to the requested analytics
      if (type === 'MARKET_SENTIMENT' || type === 'CORRELATION_ANALYSIS') {
        requirePermission(context, 'VIEW_MARKET_ANALYTICS');
      }
      
      // Add user context to params if needed
      const analyticsParams = {
        ...params,
        userId: user.id,
        userRole: user.role
      };
      
      switch (type) {
        case 'PORTFOLIO_ANALYSIS':
          return analyticsService.analyzePortfolio(analyticsParams);
        
        case 'MARKET_SENTIMENT':
          return analyticsService.analyzeSentiment(analyticsParams);
        
        case 'RISK_ASSESSMENT':
          return analyticsService.assessRisk(analyticsParams);
        
        case 'PERFORMANCE_ATTRIBUTION':
          return analyticsService.attributePerformance(analyticsParams);
        
        case 'CORRELATION_ANALYSIS':
          return analyticsService.analyzeCorrelations(analyticsParams);
        
        case 'VOLATILITY_ANALYSIS':
          return analyticsService.analyzeVolatility(analyticsParams);
        
        default:
          throw new Error(`Unsupported analytics type: ${type}`);
      }
    },

    marketData: async (_: any, { symbols }: { symbols: string[] }, context: GraphQLContext) => {
      requireAuth(context);
      const marketDataService = new MarketDataService();
      
      // Limit the number of symbols for performance
      if (symbols.length > 100) {
        throw new Error('Too many symbols requested. Maximum 100 allowed.');
      }
      
      return marketDataService.getMultipleSymbols(symbols);
    },

    performanceMetrics: async (_: any, { entityId, entityType }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const performanceService = new PerformanceService();
      
      // Verify user has access to the entity
      await performanceService.verifyAccess(entityId, entityType, user.id, user.role);
      
      return performanceService.getMetrics(entityId, entityType);
    }
  },

  Mutation: {
    // Analytics mutations could include custom report generation, alert setup, etc.
    createCustomReport: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const analyticsService = new AnalyticsService();
      
      const reportData = {
        ...input,
        userId: user.id,
        createdAt: new Date()
      };
      
      return analyticsService.createCustomReport(reportData);
    },

    setupAlert: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const analyticsService = new AnalyticsService();
      
      const alertData = {
        ...input,
        userId: user.id,
        active: true,
        createdAt: new Date()
      };
      
      const alert = await analyticsService.createAlert(alertData);
      
      // Setup real-time monitoring for this alert
      analyticsService.monitorAlert(alert.id);
      
      return alert;
    }
  },

  Subscription: {
    marketData: {
      subscribe: (_, { symbols }: { symbols: string[] }, context: GraphQLContext) => {
        requireAuth(context);
        
        // Subscribe to market data updates for specific symbols
        return context.pubsub.asyncIterator(
          symbols.map(symbol => `MARKET_DATA_${symbol}`)
        );
      }
    },

    priceAlerts: {
      subscribe: (_, __, context: GraphQLContext) => {
        const user = requireAuth(context);
        return context.pubsub.asyncIterator([`PRICE_ALERTS_${user.id}`]);
      }
    }
  }
};