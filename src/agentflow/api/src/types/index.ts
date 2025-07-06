export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  responseTime: string;
  checks?: Record<string, any>;
}

export interface PerformanceMetrics {
  requestsPerSecond: number;
  averageResponseTime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  systemLoad: number[];
}

export interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  ip: string;
  userAgent: string;
}