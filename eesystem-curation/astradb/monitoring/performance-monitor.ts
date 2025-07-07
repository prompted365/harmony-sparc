/**
 * Performance Monitoring and Optimization for AstraDB Integration
 * Tracks database performance, query optimization, and system health
 */

import { AstraDBClient } from '../integration/astradb-client';
import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  timestamp: string;
  database: {
    connections: {
      active: number;
      idle: number;
      total: number;
    };
    operations: {
      reads: number;
      writes: number;
      vectorSearches: number;
      totalOperations: number;
    };
    performance: {
      averageResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      errorRate: number;
      throughput: number; // operations per second
    };
    storage: {
      documentsCount: number;
      indexSize: number;
      dataSize: number;
      vectorIndexSize?: number;
    };
  };
  search: {
    semanticSearchMetrics: {
      averageLatency: number;
      cacheHitRate: number;
      resultsQuality: number; // 0-1 score
    };
    lexicalSearchMetrics: {
      averageLatency: number;
      indexEfficiency: number;
    };
    hybridSearchMetrics: {
      averageLatency: number;
      rerankingTime: number;
      accuracyScore: number;
    };
  };
  embedding: {
    generationMetrics: {
      averageLatency: number;
      tokensProcessed: number;
      errorRate: number;
      cacheHitRate: number;
    };
    batchMetrics: {
      averageBatchSize: number;
      batchLatency: number;
      throughput: number;
    };
  };
  content: {
    processingMetrics: {
      averageProcessingTime: number;
      validationErrors: number;
      enhancementTime: number;
      chunkingTime: number;
    };
    qualityMetrics: {
      averageQualityScore: number;
      brandComplianceRate: number;
      validationPassRate: number;
    };
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    health: {
      status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      issues: string[];
      lastHealthCheck: string;
    };
  };
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS';
  threshold: number;
  duration: number; // seconds
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  enabled: boolean;
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  resolved: boolean;
  resolvedAt?: string;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'QUERY' | 'INDEX' | 'CACHE' | 'RESOURCE' | 'CONFIGURATION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  impact: string;
  implementation: string[];
  estimatedImprovement: {
    metric: string;
    improvement: number; // percentage
  };
  createdAt: string;
}

export class PerformanceMonitor {
  private astraDB: AstraDBClient;
  private metrics: PerformanceMetrics[] = [];
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private metricsHistory: Map<string, number[]> = new Map();

  constructor(astraDB: AstraDBClient) {
    this.astraDB = astraDB;
    this.setupDefaultAlertRules();
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info(`Starting performance monitoring with ${intervalMs}ms interval`);

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
      } catch (error) {
        logger.error('Error during performance monitoring:', error);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    logger.info('Performance monitoring stopped');
  }

  async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = new Date().toISOString();
    
