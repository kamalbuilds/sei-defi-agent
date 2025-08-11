import { GraphQLContext, requireAuth, requireOwnership } from '../context';
import { AgentService } from '../../../core/services/AgentService';
import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../pubsub';

export const agentResolvers = {
  Query: {
    agents: async (_: any, { filter }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      // Apply user filter if not admin
      const userFilter = user.role === 'admin' ? filter : { ...filter, userId: user.id };
      
      return agentService.findMany(userFilter);
    },

    agent: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      const agent = await agentService.findById(id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      requireOwnership(context, agent.userId);
      return agent;
    },

    agentPerformance: async (_: any, { id, timeRange }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      const agent = await agentService.findById(id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      requireOwnership(context, agent.userId);
      return agentService.getPerformance(id, timeRange);
    }
  },

  Mutation: {
    createAgent: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      const agentData = {
        ...input,
        userId: user.id,
        status: 'DRAFT',
        version: '1.0.0'
      };
      
      const agent = await agentService.create(agentData);
      
      // Publish agent creation event
      context.pubsub.publish('AGENT_UPDATES', {
        agentUpdates: agent,
        userId: user.id
      });
      
      return agent;
    },

    updateAgent: async (_: any, { id, input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      const existingAgent = await agentService.findById(id);
      if (!existingAgent) {
        throw new Error('Agent not found');
      }
      
      requireOwnership(context, existingAgent.userId);
      
      const agent = await agentService.update(id, input);
      
      // Publish agent update event
      context.pubsub.publish('AGENT_UPDATES', {
        agentUpdates: agent,
        userId: user.id
      });
      
      return agent;
    },

    deleteAgent: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      const agent = await agentService.findById(id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      requireOwnership(context, agent.userId);
      
      // Ensure agent is not deployed
      if (agent.status === 'DEPLOYED') {
        throw new Error('Cannot delete deployed agent. Please pause it first.');
      }
      
      await agentService.delete(id);
      
      // Publish agent deletion event
      context.pubsub.publish('AGENT_UPDATES', {
        agentUpdates: { ...agent, deleted: true },
        userId: user.id
      });
      
      return true;
    },

    deployAgent: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      const agent = await agentService.findById(id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      requireOwnership(context, agent.userId);
      
      if (agent.status !== 'TESTING') {
        throw new Error('Agent must be in TESTING status to deploy');
      }
      
      const deployedAgent = await agentService.deploy(id);
      
      // Publish deployment event
      context.pubsub.publish('AGENT_UPDATES', {
        agentUpdates: deployedAgent,
        userId: user.id
      });
      
      return deployedAgent;
    },

    pauseAgent: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const agentService = new AgentService();
      
      const agent = await agentService.findById(id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      requireOwnership(context, agent.userId);
      
      if (agent.status !== 'DEPLOYED') {
        throw new Error('Only deployed agents can be paused');
      }
      
      const pausedAgent = await agentService.pause(id);
      
      // Publish pause event
      context.pubsub.publish('AGENT_UPDATES', {
        agentUpdates: pausedAgent,
        userId: user.id
      });
      
      return pausedAgent;
    }
  },

  Subscription: {
    agentUpdates: {
      subscribe: withFilter(
        (_, __, context: GraphQLContext) => {
          requireAuth(context);
          return context.pubsub.asyncIterator(['AGENT_UPDATES']);
        },
        (payload, variables, context: GraphQLContext) => {
          // Filter by agentId if provided
          if (variables.agentId && payload.agentUpdates.id !== variables.agentId) {
            return false;
          }
          
          // Ensure user can only see their own agents
          return payload.userId === context.user?.id || context.user?.role === 'admin';
        }
      )
    },

    agentPerformance: {
      subscribe: withFilter(
        (_, __, context: GraphQLContext) => {
          requireAuth(context);
          return context.pubsub.asyncIterator(['AGENT_PERFORMANCE']);
        },
        async (payload, variables, context: GraphQLContext) => {
          if (payload.agentId !== variables.agentId) {
            return false;
          }
          
          // Check ownership
          const agentService = new AgentService();
          const agent = await agentService.findById(variables.agentId);
          
          return agent?.userId === context.user?.id || context.user?.role === 'admin';
        }
      )
    }
  },

  // Field resolvers
  Agent: {
    user: async (parent: any, _: any, context: GraphQLContext) => {
      const userService = context.services.database; // Assuming user methods are here
      return userService.findUserById(parent.userId);
    },

    performance: async (parent: any, _: any, context: GraphQLContext) => {
      const agentService = new AgentService();
      return agentService.getPerformance(parent.id, 'ALL');
    }
  }
};