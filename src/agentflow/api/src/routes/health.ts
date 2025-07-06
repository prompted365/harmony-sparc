import { Router, Request, Response } from 'express';
import os from 'os';
import { config } from '../config';

export const healthRouter = Router();

// Basic health check - must respond in <100ms
healthRouter.get('/', (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: `${Date.now() - startTime}ms`
  });
});

// Liveness probe - minimal check
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe - more comprehensive check
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: any = {
    api: 'ready',
    timestamp: new Date().toISOString()
  };
  
  try {
    // Add database connectivity check here when implemented
    // checks.database = await checkDatabaseConnection();
    
    // Add external service checks here
    // checks.redis = await checkRedisConnection();
    
    const responseTime = Date.now() - startTime;
    
    res.status(200).json({
      status: 'ready',
      checks,
      responseTime: `${responseTime}ms`
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      checks
    });
  }
});

// Detailed health information
healthRouter.get('/detailed', (_req: Request, res: Response) => {
  const startTime = Date.now();
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      process: process.uptime(),
      system: os.uptime()
    },
    memory: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
    },
    system: {
      platform: os.platform(),
      cpus: os.cpus().length,
      loadAverage: os.loadavg(),
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`
    },
    config: {
      env: config.nodeEnv,
      port: config.port,
      rateLimitMax: config.rateLimitMax
    },
    responseTime: `${Date.now() - startTime}ms`
  });
});