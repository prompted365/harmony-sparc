/**
 * Health Check API Routes
 * System health monitoring and status endpoints
 */

import { Router, Response } from 'express';
import { 
  ApiRequest, 
  ApiResponse, 
  HealthStatus,
  ServiceHealth,
  MetricsSnapshot
} from '../types';
import { asyncHandler } from '../utils/async-handler';

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    connections: number;
    throughput: {
      incoming: number;
      outgoing: number;
    };
  };
}

class HealthMonitor {
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeHistory: number[] = [];

  incrementRequest(): void {
    this.requestCount++;
  }

  incrementError(): void {
    this.errorCount++;
  }

  recordResponseTime(time: number): void {
    this.responseTimeHistory.push(time);
    // Keep only last 1000 response times
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory.shift();
    }
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  getSystemMetrics(): SystemMetrics {
    // Mock system metrics (would use actual system monitoring in production)
    return {
      cpu: {
        usage: Math.random() * 100,
        loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
      },
      memory: {
        total: 8192,
        used: Math.random() * 4096 + 2048,
        free: 0,
        percentage: 0
      },
      disk: {
        total: 512000,
        used: Math.random() * 256000 + 128000,
        free: 0,
        percentage: 0
      },
      network: {
        connections: Math.floor(Math.random() * 100) + 10,
        throughput: {
          incoming: Math.random() * 1000,
          outgoing: Math.random() * 1000
        }
      }
    };
  }

  calculatePercentiles(): { p50: number; p95: number; p99: number } {
    if (this.responseTimeHistory.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      p50: sorted[Math.floor(length * 0.5)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)]
    };
  }

  async checkService(name: string, _url?: string): Promise<ServiceHealth> {
    // Mock service health checks
    const isHealthy = Math.random() > 0.1; // 90% healthy
    const latency = isHealthy ? Math.random() * 100 + 10 : 0;

    return {
      name,
      status: isHealthy,
      latency: isHealthy ? latency : undefined,
      error: isHealthy ? undefined : 'Service unavailable'
    };
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const services = await Promise.all([
      this.checkService('Database'),
      this.checkService('QuDAG Network'),
      this.checkService('Workflow Engine'),
      this.checkService('Agent Manager'),
      this.checkService('Financial Service'),
      this.checkService('Cache'),
      this.checkService('Message Queue')
    ]);

    const unhealthyServices = services.filter(service => !service.status);
    let status: HealthStatus['status'] = 'healthy';

    if (unhealthyServices.length > 0) {
      status = unhealthyServices.length >= services.length / 2 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      services,
      timestamp: new Date(),
      uptime: this.getUptime()
    };
  }

  getMetricsSnapshot(): MetricsSnapshot {
    const systemMetrics = this.getSystemMetrics();
    const percentiles = this.calculatePercentiles();

    // Calculate memory and disk percentages
    systemMetrics.memory.free = systemMetrics.memory.total - systemMetrics.memory.used;
    systemMetrics.memory.percentage = (systemMetrics.memory.used / systemMetrics.memory.total) * 100;
    
    systemMetrics.disk.free = systemMetrics.disk.total - systemMetrics.disk.used;
    systemMetrics.disk.percentage = (systemMetrics.disk.used / systemMetrics.disk.total) * 100;

    const uptime = this.getUptime();
    const requestRate = this.requestCount / (uptime / 1000); // requests per second

    return {
      requests: {
        total: this.requestCount,
        rate: requestRate,
        errors: this.errorCount
      },
      performance: percentiles,
      resources: {
        cpu: systemMetrics.cpu.usage,
        memory: systemMetrics.memory.percentage,
        connections: systemMetrics.network.connections
      }
    };
  }

  isHealthy(): boolean {
    const metrics = this.getSystemMetrics();
    
    // Consider system healthy if:
    // - CPU usage < 90%
    // - Memory usage < 90%
    // - Disk usage < 95%
    // - Error rate < 5%
    
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    
    return (
      metrics.cpu.usage < 90 &&
      metrics.memory.percentage < 90 &&
      metrics.disk.percentage < 95 &&
      errorRate < 5
    );
  }

  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeHistory = [];
    this.startTime = Date.now();
  }
}

// Initialize health monitor
const healthMonitor = new HealthMonitor();

// Create router
const router = Router();

/**
 * GET /
 * Basic health check
 */
router.get('/', asyncHandler(async (req: ApiRequest, res: Response) => {
  const startTime = Date.now();
  
  healthMonitor.incrementRequest();

  const isHealthy = healthMonitor.isHealthy();
  const uptime = healthMonitor.getUptime();

  const responseTime = Date.now() - startTime;
  healthMonitor.recordResponseTime(responseTime);

  const response: ApiResponse = {
    success: true,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime,
      responseTime
    },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.status(isHealthy ? 200 : 503).json(response);
}));

