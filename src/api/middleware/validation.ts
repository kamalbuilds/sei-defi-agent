import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { Logger } from '../../utils/logger';

const logger = new Logger('ValidationMiddleware');

/**
 * Express validator error handler middleware
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    logger.warn('Validation failed', { 
      errors: formattedErrors, 
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
    return;
  }

  next();
}

/**
 * Common validation chains
 */
export const commonValidations = {
  // ID validations
  uuid: (field: string = 'id') => param(field).isUUID().withMessage(`${field} must be a valid UUID`),
  
  // Pagination validations
  pagination: [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).toInt().withMessage('Offset must be a non-negative integer'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer')
  ],

  // Date range validations
  dateRange: [
    query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid ISO 8601 date'),
    query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid ISO 8601 date'),
    query('dateFrom').optional().custom((value, { req }) => {
      if (value && req.query.dateTo && new Date(value) > new Date(req.query.dateTo as string)) {
        throw new Error('dateFrom must be before dateTo');
      }
      return true;
    })
  ],

  // Time range validation
  timeRange: query('timeRange').optional().isIn(['HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'ALL']),

  // Currency validation
  currency: (field: string = 'currency') => 
    body(field).isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters').toUpperCase(),

  // Amount validation
  amount: (field: string = 'amount', min: number = 0) =>
    body(field).isFloat({ min }).withMessage(`${field} must be a positive number`),

  // Email validation
  email: (field: string = 'email') =>
    body(field).isEmail().normalizeEmail().withMessage('Must be a valid email address'),

  // Password validation
  password: (field: string = 'password') =>
    body(field)
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be 8-128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),

  // String length validation
  stringLength: (field: string, min: number, max: number) =>
    body(field).trim().isLength({ min, max }).withMessage(`${field} must be ${min}-${max} characters`),

  // Array validation
  arrayLength: (field: string, min: number, max: number) =>
    body(field).isArray({ min, max }).withMessage(`${field} must be an array with ${min}-${max} items`),

  // JSON validation
  json: (field: string) =>
    body(field).custom(value => {
      try {
        if (typeof value === 'string') {
          JSON.parse(value);
        } else if (typeof value !== 'object' || value === null) {
          throw new Error('Invalid JSON');
        }
        return true;
      } catch {
        throw new Error(`${field} must be valid JSON`);
      }
    }),

  // Percentage validation
  percentage: (field: string) =>
    body(field).isFloat({ min: 0, max: 100 }).withMessage(`${field} must be between 0 and 100`),

  // Phone number validation
  phoneNumber: (field: string = 'phoneNumber') =>
    body(field).isMobilePhone('any').withMessage('Must be a valid phone number'),

  // URL validation
  url: (field: string = 'url') =>
    body(field).isURL().withMessage('Must be a valid URL'),

  // Sanitization
  sanitizeString: (field: string) =>
    body(field).trim().escape(),

  // Custom business logic validations
  portfolioAllocations: body('allocations').custom(allocations => {
    if (!Array.isArray(allocations)) {
      throw new Error('Allocations must be an array');
    }

    const total = allocations.reduce((sum: number, allocation: any) => {
      if (!allocation.percentage || typeof allocation.percentage !== 'number') {
        throw new Error('Each allocation must have a valid percentage');
      }
      return sum + allocation.percentage;
    }, 0);

    if (Math.abs(total - 100) > 0.01) {
      throw new Error('Allocation percentages must sum to 100%');
    }

    return true;
  }),

  agentConfig: body('config').custom(config => {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Agent config must be a valid object');
    }

    // Validate required config fields based on agent type
    const requiredFields = ['riskTolerance', 'maxPositionSize', 'tradingPairs'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Agent config must include ${field}`);
      }
    }

    if (config.riskTolerance < 0 || config.riskTolerance > 1) {
      throw new Error('Risk tolerance must be between 0 and 1');
    }

    if (config.maxPositionSize <= 0) {
      throw new Error('Max position size must be positive');
    }

    return true;
  }),

  marketDataSymbols: query('symbols').custom(symbols => {
    if (!symbols) return true;

    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    
    if (symbolArray.length > 100) {
      throw new Error('Maximum 100 symbols allowed');
    }

    for (const symbol of symbolArray) {
      if (typeof symbol !== 'string' || symbol.length < 2 || symbol.length > 10) {
        throw new Error('Each symbol must be 2-10 characters');
      }
    }

    return true;
  })
};

/**
 * Agent validation chains
 */
export const agentValidations = {
  create: [
    commonValidations.stringLength('name', 3, 100),
    body('type').isIn(['ARBITRAGE', 'MARKET_MAKER', 'SENTIMENT_ANALYZER', 'RISK_MANAGER', 'PORTFOLIO_OPTIMIZER', 'YIELD_FARMER', 'NFT_TRADER']),
    commonValidations.agentConfig,
    body('description').optional().isLength({ max: 500 }).withMessage('Description must be max 500 characters')
  ],

  update: [
    commonValidations.uuid(),
    commonValidations.stringLength('name', 3, 100).optional(),
    body('status').optional().isIn(['DRAFT', 'TESTING', 'DEPLOYED', 'PAUSED', 'ERROR']),
    commonValidations.agentConfig.optional()
  ],

  performance: [
    commonValidations.uuid(),
    commonValidations.timeRange
  ]
};

/**
 * Portfolio validation chains
 */
export const portfolioValidations = {
  create: [
    commonValidations.stringLength('name', 3, 100),
    body('description').optional().isLength({ max: 500 }),
    commonValidations.portfolioAllocations,
    body('riskProfile').isIn(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'CUSTOM']),
    commonValidations.currency().optional()
  ],

  update: [
    commonValidations.uuid(),
    commonValidations.stringLength('name', 3, 100).optional(),
    body('description').optional().isLength({ max: 500 }),
    commonValidations.portfolioAllocations.optional(),
    body('riskProfile').optional().isIn(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'CUSTOM'])
  ],

  rebalance: [
    commonValidations.uuid(),
    body('strategy').isIn(['PROPORTIONAL', 'THRESHOLD_BASED', 'TIME_BASED', 'VOLATILITY_WEIGHTED']),
    body('dryRun').optional().isBoolean()
  ]
};

/**
 * Payment validation chains
 */
export const paymentValidations = {
  create: [
    body('type').isIn(['SUBSCRIPTION', 'TRANSACTION_FEE', 'PROFIT_SHARE', 'WITHDRAWAL', 'DEPOSIT']),
    commonValidations.amount(),
    commonValidations.currency(),
    body('description').optional().isLength({ max: 500 }),
    commonValidations.json('metadata').optional()
  ],

  refund: [
    commonValidations.uuid(),
    body('reason').optional().isLength({ max: 500 }),
    body('partialAmount').optional().isFloat({ min: 0 })
  ]
};

/**
 * Analytics validation chains
 */
export const analyticsValidations = {
  portfolio: [
    commonValidations.uuid('portfolioId'),
    commonValidations.timeRange.optional(),
    body('benchmarkAsset').optional().isString(),
    body('includeProjections').optional().isBoolean()
  ],

  sentiment: [
    commonValidations.marketDataSymbols,
    commonValidations.timeRange.optional(),
    query('sources').optional().isArray()
  ],

  risk: [
    body('entityType').isIn(['portfolio', 'agent', 'strategy']),
    commonValidations.uuid('entityId'),
    body('riskFactors').optional().isArray(),
    body('timeHorizon').optional().isIn(['short', 'medium', 'long']),
    body('confidenceLevel').optional().isFloat({ min: 0.8, max: 0.99 })
  ]
};

/**
 * User validation chains
 */
export const userValidations = {
  register: [
    commonValidations.email(),
    commonValidations.password(),
    commonValidations.stringLength('username', 3, 30).optional(),
    commonValidations.stringLength('firstName', 1, 50).optional(),
    commonValidations.stringLength('lastName', 1, 50).optional(),
    body('acceptTerms').equals('true').withMessage('Must accept terms and conditions'),
    body('acceptPrivacy').equals('true').withMessage('Must accept privacy policy')
  ],

  login: [
    commonValidations.email(),
    body('password').notEmpty().withMessage('Password is required'),
    body('rememberMe').optional().isBoolean()
  ],

  updateProfile: [
    commonValidations.stringLength('username', 3, 30).optional(),
    commonValidations.stringLength('firstName', 1, 50).optional(),
    commonValidations.stringLength('lastName', 1, 50).optional(),
    commonValidations.phoneNumber().optional(),
    body('timezone').optional().isString(),
    body('currency').optional().isLength({ min: 3, max: 3 })
  ],

  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    commonValidations.password('newPassword'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
  ],

  resetPassword: [
    commonValidations.email()
  ]
};

/**
 * Create a validation middleware chain
 */
export function createValidationChain(...validations: ValidationChain[]): Array<ValidationChain | typeof handleValidationErrors> {
  return [...validations, handleValidationErrors];
}

/**
 * Validate request body size
 */
export function validateBodySize(maxSizeBytes: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSizeBytes) {
      logger.warn('Request body too large', { 
        contentLength, 
        maxSize: maxSizeBytes,
        endpoint: req.path,
        userId: req.user?.id
      });
      
      res.status(413).json({ 
        error: 'Request body too large',
        maxSize: maxSizeBytes,
        currentSize: contentLength
      });
      return;
    }
    
    next();
  };
}

/**
 * Validate file uploads
 */
export function validateFileUpload(options: {
  maxFiles?: number;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const files = req.files as Express.Multer.File[] | undefined;
    
    if (!files || files.length === 0) {
      next();
      return;
    }

    const errors: string[] = [];

    // Check file count
    if (options.maxFiles && files.length > options.maxFiles) {
      errors.push(`Maximum ${options.maxFiles} files allowed`);
    }

    // Validate each file
    for (const file of files) {
      // Check file size
      if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
        errors.push(`File ${file.originalname} exceeds maximum size of ${options.maxSizeBytes} bytes`);
      }

      // Check MIME type
      if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
        errors.push(`File ${file.originalname} has invalid type. Allowed: ${options.allowedMimeTypes.join(', ')}`);
      }

      // Check file extension
      if (options.allowedExtensions) {
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        if (!extension || !options.allowedExtensions.includes(extension)) {
          errors.push(`File ${file.originalname} has invalid extension. Allowed: ${options.allowedExtensions.join(', ')}`);
        }
      }
    }

    if (errors.length > 0) {
      logger.warn('File validation failed', { 
        errors, 
        fileCount: files.length,
        userId: req.user?.id
      });
      
      res.status(400).json({
        error: 'File validation failed',
        details: errors
      });
      return;
    }

    next();
  };
}

/**
 * Custom validation for business rules
 */
export const businessValidations = {
  /**
   * Validate trading hours
   */
  tradingHours: body('tradingHours').custom(hours => {
    if (!hours) return true;

    if (typeof hours !== 'object' || !hours.start || !hours.end) {
      throw new Error('Trading hours must include start and end times');
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(hours.start) || !timeRegex.test(hours.end)) {
      throw new Error('Trading hours must be in HH:MM format');
    }

    return true;
  }),

  /**
   * Validate wallet address
   */
  walletAddress: (field: string = 'address') =>
    body(field).custom(address => {
      if (!address) return true;

      // Basic validation for common wallet address formats
      const ethRegex = /^0x[a-fA-F0-9]{40}$/;
      const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

      if (!ethRegex.test(address) && !btcRegex.test(address) && !solanaRegex.test(address)) {
        throw new Error('Invalid wallet address format');
      }

      return true;
    }),

  /**
   * Validate trading pair
   */
  tradingPair: body('pair').custom(pair => {
    if (typeof pair !== 'string') {
      throw new Error('Trading pair must be a string');
    }

    const pairRegex = /^[A-Z]{2,6}[\/\-][A-Z]{2,6}$/;
    if (!pairRegex.test(pair)) {
      throw new Error('Trading pair must be in format BASE/QUOTE or BASE-QUOTE');
    }

    return true;
  }),

  /**
   * Validate price precision
   */
  pricePrecision: (field: string = 'price', maxDecimals: number = 8) =>
    body(field).custom(price => {
      if (typeof price !== 'number') return true;

      const decimals = (price.toString().split('.')[1] || '').length;
      if (decimals > maxDecimals) {
        throw new Error(`Price precision cannot exceed ${maxDecimals} decimal places`);
      }

      return true;
    })
};

/**
 * Middleware to log validation errors
 */
export function logValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.error('Validation errors detected', {
      errors: errors.array(),
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id,
      body: req.body,
      query: req.query,
      params: req.params
    });
  }
  
  next();
}

/**
 * Schema validation using custom schemas
 */
export function validateSchema(schema: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Schema validation failed', { 
        errors, 
        endpoint: req.path,
        userId: req.user?.id
      });

      res.status(400).json({
        error: 'Schema validation failed',
        details: errors
      });
      return;
    }

    // Replace request body with validated and transformed value
    req.body = value;
    next();
  };
}