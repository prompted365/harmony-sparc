/**
 * Metrics Collection Utility
 * High-performance metrics collection and aggregation
 */

interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

interface BusinessMetric {
  event: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface MetricsSnapshot {
  requests: {
    total: number;
    rate: number;
    errors: number;
    errorRate: number;
  };
  performance: {
    p50: number;
    p95: number;
    p99: number;
    avgResponseTime: number;
  };
  resources: {
    cpu: number;
    memory: number;
    connections: number;
  };
  business: Record<string, number>;
  timestamp: number;
}

export class MetricsCollector {
  private requests: RequestMetric[] = [];
  private performance: PerformanceMetric[] = [];
  private business: BusinessMetric[] = [];
  private maxHistorySize = 10000;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: { maxHistorySize?: number; cleanupIntervalMs?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize || 10000;
    
    // Clean up old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, options.cleanupIntervalMs || 300000);
  }

  private cleanup(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    this.requests = this.requests.filter(metric => metric.timestamp > cutoffTime);
    this.performance = this.performance.filter(metric => metric.timestamp > cutoffTime);
    this.business = this.business.filter(metric => metric.timestamp > cutoffTime);

    // Ensure we don't exceed max history size
    if (this.requests.length > this.maxHistorySize) {
      this.requests = this.requests.slice(-this.maxHistorySize);
    }
    if (this.performance.length > this.maxHistorySize) {
      this.performance = this.performance.slice(-this.maxHistorySize);
    }
    if (this.business.length > this.maxHistorySize) {
      this.business = this.business.slice(-this.maxHistorySize);
    }
  }

  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    metadata?: {
      userId?: string;
      userAgent?: string;
      ip?: string;
    }
  ): void {
    this.requests.push({
      method,
      path,
      statusCode,
      responseTime,
      timestamp: Date.now(),
      userId: metadata?.userId,
      userAgent: metadata?.userAgent,
      ip: metadata?.ip
    });
  }

  recordPerformance(
    name: string,
    value: number,
    unit: string = 'ms',
    tags?: Record<string, string>
  ): void {
    this.performance.push({
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    });
  }

  recordBusiness(
    event: string,
    value: number = 1,
    metadata?: Record<string, any>
  ): void {
    this.business.push({
      event,
      value,
      timestamp: Date.now(),
      metadata
    });
  }

  recordMemorySpike(path: string, memoryDelta: number): void {
    this.recordPerformance('memory_spike', memoryDelta, 'bytes', { path });
  }

  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Filter recent requests (last hour)
    const recentRequests = this.requests.filter(r => r.timestamp > oneHourAgo);
    const totalRequests = recentRequests.length;
    const errorRequests = recentRequests.filter(r => r.statusCode >= 400).length;
    
    // Calculate request rate (requests per second)
    const requestRate = totalRequests > 0 ? totalRequests / 3600 : 0;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    // Calculate response time percentiles
    const responseTimes = recentRequests.map(r => r.responseTime).sort((a, b) => a - b);
    const percentiles = this.calculatePercentiles(responseTimes);
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;

    // Aggregate business metrics
    const businessMetrics: Record<string, number> = {};
    this.business
      .filter(b => b.timestamp > oneHourAgo)
      .forEach(metric => {
        businessMetrics[metric.event] = (businessMetrics[metric.event] || 0) + metric.value;
      });

