import { Request } from 'express';
import { PubSub } from './pubsub';
import { AuthService } from '../../core/services/AuthService';
import { DatabaseService } from '../../infrastructure/database/DatabaseService';
import { CacheService } from '../../infrastructure/cache/CacheService';
import { Logger } from '../../utils/logger';

export interface GraphQLContext {
  req: Request;
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  services: {
    auth: AuthService;
    database: DatabaseService;
    cache: CacheService;
    logger: Logger;
  };
  pubsub: PubSub;
  dataSources: {
    marketData: any;
    blockchain: any;
    exchangeAPIs: any;
  };
}

export async function createContext({ req }: { req: Request }): Promise<GraphQLContext> {
  const logger = new Logger('GraphQL');
  
  // Initialize services
  const authService = new AuthService();
  const databaseService = new DatabaseService();
  const cacheService = new CacheService();
  const pubsub = new PubSub();

  // Extract and verify authentication token
  let user;
  try {
    const token = extractToken(req);
    if (token) {
      user = await authService.verifyToken(token);
    }
  } catch (error) {
    logger.warn('Failed to authenticate user', { error: (error as any).message });
  }

  // Initialize data sources
  const dataSources = {
    marketData: null, // Will be injected by MarketDataService
    blockchain: null, // Will be injected by BlockchainService
    exchangeAPIs: null // Will be injected by ExchangeService
  };

  return {
    req,
    user,
    services: {
      auth: authService,
      database: databaseService,
      cache: cacheService,
      logger
    },
    pubsub,
    dataSources
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

export function requireAuth(context: GraphQLContext) {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  return context.user;
}

export function requirePermission(context: GraphQLContext, permission: string) {
  const user = requireAuth(context);
  
  if (!user.permissions.includes(permission) && user.role !== 'admin') {
    throw new Error(`Permission denied: ${permission} required`);
  }
  
  return user;
}

export function requireOwnership(context: GraphQLContext, resourceUserId: string) {
  const user = requireAuth(context);
  
  if (user.id !== resourceUserId && user.role !== 'admin') {
    throw new Error('Access denied: You can only access your own resources');
  }
  
  return user;
}