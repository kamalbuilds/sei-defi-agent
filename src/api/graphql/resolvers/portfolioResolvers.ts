import { GraphQLContext, requireAuth, requireOwnership } from '../context';
import { PortfolioService } from '../../../core/services/PortfolioService';
import { withFilter } from 'graphql-subscriptions';

export const portfolioResolvers = {
  Query: {
    portfolios: async (_: any, { userId }: { userId: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const portfolioService = new PortfolioService();
      
      // Users can only see their own portfolios unless they're admin
      const targetUserId = user.role === 'admin' ? userId : user.id;
      
      return portfolioService.findByUserId(targetUserId);
    },

    portfolio: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const portfolioService = new PortfolioService();
      
      const portfolio = await portfolioService.findById(id);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }
      
      requireOwnership(context, portfolio.userId);
      return portfolio;
    },

    portfolioValue: async (_: any, { id, currency }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const portfolioService = new PortfolioService();
      
      const portfolio = await portfolioService.findById(id);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }
      
      requireOwnership(context, portfolio.userId);
      return portfolioService.calculateValue(id, currency);
    },

    portfolioHistory: async (_: any, { id, timeRange }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const portfolioService = new PortfolioService();
      
      const portfolio = await portfolioService.findById(id);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }
      
      requireOwnership(context, portfolio.userId);
      return portfolioService.getHistory(id, timeRange);
    }
  },

  Mutation: {
    createPortfolio: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const portfolioService = new PortfolioService();
      
      const portfolioData = {
        ...input,
        userId: user.id
      };
      
      const portfolio = await portfolioService.create(portfolioData);
      
      // Publish portfolio creation event
      context.pubsub.publish('PORTFOLIO_UPDATES', {
        portfolioUpdates: portfolio,
        userId: user.id
      });
      
      return portfolio;
    },

    updatePortfolio: async (_: any, { id, input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const portfolioService = new PortfolioService();
      
      const existingPortfolio = await portfolioService.findById(id);
      if (!existingPortfolio) {
        throw new Error('Portfolio not found');
      }
      
      requireOwnership(context, existingPortfolio.userId);
      
      const portfolio = await portfolioService.update(id, input);
      
      // Publish portfolio update event
      context.pubsub.publish('PORTFOLIO_UPDATES', {
        portfolioUpdates: portfolio,
        userId: user.id
      });
      
      // Publish value update
      const newValue = await portfolioService.calculateValue(id);
      context.pubsub.publish('PORTFOLIO_VALUE', {
        portfolioValue: newValue,
        portfolioId: id,
        userId: user.id
      });
      
      return portfolio;
    },

    rebalancePortfolio: async (_: any, { id, strategy }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const portfolioService = new PortfolioService();
      
      const portfolio = await portfolioService.findById(id);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }
      
      requireOwnership(context, portfolio.userId);
      
      const rebalancedPortfolio = await portfolioService.rebalance(id, strategy);
      
      // Publish rebalance event
      context.pubsub.publish('PORTFOLIO_UPDATES', {
        portfolioUpdates: rebalancedPortfolio,
        userId: user.id
      });
      
      // Publish notification
      context.pubsub.publish('NOTIFICATIONS', {
        notifications: {
          id: `rebalance-${id}-${Date.now()}`,
          type: 'PORTFOLIO_REBALANCED',
          title: 'Portfolio Rebalanced',
          message: `Portfolio "${portfolio.name}" has been successfully rebalanced using ${strategy} strategy`,
          data: { portfolioId: id, strategy },
          read: false,
          createdAt: new Date(),
          userId: user.id
        },
        userId: user.id
      });
      
      return rebalancedPortfolio;
    }
  },

  Subscription: {
    portfolioUpdates: {
      subscribe: withFilter(
        (_, __, context: GraphQLContext) => {
          requireAuth(context);
          return context.pubsub.asyncIterator(['PORTFOLIO_UPDATES']);
        },
        async (payload, variables, context: GraphQLContext) => {
          if (payload.portfolioUpdates.id !== variables.portfolioId) {
            return false;
          }
          
          // Ensure user owns the portfolio
          return payload.userId === context.user?.id || context.user?.role === 'admin';
        }
      )
    },

    portfolioValue: {
      subscribe: withFilter(
        (_, __, context: GraphQLContext) => {
          requireAuth(context);
          return context.pubsub.asyncIterator(['PORTFOLIO_VALUE']);
        },
        async (payload, variables, context: GraphQLContext) => {
          if (payload.portfolioId !== variables.portfolioId) {
            return false;
          }
          
          return payload.userId === context.user?.id || context.user?.role === 'admin';
        }
      )
    }
  },

  // Field resolvers
  Portfolio: {
    user: async (parent: any, _: any, context: GraphQLContext) => {
      const userService = context.services.database;
      return userService.findUserById(parent.userId);
    },

    totalValue: async (parent: any, _: any, context: GraphQLContext) => {
      const portfolioService = new PortfolioService();
      return portfolioService.calculateValue(parent.id, parent.currency);
    },

    performance: async (parent: any, _: any, context: GraphQLContext) => {
      const portfolioService = new PortfolioService();
      return portfolioService.getPerformance(parent.id);
    },

    allocations: async (parent: any, _: any, context: GraphQLContext) => {
      const portfolioService = new PortfolioService();
      return portfolioService.getAllocations(parent.id);
    }
  },

  Allocation: {
    asset: async (parent: any, _: any, context: GraphQLContext) => {
      const assetService = context.services.database; // Assuming asset methods are here
      return assetService.findAssetById(parent.assetId);
    },

    value: async (parent: any, _: any, context: GraphQLContext) => {
      const portfolioService = new PortfolioService();
      const portfolio = await portfolioService.findById(parent.portfolioId);
      return (portfolio.totalValue * parent.percentage) / 100;
    }
  }
};