    // Get system resources
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      requests: {
        total: totalRequests,
        rate: requestRate,
        errors: errorRequests,
        errorRate
      },
      performance: {
        ...percentiles,
        avgResponseTime
      },
      resources: {
        cpu: this.calculateCpuPercentage(cpuUsage),
        memory: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        connections: this.getActiveConnections()
      },
      business: businessMetrics,
      timestamp: now
    };
  }

  private calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      p50: sorted[Math.floor(length * 0.5)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)]
    };
  }

  private calculateCpuPercentage(cpuUsage: NodeJS.CpuUsage): number {
    // Simple CPU percentage calculation
    const totalTime = cpuUsage.user + cpuUsage.system;
    return (totalTime / 1000000) * 100; // Convert microseconds to percentage
  }

  private getActiveConnections(): number {
    // This would typically come from the server instance
    // For now, return a mock value
    return Math.floor(Math.random() * 100) + 10;
  }

  getRequestMetrics(options: {
    timeRange?: number;
    method?: string;
    path?: string;
    statusCode?: number;
  } = {}): RequestMetric[] {
    const { timeRange = 3600000, method, path, statusCode } = options; // Default 1 hour
    const cutoffTime = Date.now() - timeRange;

    return this.requests.filter(metric => {
      if (metric.timestamp < cutoffTime) return false;
      if (method && metric.method !== method) return false;
      if (path && !metric.path.includes(path)) return false;
      if (statusCode && metric.statusCode !== statusCode) return false;
      return true;
    });
  }

  getPerformanceMetrics(name?: string, timeRange: number = 3600000): PerformanceMetric[] {
    const cutoffTime = Date.now() - timeRange;
    return this.performance.filter(metric => {
      if (metric.timestamp < cutoffTime) return false;
      if (name && metric.name !== name) return false;
      return true;
    });
  }

  getBusinessMetrics(event?: string, timeRange: number = 3600000): BusinessMetric[] {
    const cutoffTime = Date.now() - timeRange;
    return this.business.filter(metric => {
      if (metric.timestamp < cutoffTime) return false;
      if (event && metric.event !== event) return false;
      return true;
    });
  }

  getTopEndpoints(limit: number = 10, timeRange: number = 3600000): Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
    errorRate: number;
  }> {
    const metrics = this.getRequestMetrics({ timeRange });
    const endpointStats = new Map<string, {
      count: number;
      totalResponseTime: number;
      errors: number;
    }>();

    metrics.forEach(metric => {
      const endpoint = `${metric.method} ${metric.path}`;
      const stats = endpointStats.get(endpoint) || { count: 0, totalResponseTime: 0, errors: 0 };
      
      stats.count++;
      stats.totalResponseTime += metric.responseTime;
      if (metric.statusCode >= 400) {
        stats.errors++;
      }
      
      endpointStats.set(endpoint, stats);
    });

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgResponseTime: stats.totalResponseTime / stats.count,
        errorRate: (stats.errors / stats.count) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getSlowestEndpoints(limit: number = 10, timeRange: number = 3600000): Array<{
    endpoint: string;
    avgResponseTime: number;
    p95ResponseTime: number;
    requestCount: number;
  }> {
    const metrics = this.getRequestMetrics({ timeRange });
    const endpointTimes = new Map<string, number[]>();

    metrics.forEach(metric => {
      const endpoint = `${metric.method} ${metric.path}`;
      const times = endpointTimes.get(endpoint) || [];
      times.push(metric.responseTime);
      endpointTimes.set(endpoint, times);
    });

    return Array.from(endpointTimes.entries())
      .map(([endpoint, times]) => {
        const sorted = times.sort((a, b) => a - b);
        const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        
        return {
          endpoint,
          avgResponseTime: avg,
          p95ResponseTime: p95,
          requestCount: times.length
        };
      })
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, limit);
  }

  getErrorAnalysis(timeRange: number = 3600000): Array<{
    statusCode: number;
    count: number;
    percentage: number;
    topEndpoints: string[];
  }> {
    const metrics = this.getRequestMetrics({ timeRange });
    const errorMetrics = metrics.filter(m => m.statusCode >= 400);
    const totalErrors = errorMetrics.length;

    const statusCodeCounts = new Map<number, number>();
    const statusCodeEndpoints = new Map<number, Set<string>>();

    errorMetrics.forEach(metric => {
      const count = statusCodeCounts.get(metric.statusCode) || 0;
      statusCodeCounts.set(metric.statusCode, count + 1);

      const endpoints = statusCodeEndpoints.get(metric.statusCode) || new Set();
      endpoints.add(`${metric.method} ${metric.path}`);
      statusCodeEndpoints.set(metric.statusCode, endpoints);
    });

    return Array.from(statusCodeCounts.entries())
      .map(([statusCode, count]) => ({
        statusCode,
        count,
        percentage: (count / totalErrors) * 100,
        topEndpoints: Array.from(statusCodeEndpoints.get(statusCode) || []).slice(0, 5)
      }))
      .sort((a, b) => b.count - a.count);
  }

  export(): {
    requests: RequestMetric[];
    performance: PerformanceMetric[];
    business: BusinessMetric[];
  } {
    return {
      requests: [...this.requests],
      performance: [...this.performance],
      business: [...this.business]
    };
  }

  import(data: {
    requests?: RequestMetric[];
    performance?: PerformanceMetric[];
    business?: BusinessMetric[];
  }): void {
    if (data.requests) {
      this.requests.push(...data.requests);
    }
    if (data.performance) {
      this.performance.push(...data.performance);
    }
    if (data.business) {
      this.business.push(...data.business);
    }
    
    this.cleanup();
  }

  reset(): void {
    this.requests = [];
    this.performance = [];
    this.business = [];
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.reset();
  }
}

// Performance monitoring decorator
export function monitorPerformance(name: string, metrics: MetricsCollector) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        metrics.recordPerformance(name, Date.now() - startTime);
        return result;
      } catch (error) {
        metrics.recordPerformance(`${name}_error`, Date.now() - startTime);
        throw error;
      }
    };

    return descriptor;
  };
}

// Business event tracker
export class BusinessEventTracker {
  constructor(private metrics: MetricsCollector) {}

  trackUserRegistration(userId: string): void {
    this.metrics.recordBusiness('user_registration', 1, { userId });
  }

  trackWorkflowCreated(workflowId: string, userId: string): void {
    this.metrics.recordBusiness('workflow_created', 1, { workflowId, userId });
  }

  trackWorkflowExecuted(workflowId: string, duration: number, success: boolean): void {
    this.metrics.recordBusiness('workflow_executed', 1, { workflowId, duration, success });
  }

  trackAgentAssigned(agentId: string, taskId: string): void {
    this.metrics.recordBusiness('agent_assigned', 1, { agentId, taskId });
  }

  trackPaymentProcessed(amount: number, token: string, success: boolean): void {
    this.metrics.recordBusiness('payment_processed', amount, { token, success });
  }

  trackResourceExchanged(resourceType: string, amount: number, price: number): void {
    this.metrics.recordBusiness('resource_exchanged', amount, { resourceType, price });
  }
}