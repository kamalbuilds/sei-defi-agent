import { GraphQLContext, requireAuth, requireOwnership, requirePermission } from '../context';
import { PaymentService } from '../../../core/services/PaymentService';
import { withFilter } from 'graphql-subscriptions';

export const paymentResolvers = {
  Query: {
    payments: async (_: any, { userId, filter }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const paymentService = new PaymentService();
      
      // Users can only see their own payments unless they're admin
      const targetUserId = user.role === 'admin' ? userId : user.id;
      
      return paymentService.findByUserId(targetUserId, filter);
    },

    payment: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const paymentService = new PaymentService();
      
      const payment = await paymentService.findById(id);
      if (!payment) {
        throw new Error('Payment not found');
      }
      
      requireOwnership(context, payment.userId);
      return payment;
    }
  },

  Mutation: {
    createPayment: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const paymentService = new PaymentService();
      
      // Validate payment creation permissions
      if (input.type === 'WITHDRAWAL' && input.amount > 10000) {
        requirePermission(context, 'LARGE_WITHDRAWAL');
      }
      
      const paymentData = {
        ...input,
        userId: user.id,
        status: 'PENDING'
      };
      
      const payment = await paymentService.create(paymentData);
      
      // Publish payment creation event
      context.pubsub.publish('PAYMENT_UPDATES', {
        paymentUpdates: payment,
        userId: user.id
      });
      
      // Send notification
      context.pubsub.publish('NOTIFICATIONS', {
        notifications: {
          id: `payment-${payment.id}-${Date.now()}`,
          type: 'PAYMENT_PROCESSED',
          title: 'Payment Created',
          message: `Your ${input.type.toLowerCase()} of ${input.amount} ${input.currency} has been created`,
          data: { paymentId: payment.id, type: input.type, amount: input.amount },
          read: false,
          createdAt: new Date(),
          userId: user.id
        },
        userId: user.id
      });
      
      return payment;
    },

    processPayment: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const paymentService = new PaymentService();
      
      const payment = await paymentService.findById(id);
      if (!payment) {
        throw new Error('Payment not found');
      }
      
      // Only admins or payment processors can process payments
      if (user.role !== 'admin' && !user.permissions.includes('PROCESS_PAYMENTS')) {
        requireOwnership(context, payment.userId);
      }
      
      if (payment.status !== 'PENDING') {
        throw new Error('Only pending payments can be processed');
      }
      
      const processedPayment = await paymentService.process(id);
      
      // Publish payment processing event
      context.pubsub.publish('PAYMENT_UPDATES', {
        paymentUpdates: processedPayment,
        userId: payment.userId
      });
      
      // Send notification
      context.pubsub.publish('NOTIFICATIONS', {
        notifications: {
          id: `payment-processed-${id}-${Date.now()}`,
          type: 'PAYMENT_PROCESSED',
          title: 'Payment Processed',
          message: `Your ${payment.type.toLowerCase()} has been successfully processed`,
          data: { paymentId: id, status: processedPayment.status },
          read: false,
          createdAt: new Date(),
          userId: payment.userId
        },
        userId: payment.userId
      });
      
      return processedPayment;
    },

    refundPayment: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      requirePermission(context, 'REFUND_PAYMENTS');
      
      const paymentService = new PaymentService();
      
      const payment = await paymentService.findById(id);
      if (!payment) {
        throw new Error('Payment not found');
      }
      
      if (payment.status !== 'COMPLETED') {
        throw new Error('Only completed payments can be refunded');
      }
      
      const refundedPayment = await paymentService.refund(id);
      
      // Publish refund event
      context.pubsub.publish('PAYMENT_UPDATES', {
        paymentUpdates: refundedPayment,
        userId: payment.userId
      });
      
      // Send notification
      context.pubsub.publish('NOTIFICATIONS', {
        notifications: {
          id: `payment-refunded-${id}-${Date.now()}`,
          type: 'PAYMENT_PROCESSED',
          title: 'Payment Refunded',
          message: `Your ${payment.type.toLowerCase()} of ${payment.amount} ${payment.currency} has been refunded`,
          data: { paymentId: id, refundAmount: payment.amount },
          read: false,
          createdAt: new Date(),
          userId: payment.userId
        },
        userId: payment.userId
      });
      
      return refundedPayment;
    }
  },

  Subscription: {
    paymentUpdates: {
      subscribe: withFilter(
        (_, __, context: GraphQLContext) => {
          requireAuth(context);
          return context.pubsub.asyncIterator(['PAYMENT_UPDATES']);
        },
        (payload, variables, context: GraphQLContext) => {
          return payload.userId === context.user?.id || context.user?.role === 'admin';
        }
      )
    }
  },

  // Field resolvers
  Payment: {
    user: async (parent: any, _: any, context: GraphQLContext) => {
      const userService = context.services.database;
      return userService.findUserById(parent.userId);
    }
  }
};