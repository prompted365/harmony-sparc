import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';
import { requestLogger } from './middleware/request-logger';
import { healthRouter } from './routes/health';
import { logger } from './utils/logger';

// Create Express application
const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting
app.use(rateLimiter);

// Health check routes
app.use('/health', healthRouter);

// API routes (to be added)
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'AgentFlow API Server',
    version: '1.0.0',
    status: 'operational'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: 'Resource not found',
      path: req.path,
      method: req.method
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const port = config.port;
const server = app.listen(port, () => {
  logger.info(`Server is running on port ${port} in ${config.nodeEnv} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;