/**
 * GET /detailed
 * Detailed health check with service status
 */
router.get('/detailed', asyncHandler(async (req: ApiRequest, res: Response) => {
  const startTime = Date.now();
  
  healthMonitor.incrementRequest();

  try {
    const healthStatus = await healthMonitor.getHealthStatus();
    
    const responseTime = Date.now() - startTime;
    healthMonitor.recordResponseTime(responseTime);

    const response: ApiResponse<HealthStatus> = {
      success: true,
      data: {
        ...healthStatus,
        uptime: healthMonitor.getUptime()
      },
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!
      }
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    healthMonitor.incrementError();
    
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        details: (error as Error).message
      }
    } as ApiResponse);
  }
}));

/**
 * GET /metrics
 * System metrics and performance data
 */
router.get('/metrics', asyncHandler(async (req: ApiRequest, res: Response) => {
  const startTime = Date.now();
  
  healthMonitor.incrementRequest();

  const metrics = healthMonitor.getMetricsSnapshot();
  
  const responseTime = Date.now() - startTime;
  healthMonitor.recordResponseTime(responseTime);

  const response: ApiResponse<MetricsSnapshot> = {
    success: true,
    data: metrics,
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /system
 * System resource information
 */
router.get('/system', asyncHandler(async (req: ApiRequest, res: Response) => {
  const startTime = Date.now();
  
  healthMonitor.incrementRequest();

  const systemMetrics = healthMonitor.getSystemMetrics();
  
  const responseTime = Date.now() - startTime;
  healthMonitor.recordResponseTime(responseTime);

  const response: ApiResponse = {
    success: true,
    data: {
      ...systemMetrics,
      uptime: healthMonitor.getUptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /services
 * Individual service health status
 */
router.get('/services', asyncHandler(async (req: ApiRequest, res: Response) => {
  const startTime = Date.now();
  
  healthMonitor.incrementRequest();

  try {
    const services = await Promise.all([
      healthMonitor.checkService('Database', process.env.DATABASE_URL),
      healthMonitor.checkService('QuDAG Network', process.env.QUDAG_NODE_URL),
      healthMonitor.checkService('Workflow Engine'),
      healthMonitor.checkService('Agent Manager'),
      healthMonitor.checkService('Financial Service'),
      healthMonitor.checkService('Cache', process.env.REDIS_URL),
      healthMonitor.checkService('Message Queue', process.env.RABBITMQ_URL)
    ]);

    const responseTime = Date.now() - startTime;
    healthMonitor.recordResponseTime(responseTime);

    const response: ApiResponse = {
      success: true,
      data: services,
      meta: {
        timestamp: Date.now(),
        version: '1.0.0',
        requestId: req.requestId!
      }
    };

    res.json(response);
  } catch (error) {
    healthMonitor.incrementError();
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_CHECK_FAILED',
        message: 'Service health check failed',
        details: (error as Error).message
      }
    } as ApiResponse);
  }
}));

/**
 * GET /readiness
 * Readiness probe for Kubernetes
 */
router.get('/readiness', asyncHandler(async (_req: ApiRequest, res: Response) => {
  healthMonitor.incrementRequest();

  const healthStatus = await healthMonitor.getHealthStatus();
  const isReady = healthStatus.status !== 'unhealthy';

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /liveness
 * Liveness probe for Kubernetes
 */
router.get('/liveness', asyncHandler(async (_req: ApiRequest, res: Response) => {
  healthMonitor.incrementRequest();

  // Simple liveness check - server is running
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: healthMonitor.getUptime()
  });
}));

/**
 * POST /reset-metrics
 * Reset metrics (for testing/debugging)
 */
router.post('/reset-metrics', asyncHandler(async (req: ApiRequest, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Metrics reset not allowed in production'
      }
    } as ApiResponse);
    return;
  }

  healthMonitor.reset();

  const response: ApiResponse = {
    success: true,
    data: { reset: true },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

/**
 * GET /version
 * API version information
 */
router.get('/version', asyncHandler(async (req: ApiRequest, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      name: 'AgentFlow API',
      version: '1.0.0',
      build: process.env.BUILD_NUMBER || 'dev',
      commit: process.env.GIT_COMMIT || 'unknown',
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: Date.now(),
      version: '1.0.0',
      requestId: req.requestId!
    }
  };

  res.json(response);
}));

// Export health monitor for use in other middleware
export { healthMonitor };
export { router as healthRouter };