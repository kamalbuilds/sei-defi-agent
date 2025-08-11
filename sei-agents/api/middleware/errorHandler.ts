import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';

const logger = new Logger('ErrorHandler');

// Custom error types
export class APIError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR', true);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded', resetTime?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR', true, { resetTime });
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
    this.name = 'ServiceUnavailableError';
  }
}

export class DatabaseError extends APIError {
  constructor(message: string, originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR', true, { originalError: originalError?.message });
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends APIError {
  constructor(service: string, message: string) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, { service });
    this.name = 'ExternalServiceError';
  }
}

export class BusinessLogicError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR', true, details);
    this.name = 'BusinessLogicError';
  }
}

/**
 * Main error handler middleware
 */
export function errorHandler(
  error: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Handle known API errors
  if (error instanceof APIError) {
    handleAPIError(error, req, res);
    return;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    handleValidationError(error, req, res);
    return;
  }

  if (error.name === 'CastError' || error.name === 'MongoError') {
    handleDatabaseError(error, req, res);
    return;
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    handleAuthenticationError(error, req, res);
    return;
  }

  if (error.name === 'MulterError') {
    handleFileUploadError(error, req, res);
    return;
  }

  // Handle unknown errors
  handleUnknownError(error, req, res);
}

/**
 * Handle API errors
 */
function handleAPIError(error: APIError, req: Request, res: Response): void {
  const errorResponse = {
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...(error.details && { details: error.details })
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ...(req.user && { userId: req.user.id })
  };

  // Log error with appropriate level
  if (error.statusCode >= 500) {
    logger.error('API Error (5xx)', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      userId: req.user?.id,
      endpoint: req.path,
      method: req.method,
      details: error.details
    });
  } else {
    logger.warn('API Error (4xx)', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      userId: req.user?.id,
      endpoint: req.path,
      method: req.method,
      details: error.details
    });
  }

  // Don't expose sensitive information in production
  if (process.env.NODE_ENV === 'production' && error.statusCode >= 500) {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  }

  res.status(error.statusCode).json(errorResponse);
}

/**
 * Handle validation errors
 */
function handleValidationError(error: Error, req: Request, res: Response): void {
  const validationError = new ValidationError(error.message);
  handleAPIError(validationError, req, res);
}

/**
 * Handle database errors
 */
function handleDatabaseError(error: Error, req: Request, res: Response): void {
  let message = 'Database operation failed';
  let details: any = {};

  if (error.name === 'CastError') {
    message = 'Invalid ID format';
    details = { field: (error as any).path, value: (error as any).value };
  } else if (error.name === 'MongoError') {
    if ((error as any).code === 11000) {
      message = 'Duplicate entry detected';
      details = { duplicateFields: Object.keys((error as any).keyValue || {}) };
    }
  }

  const dbError = new DatabaseError(message, error);
  dbError.details = details;
  handleAPIError(dbError, req, res);
}

/**
 * Handle authentication errors
 */
function handleAuthenticationError(error: Error, req: Request, res: Response): void {
  let message = 'Authentication failed';

  if (error.name === 'TokenExpiredError') {
    message = 'Token has expired';
  } else if (error.name === 'JsonWebTokenError') {
    message = 'Invalid token format';
  }

  const authError = new AuthenticationError(message);
  handleAPIError(authError, req, res);
}

/**
 * Handle file upload errors
 */
function handleFileUploadError(error: Error, req: Request, res: Response): void {
  let message = 'File upload failed';
  let statusCode = 400;

  if ((error as any).code === 'LIMIT_FILE_SIZE') {
    message = 'File size too large';
  } else if ((error as any).code === 'LIMIT_FILE_COUNT') {
    message = 'Too many files';
  } else if ((error as any).code === 'LIMIT_UNEXPECTED_FILE') {
    message = 'Unexpected file field';
  }

  const uploadError = new APIError(message, statusCode, 'FILE_UPLOAD_ERROR');
  handleAPIError(uploadError, req, res);
}

/**
 * Handle unknown errors
 */
function handleUnknownError(error: Error, req: Request, res: Response): void {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    name: error.name,
    userId: req.user?.id,
    endpoint: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  const unknownError = new APIError(
    process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    500,
    'UNKNOWN_ERROR',
    false
  );

  handleAPIError(unknownError, req, res);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError('Endpoint');
  error.details = {
    method: req.method,
    path: req.path,
    availableEndpoints: [
      'GET /api/agents',
      'GET /api/portfolios',
      'GET /api/payments',
      'GET /api/analytics/market-data',
      // Add more endpoints as needed
    ]
  };

  handleAPIError(error, req, res);
}

/**
 * Async error handler wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global unhandled rejection handler
 */
export function setupGlobalErrorHandlers(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });

    // Graceful shutdown
    process.exit(1);
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });

    // Graceful shutdown
    process.exit(1);
  });

  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, starting graceful shutdown');
    
    // Perform cleanup operations
    setTimeout(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    }, 5000);
  });
}

/**
 * Error reporting utilities
 */
export class ErrorReporter {
  static reportError(error: Error, context?: any): void {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      context,
      environment: process.env.NODE_ENV
    };

    logger.error('Error Report', errorReport);

    // In production, you might want to send to external service
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service (e.g., Sentry, Bugsnag)
      // ErrorTrackingService.captureException(error, context);
    }
  }

  static reportWarning(message: string, context?: any): void {
    const warningReport = {
      message,
      timestamp: new Date().toISOString(),
      context,
      environment: process.env.NODE_ENV
    };

    logger.warn('Warning Report', warningReport);
  }
}

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.canAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private canAttemptReset(): boolean {
    return this.lastFailureTime
      ? Date.now() - this.lastFailureTime >= this.recoveryTimeout
      : false;
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Health check error handler
 */
export function healthCheckErrorHandler(error: Error): { status: string; error: string } {
  logger.warn('Health check failed', { error: error.message });
  
  return {
    status: 'unhealthy',
    error: error.message
  };
}

/**
 * Middleware to handle specific business logic errors
 */
export function handleBusinessLogicErrors(req: Request, res: Response, next: NextFunction): void {
  // This middleware can be customized to handle specific business logic errors
  // For example, insufficient funds, invalid trading pairs, etc.
  
  next();
}

/**
 * Error context enrichment
 */
export function enrichErrorContext(error: Error, req: Request): Error {
  const enrichedError = error as any;
  
  enrichedError.context = {
    userId: req.user?.id,
    userRole: req.user?.role,
    endpoint: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.get('X-Request-ID')
  };

  return enrichedError;
}