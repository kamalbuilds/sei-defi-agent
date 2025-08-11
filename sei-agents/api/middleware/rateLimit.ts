import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';

const logger = new Logger('RateLimitMiddleware');

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    blocked: boolean;
  };
}

class RateLimitManager {
  private stores: Map<string, RateLimitStore> = new Map();
  
  constructor() {
    // Cleanup expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedEntries = 0;

    for (const [storeName, store] of this.stores.entries()) {
      for (const [key, data] of Object.entries(store)) {
        if (now > data.resetTime) {
          delete store[key];
          cleanedEntries++;
        }
      }
    }

    if (cleanedEntries > 0) {
      logger.debug('Rate limit cleanup completed', { cleanedEntries });
    }
  }

  createLimiter(name: string, config: RateLimitConfig) {
    if (!this.stores.has(name)) {
      this.stores.set(name, {});
    }

    const store = this.stores.get(name)!;
    const keyGenerator = config.keyGenerator || this.defaultKeyGenerator;

    return (req: Request, res: Response, next: NextFunction): void => {
      // Skip if configured to do so
      if (config.skip && config.skip(req)) {
        next();
        return;
      }

      const key = keyGenerator(req);
      const now = Date.now();
      
      let entry = store[key];
      
      // Initialize or reset expired entry
      if (!entry || now > entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + config.windowMs,
          blocked: false
        };
        store[key] = entry;
      }

      // Check if currently blocked
      if (entry.blocked && now < entry.resetTime) {
        this.sendRateLimitResponse(res, config, entry);
        
        if (config.onLimitReached) {
          config.onLimitReached(req, res);
        }
        
        return;
      }

      // Reset blocked status if window has passed
      if (entry.blocked && now >= entry.resetTime) {
        entry.blocked = false;
        entry.count = 0;
        entry.resetTime = now + config.windowMs;
      }

      // Increment counter
      entry.count++;

      // Set rate limit headers
      this.setRateLimitHeaders(res, config, entry);

      // Check if limit exceeded
      if (entry.count > config.maxRequests) {
        entry.blocked = true;
        
        logger.warn('Rate limit exceeded', {
          key,
          count: entry.count,
          limit: config.maxRequests,
          resetTime: new Date(entry.resetTime),
          endpoint: req.path,
          method: req.method
        });

        this.sendRateLimitResponse(res, config, entry);
        
        if (config.onLimitReached) {
          config.onLimitReached(req, res);
        }
        
        return;
      }

      next();
    };
  }

  private defaultKeyGenerator(req: Request): string {
    // Use user ID if authenticated, otherwise fall back to IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  }

  private setRateLimitHeaders(res: Response, config: RateLimitConfig, entry: any): void {
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetTime = Math.ceil(entry.resetTime / 1000);

    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Window': config.windowMs.toString()
    });
  }

  private sendRateLimitResponse(res: Response, config: RateLimitConfig, entry: any): void {
    const resetIn = Math.ceil((entry.resetTime - Date.now()) / 1000);
    
    res.status(429).json({
      error: config.message || 'Too many requests',
      limit: config.maxRequests,
      resetIn,
      retryAfter: resetIn
    });
  }

  getStats(): { [storeName: string]: { totalKeys: number; activeKeys: number } } {
    const stats: { [storeName: string]: { totalKeys: number; activeKeys: number } } = {};
    const now = Date.now();

    for (const [storeName, store] of this.stores.entries()) {
      const totalKeys = Object.keys(store).length;
      const activeKeys = Object.values(store).filter(entry => now < entry.resetTime).length;
      
      stats[storeName] = { totalKeys, activeKeys };
    }

    return stats;
  }
}

// Global rate limit manager instance
const rateLimitManager = new RateLimitManager();

/**
 * Create a rate limit middleware with custom configuration
 */
export function createRateLimit(name: string, config: RateLimitConfig) {
  return rateLimitManager.createLimiter(name, config);
}

/**
 * Simplified rate limit middleware factory
 */
export function rateLimitMiddleware(
  name: string,
  maxRequests: number,
  windowSeconds: number,
  message?: string
) {
  return createRateLimit(name, {
    maxRequests,
    windowMs: windowSeconds * 1000,
    message: message || `Too many requests. Limit: ${maxRequests} per ${windowSeconds} seconds`
  });
}

/**
 * Global API rate limiter (applies to all endpoints)
 */
export const globalRateLimit = createRateLimit('global', {
  maxRequests: 1000,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP or user. Please try again later.',
  keyGenerator: (req) => {
    // More generous limits for authenticated users
    if (req.user?.id) {
      return `global:user:${req.user.id}`;
    }
    return `global:ip:${req.ip}`;
  }
});