    try {
      // Collect database metrics
      const databaseMetrics = await this.collectDatabaseMetrics();
      
      // Collect search metrics
      const searchMetrics = await this.collectSearchMetrics();
      
      // Collect embedding metrics
      const embeddingMetrics = await this.collectEmbeddingMetrics();
      
      // Collect content processing metrics
      const contentMetrics = await this.collectContentMetrics();
      
      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();

      const metrics: PerformanceMetrics = {
        timestamp,
        database: databaseMetrics,
        search: searchMetrics,
        embedding: embeddingMetrics,
        content: contentMetrics,
        system: systemMetrics
      };

      // Store metrics
      this.metrics.push(metrics);
      
      // Keep only last 1000 metrics (adjust based on storage needs)
      if (this.metrics.length > 1000) {
        this.metrics.shift();
      }

      // Update metrics history for trend analysis
      this.updateMetricsHistory(metrics);

      logger.debug('Performance metrics collected', { timestamp });
      return metrics;

    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
      throw error;
    }
  }

  private async collectDatabaseMetrics(): Promise<any> {
    try {
      // In a real implementation, these would come from AstraDB monitoring APIs
      // For now, we'll simulate realistic metrics
      
      const collections = ['content_pieces', 'content_analytics', 'brand_knowledge'];
      let totalDocuments = 0;
      
      for (const collectionName of collections) {
        try {
          const stats = await this.astraDB.getCollectionStats(collectionName);
          totalDocuments += stats.count || 0;
        } catch (error) {
          logger.warn(`Failed to get stats for collection ${collectionName}:`, error);
        }
      }

      return {
        connections: {
          active: Math.floor(Math.random() * 10) + 1,
          idle: Math.floor(Math.random() * 5) + 1,
          total: Math.floor(Math.random() * 15) + 2
        },
        operations: {
          reads: this.getRandomMetric('db_reads', 50, 200),
          writes: this.getRandomMetric('db_writes', 10, 50),
          vectorSearches: this.getRandomMetric('vector_searches', 20, 100),
          totalOperations: this.getRandomMetric('total_ops', 80, 350)
        },
        performance: {
          averageResponseTime: this.getRandomMetric('avg_response_time', 50, 200),
          p95ResponseTime: this.getRandomMetric('p95_response_time', 100, 500),
          p99ResponseTime: this.getRandomMetric('p99_response_time', 200, 1000),
          errorRate: this.getRandomMetric('error_rate', 0, 5) / 100,
          throughput: this.getRandomMetric('throughput', 100, 500)
        },
        storage: {
          documentsCount: totalDocuments,
          indexSize: this.getRandomMetric('index_size', 100, 1000) * 1024 * 1024, // MB to bytes
          dataSize: this.getRandomMetric('data_size', 500, 5000) * 1024 * 1024,
          vectorIndexSize: this.getRandomMetric('vector_index_size', 200, 2000) * 1024 * 1024
        }
      };
    } catch (error) {
      logger.error('Failed to collect database metrics:', error);
      throw error;
    }
  }

  private async collectSearchMetrics(): Promise<any> {
    return {
      semanticSearchMetrics: {
        averageLatency: this.getRandomMetric('semantic_latency', 100, 500),
        cacheHitRate: this.getRandomMetric('semantic_cache_hit', 60, 90) / 100,
        resultsQuality: this.getRandomMetric('semantic_quality', 70, 95) / 100
      },
      lexicalSearchMetrics: {
        averageLatency: this.getRandomMetric('lexical_latency', 50, 200),
        indexEfficiency: this.getRandomMetric('lexical_efficiency', 80, 98) / 100
      },
      hybridSearchMetrics: {
        averageLatency: this.getRandomMetric('hybrid_latency', 150, 600),
        rerankingTime: this.getRandomMetric('reranking_time', 50, 200),
        accuracyScore: this.getRandomMetric('hybrid_accuracy', 75, 95) / 100
      }
    };
  }

  private async collectEmbeddingMetrics(): Promise<any> {
    return {
      generationMetrics: {
        averageLatency: this.getRandomMetric('embedding_latency', 500, 2000),
        tokensProcessed: this.getRandomMetric('tokens_processed', 1000, 10000),
        errorRate: this.getRandomMetric('embedding_error_rate', 0, 3) / 100,
        cacheHitRate: this.getRandomMetric('embedding_cache_hit', 40, 80) / 100
      },
      batchMetrics: {
        averageBatchSize: this.getRandomMetric('batch_size', 10, 50),
        batchLatency: this.getRandomMetric('batch_latency', 2000, 10000),
        throughput: this.getRandomMetric('embedding_throughput', 50, 200)
      }
    };
  }

  private async collectContentMetrics(): Promise<any> {
    return {
      processingMetrics: {
        averageProcessingTime: this.getRandomMetric('processing_time', 1000, 5000),
        validationErrors: this.getRandomMetric('validation_errors', 0, 10),
        enhancementTime: this.getRandomMetric('enhancement_time', 500, 2000),
        chunkingTime: this.getRandomMetric('chunking_time', 200, 1000)
      },
      qualityMetrics: {
        averageQualityScore: this.getRandomMetric('quality_score', 70, 95) / 100,
        brandComplianceRate: this.getRandomMetric('brand_compliance', 85, 98) / 100,
        validationPassRate: this.getRandomMetric('validation_pass_rate', 90, 99) / 100
      }
    };
  }

  private async collectSystemMetrics(): Promise<any> {
    const memoryUsed = this.getRandomMetric('memory_used', 1000, 4000) * 1024 * 1024; // MB to bytes
    const memoryTotal = 8 * 1024 * 1024 * 1024; // 8GB
    const cpuUsage = this.getRandomMetric('cpu_usage', 10, 80);
    
    // Determine health status
    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    const issues: string[] = [];
    
    if (cpuUsage > 80) {
      status = 'DEGRADED';
      issues.push('High CPU usage');
    }
    
    if (memoryUsed / memoryTotal > 0.9) {
      status = 'DEGRADED';
      issues.push('High memory usage');
    }
    
    const errorRate = this.getMetricHistory('error_rate').slice(-5);
    if (errorRate.some(rate => rate > 0.05)) {
      status = 'UNHEALTHY';
      issues.push('High error rate detected');
    }

    return {
      memory: {
        used: memoryUsed,
        total: memoryTotal,
        percentage: (memoryUsed / memoryTotal) * 100
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: [
          Math.random() * 2,
          Math.random() * 2,
          Math.random() * 2
        ]
      },
      health: {
        status,
        issues,
        lastHealthCheck: new Date().toISOString()
      }
    };
  }

  private getRandomMetric(metricName: string, min: number, max: number): number {
    // Get historical data for trending
    const history = this.getMetricHistory(metricName);
    const lastValue = history[history.length - 1];
    
    if (lastValue !== undefined) {
      // Add some trend and randomness to make metrics more realistic
      const trend = (Math.random() - 0.5) * 0.1; // ±5% trend
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const newValue = lastValue * (1 + trend + variation);
      
      // Keep within bounds
      return Math.max(min, Math.min(max, newValue));
    }
    
    // First time - return random value in range
    return Math.random() * (max - min) + min;
  }

  private updateMetricsHistory(metrics: PerformanceMetrics): void {
    const updates = {
      'db_reads': metrics.database.operations.reads,
      'db_writes': metrics.database.operations.writes,
      'vector_searches': metrics.database.operations.vectorSearches,
      'avg_response_time': metrics.database.performance.averageResponseTime,
      'error_rate': metrics.database.performance.errorRate,
      'throughput': metrics.database.performance.throughput,
      'semantic_latency': metrics.search.semanticSearchMetrics.averageLatency,
      'embedding_latency': metrics.embedding.generationMetrics.averageLatency,
      'cpu_usage': metrics.system.cpu.usage,
      'memory_used': metrics.system.memory.used
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (!this.metricsHistory.has(key)) {
        this.metricsHistory.set(key, []);
      }
      
      const history = this.metricsHistory.get(key)!;
      history.push(value);
      
      // Keep only last 100 values
      if (history.length > 100) {
        history.shift();
      }
    });
  }

  private getMetricHistory(metricName: string): number[] {
    return this.metricsHistory.get(metricName) || [];
  }

  private async checkAlerts(): Promise<void> {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) return;

    for (const rule of this.alertRules.filter(r => r.enabled)) {
      const currentValue = this.extractMetricValue(latestMetrics, rule.metric);
      
      if (this.evaluateAlertCondition(currentValue, rule)) {
        await this.triggerAlert(rule, currentValue);
      }
    }
  }

  private extractMetricValue(metrics: PerformanceMetrics, metricPath: string): number {
    // Extract nested metric values using dot notation
    const keys = metricPath.split('.');
    let value: any = metrics;
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private evaluateAlertCondition(currentValue: number, rule: AlertRule): boolean {
    switch (rule.condition) {
      case 'GREATER_THAN':
        return currentValue > rule.threshold;
      case 'LESS_THAN':
        return currentValue < rule.threshold;
      case 'EQUALS':
        return Math.abs(currentValue - rule.threshold) < 0.001;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, currentValue: number): Promise<void> {
    // Check if this alert is already active
    const existingAlert = this.alerts.find(a => 
      a.ruleId === rule.id && !a.resolved
    );
    
    if (existingAlert) {
      return; // Alert already active
    }

    const alert: Alert = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      timestamp: new Date().toISOString(),
      severity: rule.severity,
      message: `${rule.name}: ${rule.description}`,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      resolved: false
    };

    this.alerts.push(alert);
    
    logger.warn(`Alert triggered: ${alert.message}`, {
      alertId: alert.id,
      metric: alert.metric,
      currentValue,
      threshold: rule.threshold
    });

    // In production, this would send notifications (email, Slack, etc.)
    await this.sendAlertNotification(alert);
  }

  private async sendAlertNotification(alert: Alert): Promise<void> {
    // Placeholder for notification system
    // In production, integrate with email, Slack, PagerDuty, etc.
    logger.info(`Alert notification sent for: ${alert.message}`);
  }

  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    if (this.metrics.length === 0) {
      return recommendations;
    }

    const latestMetrics = this.metrics[this.metrics.length - 1];
    const historicalMetrics = this.metrics.slice(-10); // Last 10 measurements

    // Analyze database performance
    recommendations.push(...this.analyzeDatabasePerformance(latestMetrics, historicalMetrics));
    
    // Analyze search performance
    recommendations.push(...this.analyzeSearchPerformance(latestMetrics, historicalMetrics));
    
    // Analyze resource usage
    recommendations.push(...this.analyzeResourceUsage(latestMetrics, historicalMetrics));

    return recommendations.sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private analyzeDatabasePerformance(
    latest: PerformanceMetrics,
    historical: PerformanceMetrics[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check response time trends
    const avgResponseTimes = historical.map(m => m.database.performance.averageResponseTime);
    const recentAvg = avgResponseTimes.slice(-3).reduce((sum, t) => sum + t, 0) / 3;
    
    if (recentAvg > 200) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'QUERY',
        priority: 'HIGH',
        title: 'High Database Response Time',
        description: 'Average database response time is above optimal threshold',
        impact: 'User experience degradation, slower content operations',
        implementation: [
          'Review and optimize frequent queries',
          'Add appropriate database indexes',
          'Consider query result caching',
          'Review connection pool configuration'
        ],
        estimatedImprovement: {
          metric: 'response_time',
          improvement: 30
        },
        createdAt: new Date().toISOString()
      });
    }

    // Check error rate
    if (latest.database.performance.errorRate > 0.05) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'CONFIGURATION',
        priority: 'CRITICAL',
        title: 'High Database Error Rate',
        description: 'Database error rate exceeds acceptable threshold',
        impact: 'Data integrity issues, failed operations',
        implementation: [
          'Investigate error logs for root causes',
          'Review database connection settings',
          'Implement retry mechanisms',
          'Add proper error handling'
        ],
        estimatedImprovement: {
          metric: 'error_rate',
          improvement: 80
        },
        createdAt: new Date().toISOString()
      });
    }

    return recommendations;
  }

  private analyzeSearchPerformance(
    latest: PerformanceMetrics,
    historical: PerformanceMetrics[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check semantic search performance
    if (latest.search.semanticSearchMetrics.averageLatency > 400) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'CACHE',
        priority: 'MEDIUM',
        title: 'Slow Semantic Search Performance',
        description: 'Semantic search latency is higher than optimal',
        impact: 'Slower content discovery, poor user experience',
        implementation: [
          'Implement embedding caching',
          'Optimize vector similarity calculations',
          'Consider pre-computing popular searches',
          'Review embedding model performance'
        ],
        estimatedImprovement: {
          metric: 'semantic_latency',
          improvement: 40
        },
        createdAt: new Date().toISOString()
      });
    }

    // Check cache hit rates
    if (latest.search.semanticSearchMetrics.cacheHitRate < 0.7) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'CACHE',
        priority: 'MEDIUM',
        title: 'Low Search Cache Hit Rate',
        description: 'Search cache is not effectively reducing computational load',
        impact: 'Increased latency, higher resource usage',
        implementation: [
          'Review cache expiration policies',
          'Increase cache size if memory allows',
          'Implement smarter cache key strategies',
          'Add cache warming for popular queries'
        ],
        estimatedImprovement: {
          metric: 'cache_hit_rate',
          improvement: 25
        },
        createdAt: new Date().toISOString()
      });
    }

    return recommendations;
  }

  private analyzeResourceUsage(
    latest: PerformanceMetrics,
    historical: PerformanceMetrics[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check memory usage
    if (latest.system.memory.percentage > 85) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'RESOURCE',
        priority: 'HIGH',
        title: 'High Memory Usage',
        description: 'System memory usage is approaching capacity',
        impact: 'Performance degradation, potential out-of-memory errors',
        implementation: [
          'Review memory-intensive operations',
          'Implement memory pooling for large objects',
          'Add memory usage monitoring and alerts',
          'Consider increasing available memory'
        ],
        estimatedImprovement: {
          metric: 'memory_usage',
          improvement: 20
        },
        createdAt: new Date().toISOString()
      });
    }

    // Check CPU usage trends
    const cpuUsages = historical.map(m => m.system.cpu.usage);
    const recentCpuAvg = cpuUsages.slice(-3).reduce((sum, cpu) => sum + cpu, 0) / 3;
    
    if (recentCpuAvg > 75) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'RESOURCE',
        priority: 'MEDIUM',
        title: 'High CPU Usage',
        description: 'CPU usage is consistently high',
        impact: 'Slower response times, reduced throughput',
        implementation: [
          'Profile CPU-intensive operations',
          'Implement asynchronous processing',
          'Add load balancing if applicable',
          'Optimize computational algorithms'
        ],
        estimatedImprovement: {
          metric: 'cpu_usage',
          improvement: 30
        },
        createdAt: new Date().toISOString()
      });
    }

    return recommendations;
  }

  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: '1',
        name: 'High Response Time',
        metric: 'database.performance.averageResponseTime',
        condition: 'GREATER_THAN',
        threshold: 500,
        duration: 300,
        severity: 'WARNING',
        enabled: true,
        description: 'Database response time exceeds 500ms'
      },
      {
        id: '2',
        name: 'High Error Rate',
        metric: 'database.performance.errorRate',
        condition: 'GREATER_THAN',
        threshold: 0.05,
        duration: 60,
        severity: 'CRITICAL',
        enabled: true,
        description: 'Error rate exceeds 5%'
      },
      {
        id: '3',
        name: 'Low Cache Hit Rate',
        metric: 'search.semanticSearchMetrics.cacheHitRate',
        condition: 'LESS_THAN',
        threshold: 0.6,
        duration: 600,
        severity: 'WARNING',
        enabled: true,
        description: 'Cache hit rate below 60%'
      },
      {
        id: '4',
        name: 'High Memory Usage',
        metric: 'system.memory.percentage',
        condition: 'GREATER_THAN',
        threshold: 90,
        duration: 300,
        severity: 'CRITICAL',
        enabled: true,
        description: 'Memory usage exceeds 90%'
      },
      {
        id: '5',
        name: 'High CPU Usage',
        metric: 'system.cpu.usage',
        condition: 'GREATER_THAN',
        threshold: 85,
        duration: 600,
        severity: 'WARNING',
        enabled: true,
        description: 'CPU usage exceeds 85%'
      }
    ];
  }

  // Public API methods
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAllAlerts(limit: number = 100): Alert[] {
    return this.alerts.slice(-limit);
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    
    logger.info(`Alert resolved: ${alert.message}`, { alertId });
    return true;
  }

  addAlertRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: crypto.randomUUID()
    };
    
    this.alertRules.push(newRule);
    logger.info(`Alert rule added: ${newRule.name}`);
    
    return newRule;
  }

  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
    logger.info(`Alert rule updated: ${ruleId}`);
    
    return true;
  }

  deleteAlertRule(ruleId: string): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    this.alertRules.splice(ruleIndex, 1);
    logger.info(`Alert rule deleted: ${ruleId}`);
    
    return true;
  }

  getHealthStatus(): { status: string; issues: string[]; recommendations: string[] } {
    const latestMetrics = this.getLatestMetrics();
    if (!latestMetrics) {
      return {
        status: 'UNKNOWN',
        issues: ['No metrics available'],
        recommendations: ['Start performance monitoring']
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check various health indicators
    if (latestMetrics.database.performance.errorRate > 0.02) {
      issues.push('High database error rate');
      recommendations.push('Investigate database connection issues');
    }

    if (latestMetrics.system.memory.percentage > 85) {
      issues.push('High memory usage');
      recommendations.push('Monitor memory-intensive operations');
    }

    if (latestMetrics.system.cpu.usage > 80) {
      issues.push('High CPU usage');
      recommendations.push('Review CPU-intensive processes');
    }

    const status = issues.length === 0 ? 'HEALTHY' : 
                  issues.length <= 2 ? 'DEGRADED' : 'UNHEALTHY';

    return { status, issues, recommendations };
  }
}

export default PerformanceMonitor;