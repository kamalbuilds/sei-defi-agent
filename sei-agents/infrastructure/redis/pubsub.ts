// Redis PubSub Implementation
import { createClient } from 'redis';
import { logger } from '../../utils/logger';

let redisClient: ReturnType<typeof createClient> | null = null;
let pubClient: ReturnType<typeof createClient> | null = null;
let subClient: ReturnType<typeof createClient> | null = null;

export async function initializeRedis(url: string): Promise<void> {
  try {
    // Create main client
    redisClient = createClient({ url });
    pubClient = redisClient.duplicate();
    subClient = redisClient.duplicate();
    
    // Connect all clients
    await Promise.all([
      redisClient.connect(),
      pubClient.connect(),
      subClient.connect()
    ]);
    
    logger.info('✅ Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Continue without Redis in development
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('⚠️ Running without Redis cache');
    } else {
      throw error;
    }
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) await redisClient.quit();
  if (pubClient) await pubClient.quit();
  if (subClient) await subClient.quit();
  logger.info('Redis connections closed');
}

export function getRedisClient() {
  return redisClient;
}

export { redisClient, pubClient, subClient };