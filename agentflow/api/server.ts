import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { healthRouter } from './routes/health';
import { logger } from './utils/logger';

// Import API routes from the routes directory
import { financialRouter } from './routes/financial';
import { qudagRouter } from './routes/qudag';
import { agentRouter } from './routes/agents';
import { workflowRouter } from './routes/workflows';

export class Server {
  private app: Application;
  private port: number;
  private config: typeof config;
  private isListening: boolean = false;

  constructor(options?: Partial<typeof config>) {
    this.config = { ...config, ...options };
    this.app = express();
    this.port = this.config.port;
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for API
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      optionsSuccessStatus: 200
    }));
    
    // Compression for better performance
    this.app.use(compression());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use(requestLogger);
    
    // Rate limiting
    this.app.use('/api/', rateLimitMiddleware());
    
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check route
    this.app.use('/health', healthRouter);
    
    // API v1 routes
    this.app.use('/api/v1/financial', financialRouter);
    this.app.use('/api/v1/qudag', qudagRouter);
    this.app.use('/api/v1/agents', agentRouter);
    this.app.use('/api/v1/workflows', workflowRouter);
    
    // Root route
    this.app.get('/', (_req, res) => {
      res.json({
        name: 'AgentFlow API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          financial: '/api/v1/financial',
          qudag: '/api/v1/qudag',
          agents: '/api/v1/agents',
          workflows: '/api/v1/workflows'
        }
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
    
    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        this.isListening = true;
        logger.info(`🚀 Server is running on port ${this.port}`);
        logger.info(`🏥 Health check: http://localhost:${this.port}/health`);
        logger.info(`📝 Environment: ${config.env}`);
        resolve();
      });
    });
  }

  public getApp(): Application {
    return this.app;
  }

  public async stop(): Promise<void> {
    // In a real implementation, you would close the server
    logger.info('Server stopping...');
  }

  public isHealthy(): boolean {
    // Simple health check
    return true;
  }

  public getMetrics(): any {
    // Simple metrics object
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  // Event emitter methods
  public on(event: string, handler: Function): void {
    // Simple event handling
    if (event === 'started' && this.isListening) {
      handler();
    }
  }
}

// Export createServer function for the main index
export default function createServer() {
  return new Server();
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
  });
}