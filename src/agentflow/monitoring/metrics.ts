import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import express from 'express';

// Create a Registry
const register = new Registry();

// Collect default metrics
collectDefaultMetrics({ register });

// Workflow metrics
export const workflowsCreated = new Counter({
  name: 'agentflow_workflows_created_total',
  help: 'Total number of workflows created',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const workflowExecutionDuration = new Histogram({
  name: 'agentflow_workflow_execution_duration_ms',
  help: 'Workflow execution duration in milliseconds',
  labelNames: ['type', 'status'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

export const activeWorkflows = new Gauge({
  name: 'agentflow_active_workflows',
  help: 'Number of currently active workflows',
  labelNames: ['type'],
  registers: [register],
});

// Transaction metrics
export const transactionLatency = new Histogram({
  name: 'agentflow_transaction_latency_ms',
  help: 'Transaction processing latency in milliseconds',
  labelNames: ['asset_type', 'status'],
  buckets: [10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
});

export const transactionVolume = new Counter({
  name: 'agentflow_transaction_volume_total',
  help: 'Total transaction volume in USD',
  labelNames: ['asset_type'],
  registers: [register],
});

export const walletBalance = new Gauge({
  name: 'agentflow_wallet_balance_usd',
  help: 'Current wallet balance in USD',
  labelNames: ['wallet_id', 'asset_type'],
  registers: [register],
});

// API metrics
export const apiResponseTime = new Histogram({
  name: 'agentflow_api_response_time_ms',
  help: 'API endpoint response time in milliseconds',
  labelNames: ['endpoint', 'method', 'status_code'],
  buckets: [10, 25, 50, 100, 250],
  registers: [register],
});

export const apiRequestsTotal = new Counter({
  name: 'agentflow_api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['endpoint', 'method', 'status_code'],
  registers: [register],
});

export const apiRequestsPerSecond = new Gauge({
  name: 'agentflow_api_requests_per_second',
  help: 'API requests per second (moving average)',
  labelNames: ['endpoint'],
  registers: [register],
});

// QuDAG metrics
export const qudagOperations = new Counter({
  name: 'agentflow_qudag_operations_total',
  help: 'Total QuDAG operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const qudagLatency = new Histogram({
  name: 'agentflow_qudag_latency_ms',
  help: 'QuDAG operation latency',
  labelNames: ['operation'],
  buckets: [25, 50, 100, 250, 500, 1000],
  registers: [register],
});

// Agent metrics
export const agentTasks = new Counter({
  name: 'agentflow_agent_tasks_total',
  help: 'Total agent tasks executed',
  labelNames: ['agent_type', 'status'],
  registers: [register],
});

export const agentPerformance = new Histogram({
  name: 'agentflow_agent_performance_score',
  help: 'Agent performance score (0-100)',
  labelNames: ['agent_type'],
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [register],
});

// System metrics
export const cacheHitRate = new Gauge({
  name: 'agentflow_cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'],
  registers: [register],
});

export const databaseConnections = new Gauge({
  name: 'agentflow_database_connections',
  help: 'Number of active database connections',
  labelNames: ['status'],
  registers: [register],
});

export const redisOperations = new Counter({
  name: 'agentflow_redis_operations_total',
  help: 'Total Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// Initialize metrics server
export function initializeMonitoring(port: number = 9090): void {
  const app = express();

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      res.status(500).end(error);
    }
  });

  app.listen(port, () => {
    console.log(`Metrics server listening on port ${port}`);
  });
}

// Helper to measure async operation duration
export async function measureDuration<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  operation: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  try {
    return await operation();
  } finally {
    end();
  }
}

// Middleware for Express to track API metrics
export function apiMetricsMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const labels = {
        endpoint: req.route?.path || 'unknown',
        method: req.method,
        status_code: res.statusCode.toString(),
      };
      
      apiResponseTime.observe(labels, duration);
      apiRequestsTotal.inc(labels);
    });
    
    next();
  };
}