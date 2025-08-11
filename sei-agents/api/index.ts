import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import { readFileSync } from 'fs';
import { join } from 'path';

// Middleware
import { 
  authMiddleware, 
  optionalAuthMiddleware, 
  apiKeyMiddleware,
  validateAccountStatus,
  apiUsageLogger,
  authErrorHandler
} from './middleware/authentication';
import { 
  globalRateLimit, 
  rateLimitHeaders,
  getRateLimitStats 
} from './middleware/rateLimit';
import { 
  errorHandler, 
  notFoundHandler, 
  setupGlobalErrorHandlers,
  APIError 
} from './middleware/errorHandler';
import { validateBodySize } from './middleware/validation';

// Routes
import agentRoutes from './rest/routes/agents';
import portfolioRoutes from './rest/routes/portfolio';
import arbitrageRoutes from './rest/routes/arbitrage';
import paymentRoutes from './rest/routes/payments';
import analyticsRoutes from './rest/routes/analytics';

// GraphQL Resolvers
import { agentResolvers } from './graphql/resolvers/agentResolvers';
import { portfolioResolvers } from './graphql/resolvers/portfolioResolvers';
import { paymentResolvers } from './graphql/resolvers/paymentResolvers';
import { analyticsResolvers } from './graphql/resolvers/analyticsResolvers';

// WebSocket Handlers
import { agentWebSocketHandler } from './websocket/handlers/agentUpdates';
import { marketDataWebSocketHandler } from './websocket/handlers/marketData';
import { notificationWebSocketHandler } from './websocket/handlers/notifications';

// Services and utilities
import { createContext } from './graphql/context';
import { Logger } from '../utils/logger';

const logger = new Logger('APIServer');

// Setup global error handlers
setupGlobalErrorHandlers();

