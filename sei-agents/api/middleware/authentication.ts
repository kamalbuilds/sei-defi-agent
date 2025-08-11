import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/AuthService';
import { Logger } from '../../utils/logger';

const logger = new Logger('AuthMiddleware');
const authService = new AuthService();

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
      };
    }
  }
}

/**
 * Authentication middleware that verifies JWT tokens
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    
    if (!token) {
      res.status(401).json({ error: 'Authentication token required' });
      return;
    }

    const user = await authService.verifyToken(token);
    
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Attach user to request object
    req.user = user;
    
    // Log successful authentication
    logger.debug('User authenticated', { 
      userId: user.id, 
      role: user.role,
      endpoint: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Authentication error', { 
      error: (error as any).message, 
      endpoint: req.path,
      method: req.method
    });
    
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication middleware - continues even if no valid token
 */
export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    
    if (token) {
      const user = await authService.verifyToken(token);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    logger.warn('Optional authentication failed', { 
      error: (error as any).message, 
      endpoint: req.path 
    });
    next();
  }
}

/**
 * Middleware factory to require specific permissions
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasPermission = req.user.permissions?.includes(permission) || req.user.role === 'admin';
    
    if (!hasPermission) {
      logger.warn('Permission denied', { 
        userId: req.user.id, 
        requiredPermission: permission,
        userPermissions: req.user.permissions,
        endpoint: req.path
      });
      
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission
      });
      return;
    }

    logger.debug('Permission granted', { 
      userId: req.user.id, 
      permission,
      endpoint: req.path
    });

    next();
  };
}

/**
 * Middleware factory to require specific roles
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      logger.warn('Role access denied', { 
        userId: req.user.id, 
        userRole: req.user.role,
        requiredRole: role,
        endpoint: req.path
      });
      
      res.status(403).json({ 
        error: 'Insufficient role privileges',
        required: role,
        current: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to check resource ownership
 */
export function requireOwnership(resourceUserIdPath: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Admin can access all resources
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Get resource user ID from request (params, body, or query)
    const resourceUserId = req.params[resourceUserIdPath] || 
                          req.body[resourceUserIdPath] || 
                          req.query[resourceUserIdPath];

    if (!resourceUserId) {
      res.status(400).json({ error: `Resource ${resourceUserIdPath} not found in request` });
      return;
    }

    if (req.user.id !== resourceUserId) {
      logger.warn('Ownership access denied', { 
        userId: req.user.id, 
        resourceUserId,
        endpoint: req.path
      });
      
      res.status(403).json({ error: 'Access denied: You can only access your own resources' });
      return;
    }

    next();
  };
}

/**
 * Middleware for API key authentication (for system-to-system calls)
 */
export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    const isValid = await authService.verifyApiKey(apiKey);
    
    if (!isValid) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Set system user context
    req.user = {
      id: 'system',
      email: 'system@nexus-ai.com',
      role: 'system',
      permissions: ['*'] // System has all permissions
    };

    logger.debug('System authenticated via API key', { 
      endpoint: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('API key authentication error', { 
      error: (error as any).message, 
      endpoint: req.path 
    });
    
    res.status(401).json({ error: 'API key authentication failed' });
  }
}

/**
 * Rate limiting by user
 */
export function userRateLimit(maxRequests: number, windowMs: number) {
  const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

  // Clean up old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of userRequestCounts.entries()) {
      if (now > data.resetTime) {
        userRequestCounts.delete(userId);
      }
    }
  }, 60000);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }

    const userId = req.user.id;
    const now = Date.now();
    
    let userData = userRequestCounts.get(userId);
    
    if (!userData || now > userData.resetTime) {
      userData = { count: 1, resetTime: now + windowMs };
      userRequestCounts.set(userId, userData);
      next();
      return;
    }

    if (userData.count >= maxRequests) {
      const resetIn = Math.ceil((userData.resetTime - now) / 1000);
      
      logger.warn('User rate limit exceeded', { 
        userId, 
        count: userData.count, 
        limit: maxRequests,
        resetIn,
        endpoint: req.path
      });
      
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        resetIn,
        limit: maxRequests
      });
      return;
    }

    userData.count++;
    next();
  };
}

/**
 * Extract token from request headers
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    return cookieToken;
  }

  // Check query parameter (less secure, only for development)
  const queryToken = req.query.token as string;
  if (queryToken && process.env.NODE_ENV === 'development') {
    return queryToken;
  }

  return null;
}

/**
 * Middleware to validate user account status
 */
export async function validateAccountStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  try {
    const accountStatus = await authService.getAccountStatus(req.user.id);
    
    if (accountStatus === 'suspended') {
      logger.warn('Suspended account access attempt', { userId: req.user.id });
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    if (accountStatus === 'deactivated') {
      logger.warn('Deactivated account access attempt', { userId: req.user.id });
      res.status(403).json({ error: 'Account deactivated' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Account status validation error', { 
      error: (error as any).message, 
      userId: req.user.id 
    });
    next(); // Continue on error to avoid blocking valid users
  }
}

/**
 * Middleware to log API usage
 */
export function apiUsageLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    if (res.statusCode >= 400) {
      logger.warn('API request with error', logData);
    } else {
      logger.info('API request completed', logData);
    }
  });

  next();
}

/**
 * Error handler for authentication errors
 */
export function authErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid token format' });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Token expired' });
    return;
  }

  if (error.name === 'NotBeforeError') {
    res.status(401).json({ error: 'Token not active yet' });
    return;
  }

  next(error);
}