import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { createClient } from '@redis/client';
import { Pool } from 'pg';
import pino from 'pino';

import { initializeMonitoring } from './agentflow/monitoring/metrics';
import { setupRoutes } from './agentflow/api/routes';
import { typeDefs, resolvers } from './agentflow/api/graphql';
import { QuDAGAdapter } from './agentflow/adapters/qudag/adapter';
import { WorkflowEngine } from './agentflow/core/workflows/engine';
import { PaymentProcessor } from './agentflow/core/finance/payment_processor';

// Initialize logger
const logger = pino({
  level: process.env.AGENTFLOW_LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Initialize database
const db = new Pool({
  connectionString: process.env.AGENTFLOW_DATABASE_URL,
  max: parseInt(process.env.AGENTFLOW_DATABASE_POOL_SIZE || '20'),
});

// Initialize Redis
const redis = createClient({
  url: process.env.AGENTFLOW_REDIS_URL,
  password: process.env.AGENTFLOW_REDIS_PASSWORD,
});

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.AGENTFLOW_WEBSOCKET_CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Initialize core services
async function initializeServices() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Connected to Redis');

    // Test database connection
    await db.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Initialize QuDAG adapter
    const qudag = new QuDAGAdapter({
      endpoint: process.env.AGENTFLOW_QUDAG_ENDPOINT!,
      apiKey: process.env.AGENTFLOW_QUDAG_API_KEY!,
      darkDomain: process.env.AGENTFLOW_QUDAG_DARK_DOMAIN!,
    });
    await qudag.initialize();
    logger.info('QuDAG adapter initialized');

    // Initialize Workflow Engine
    const workflowEngine = new WorkflowEngine(db, redis, io);
    await workflowEngine.initialize();
    logger.info('Workflow engine initialized');

    // Initialize Payment Processor
    const paymentProcessor = new PaymentProcessor({
      db,
      redis,
      provider: process.env.AGENTFLOW_PAYMENT_PROVIDER as 'stripe',
      apiKey: process.env.AGENTFLOW_STRIPE_API_KEY!,
    });
    await paymentProcessor.initialize();
    logger.info('Payment processor initialized');

    // Setup REST API routes
    setupRoutes(app, {
      db,
      redis,
      qudag,
      workflowEngine,
      paymentProcessor,
      logger,
    });

    // Initialize GraphQL server
    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
    });
    await apolloServer.start();

    app.use(
      '/graphql',
      expressMiddleware(apolloServer, {
        context: async ({ req }) => ({
          db,
          redis,
          qudag,
          workflowEngine,
          paymentProcessor,
          user: req.headers.authorization, // TODO: Implement proper auth
        }),
      })
    );

    // Initialize monitoring
    const metricsPort = parseInt(process.env.AGENTFLOW_PROMETHEUS_PORT || '9090');
    initializeMonitoring(metricsPort);
    logger.info(`Prometheus metrics available on port ${metricsPort}`);

    // Socket.io event handlers
    io.on('connection', (socket) => {
      logger.info('New WebSocket connection', { socketId: socket.id });

      socket.on('subscribe:workflow', (workflowId) => {
        socket.join(`workflow:${workflowId}`);
      });

      socket.on('subscribe:agent', (agentId) => {
        socket.join(`agent:${agentId}`);
      });

      socket.on('disconnect', () => {
        logger.info('WebSocket disconnected', { socketId: socket.id });
      });
    });

    // Start server
    const port = parseInt(process.env.AGENTFLOW_API_PORT || '3000');
    httpServer.listen(port, () => {
      logger.info(`AgentFlow server running on port ${port}`);
      logger.info(`GraphQL endpoint: http://localhost:${port}/graphql`);
      logger.info(`WebSocket server running on port ${port}`);
    });

  } catch (error) {
    logger.error('Failed to initialize services', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  await db.end();
  await redis.quit();
  
  process.exit(0);
});

// Start the application
initializeServices();