export class APIServer {
  private app: express.Application;
  private httpServer: any;
  private wsServer: WebSocketServer;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wsServer = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws'
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupGraphQL();
    this.setupWebSockets();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", "wss:", "https:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://nexus-ai.com',
          'https://app.nexus-ai.com'
        ];
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'), false);
        }
      },
      credentials: true,
      optionsSuccessStatus: 200
    }));

    // Request parsing middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging and rate limiting
    this.app.use(apiUsageLogger);
    this.app.use(rateLimitHeaders);
    this.app.use(globalRateLimit);

    // Body size validation for specific endpoints
    this.app.use('/api/*/upload', validateBodySize(50 * 1024 * 1024)); // 50MB for uploads
    this.app.use('/api/*', validateBodySize(10 * 1024 * 1024)); // 10MB for regular requests

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || 
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.set('X-Request-ID', req.headers['x-request-id'] as string);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint (no authentication required)
    this.app.get('/api/health', (req, res) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
          database: 'healthy', // Should be checked against actual DB
          cache: 'healthy',    // Should be checked against actual cache
          marketData: 'healthy' // Should be checked against market data service
        }
      };

      res.json(healthStatus);
    });

    // API documentation
    try {
      const swaggerDocument = JSON.parse(
        readFileSync(join(__dirname, 'docs/openapi.json'), 'utf8')
      );
      
      this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        customSiteTitle: 'NEXUS AI DeFi API Documentation',
        customCss: '.swagger-ui .topbar { display: none }',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          tryItOutEnabled: true,
          filter: true,
          displayOperationId: true
        }
      }));
    } catch (error) {
      logger.warn('Failed to load OpenAPI documentation', { error: (error as any).message });
    }

    // Rate limit stats endpoint (admin only)
    this.app.get('/api/admin/rate-limits', 
      authMiddleware,
      (req, res, next) => {
        if (req.user?.role !== 'admin') {
          throw new APIError('Admin access required', 403, 'FORBIDDEN');
        }
        next();
      },
      (req, res) => {
        res.json({
          stats: getRateLimitStats(),
          timestamp: new Date().toISOString()
        });
      }
    );

    // REST API routes
    this.app.use('/api/agents', authMiddleware, validateAccountStatus, agentRoutes);
    this.app.use('/api/portfolios', authMiddleware, validateAccountStatus, portfolioRoutes);
    this.app.use('/api/arbitrage', authMiddleware, validateAccountStatus, arbitrageRoutes);
    this.app.use('/api/payments', authMiddleware, validateAccountStatus, paymentRoutes);
    this.app.use('/api/analytics', authMiddleware, validateAccountStatus, analyticsRoutes);

    // API key protected routes (for system integrations)
    this.app.use('/api/internal', apiKeyMiddleware);
    // Add internal routes here

    // WebSocket stats endpoint
    this.app.get('/api/websocket/stats', 
      authMiddleware,
      (req, res) => {
        const stats = {
          agents: agentWebSocketHandler.getStats(),
          marketData: marketDataWebSocketHandler.getStats(),
          notifications: notificationWebSocketHandler.getStats()
        };
        res.json(stats);
      }
    );

    // Catch-all route for undefined endpoints
    this.app.all('*', notFoundHandler);
  }

  private setupGraphQL(): void {
    try {
      // Load GraphQL schema
      const schemaString = readFileSync(
        join(__dirname, 'graphql/schema.graphql'), 
        'utf8'
      );
      const schema = buildSchema(schemaString);

      // Combine all resolvers
      const resolvers = {
        ...agentResolvers,
        ...portfolioResolvers,
        ...paymentResolvers,
        ...analyticsResolvers
      };

      // GraphQL endpoint
      this.app.use('/graphql', 
        optionalAuthMiddleware, // GraphQL has its own auth handling
        graphqlHTTP(async (req) => ({
          schema,
          rootValue: resolvers,
          context: await createContext({ req }),
          graphiql: process.env.NODE_ENV === 'development',
          introspection: process.env.NODE_ENV !== 'production',
          formatError: (error: any) => {
            logger.error('GraphQL Error', {
              message: (error as any).message,
              stack: error.stack,
              source: error.source,
              positions: error.positions,
              path: error.path,
              userId: req.user?.id
            });

            // Don't expose internal errors in production
            if (process.env.NODE_ENV === 'production' && !(error as any).message.startsWith('GraphQL')) {
              return new Error('Internal server error');
            }

            return error;
          }
        }))
      );

      logger.info('GraphQL endpoint initialized at /graphql');
    } catch (error) {
      logger.error('Failed to setup GraphQL', { error: (error as any).message });
    }
  }

  private setupWebSockets(): void {
    this.wsServer.on('connection', (ws, request) => {
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const pathname = url.pathname;

      logger.info('WebSocket connection established', { 
        path: pathname,
        origin: request.headers.origin,
        userAgent: request.headers['user-agent']
      });

      // Route to appropriate handler based on path
      if (pathname.includes('/agents')) {
        agentWebSocketHandler.handleConnection(ws, request);
      } else if (pathname.includes('/market')) {
        marketDataWebSocketHandler.handleConnection(ws, request);
      } else if (pathname.includes('/notifications')) {
        notificationWebSocketHandler.handleConnection(ws, request);
      } else {
        // Default to notifications handler
        notificationWebSocketHandler.handleConnection(ws, request);
      }
    });

    this.wsServer.on('error', (error) => {
      logger.error('WebSocket server error', { error: (error as any).message });
    });

    logger.info('WebSocket server initialized on /ws');
  }

  private setupErrorHandling(): void {
    // Authentication error handler
    this.app.use(authErrorHandler);

    // Main error handler (must be last)
    this.app.use(errorHandler);

    // Handle server errors
    this.httpServer.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof this.port === 'string' 
        ? 'Pipe ' + this.port 
        : 'Port ' + this.port;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
        
        this.wsServer.close(() => {
          logger.info('WebSocket server closed');
          logger.info('Graceful shutdown completed');
          process.exit(0);
        });
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        logger.info('NEXUS AI DeFi API Server started', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          graphql: '/graphql',
          websocket: '/ws',
          docs: '/api/docs',
          health: '/api/health'
        });
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        this.wsServer.close(() => {
          logger.info('API Server stopped');
          resolve();
        });
      });
    });
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getHttpServer(): any {
    return this.httpServer;
  }

  public getWebSocketServer(): WebSocketServer {
    return this.wsServer;
  }
}

// Export singleton instance
export const apiServer = new APIServer(
  parseInt(process.env.PORT || '3000', 10)
);

// Start server if this file is run directly
if (require.main === module) {
  apiServer.start().catch((error) => {
    logger.error('Failed to start API server', { error: (error as any).message });
    process.exit(1);
  });
}

// Export function to start API server
export const startAPIServer = async (port?: number): Promise<APIServer> => {
  const server = new APIServer(port || parseInt(process.env.PORT || '3000', 10));
  await server.start();
  return server;
};

export default APIServer;