/**
 * Authentication rate limiter
 */
export const authRateLimit = createRateLimit('auth', {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
  keyGenerator: (req) => `auth:ip:${req.ip}`,
  skipSuccessfulRequests: true
});

/**
 * Password reset rate limiter
 */
export const passwordResetRateLimit = createRateLimit('password_reset', {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many password reset attempts. Please try again later.',
  keyGenerator: (req) => `pwd_reset:email:${req.body.email || req.ip}`
});

/**
 * Registration rate limiter
 */
export const registrationRateLimit = createRateLimit('registration', {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many registration attempts. Please try again later.',
  keyGenerator: (req) => `register:ip:${req.ip}`
});

/**
 * API key rate limiter (for high-volume system calls)
 */
export const apiKeyRateLimit = createRateLimit('api_key', {
  maxRequests: 10000,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'API key rate limit exceeded.',
  keyGenerator: (req) => `api_key:${req.headers['x-api-key']}`,
  skip: (req) => !req.headers['x-api-key']
});

/**
 * File upload rate limiter
 */
export const uploadRateLimit = createRateLimit('upload', {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many file uploads. Please try again later.',
  keyGenerator: (req) => req.user?.id ? `upload:user:${req.user.id}` : `upload:ip:${req.ip}`
});

/**
 * Search rate limiter
 */
export const searchRateLimit = createRateLimit('search', {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many search requests. Please try again later.',
  keyGenerator: (req) => req.user?.id ? `search:user:${req.user.id}` : `search:ip:${req.ip}`
});

/**
 * WebSocket connection rate limiter
 */
export const websocketRateLimit = createRateLimit('websocket', {
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many WebSocket connection attempts.',
  keyGenerator: (req) => `ws:ip:${req.ip}`
});

/**
 * Expensive operations rate limiter (analytics, reports, etc.)
 */
export const expensiveOperationRateLimit = createRateLimit('expensive', {
  maxRequests: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many expensive operations. Please try again later.',
  keyGenerator: (req) => req.user?.id ? `expensive:user:${req.user.id}` : `expensive:ip:${req.ip}`,
  onLimitReached: (req, res) => {
    logger.warn('Expensive operation rate limit reached', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
  }
});

/**
 * Smart rate limiter that adjusts based on user role and subscription
 */
export function smartRateLimit(
  baseName: string,
  baseLimit: number,
  windowMs: number,
  message?: string
) {
  return createRateLimit(baseName, {
    maxRequests: baseLimit,
    windowMs,
    message: message || `Rate limit exceeded. Base limit: ${baseLimit}`,
    keyGenerator: (req) => {
      const userId = req.user?.id;
      const role = req.user?.role;
      
      if (userId) {
        return `${baseName}:user:${userId}:${role}`;
      }
      return `${baseName}:ip:${req.ip}`;
    },
    maxRequests: baseLimit * getRoleMultiplier(req?.user?.role),
  });
}

/**
 * Get rate limit multiplier based on user role
 */
function getRoleMultiplier(role?: string): number {
  switch (role) {
    case 'admin':
      return 10;
    case 'premium':
      return 5;
    case 'pro':
      return 3;
    case 'user':
      return 1;
    default:
      return 0.5; // Unauthenticated users get lower limits
  }
}

/**
 * Burst rate limiter - allows short bursts but enforces sustained limits
 */
export function burstRateLimit(
  name: string,
  burstLimit: number,
  sustainedLimit: number,
  burstWindowMs: number,
  sustainedWindowMs: number
) {
  const burstLimiter = createRateLimit(`${name}_burst`, {
    maxRequests: burstLimit,
    windowMs: burstWindowMs,
    message: `Burst rate limit exceeded. Limit: ${burstLimit} per ${burstWindowMs / 1000}s`
  });

  const sustainedLimiter = createRateLimit(`${name}_sustained`, {
    maxRequests: sustainedLimit,
    windowMs: sustainedWindowMs,
    message: `Sustained rate limit exceeded. Limit: ${sustainedLimit} per ${sustainedWindowMs / 1000}s`
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    burstLimiter(req, res, (burstError) => {
      if (burstError || res.headersSent) {
        return;
      }

      sustainedLimiter(req, res, next);
    });
  };
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats() {
  return rateLimitManager.getStats();
}

/**
 * Middleware to add rate limit information to response headers
 */
export function rateLimitHeaders(req: Request, res: Response, next: NextFunction): void {
  res.set({
    'X-RateLimit-Policy': 'Dynamic rate limiting based on user role and endpoint',
    'X-RateLimit-Support': 'https://docs.nexus-ai.com/rate-limits'
  });
  
  next();
}