/**
 * Real-time Fee Monitor
 * Monitors fee performance, network conditions, and provides real-time analytics
 */

import { EventEmitter } from 'events';
import { FeeEngine, FeeAnalytics, NetworkConditions } from './fee-engine';
import { PaymentRequest } from '../payment/types';

export interface FeeMonitorConfig {
  updateInterval: number;
  alertThresholds: {
    highFeeRate: number;
    lowThroughput: number;
    highLatency: number;
    errorRate: number;
  };
  metricsRetention: number; // hours
  realTimeUpdates: boolean;
}

export interface FeeAlert {
  id: string;
  type: 'high_fees' | 'low_throughput' | 'high_latency' | 'error_rate' | 'network_congestion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  data?: any;
}

export interface FeeMetrics {
  timestamp: number;
  totalFees: bigint;
  transactionCount: number;
  averageFee: bigint;
  throughput: number;
  latency: number;
  errorRate: number;
  networkConditions: NetworkConditions;
}

export interface FeePerformanceReport {
  period: string;
  totalTransactions: number;
  totalFees: bigint;
  averageLatency: number;
  peakThroughput: number;
  errorRate: number;
  topTokens: Array<{ token: string; volume: bigint; fees: bigint }>;
  alerts: FeeAlert[];
  recommendations: string[];
}

export class FeeMonitor extends EventEmitter {
  private feeEngine: FeeEngine;
  private config: FeeMonitorConfig;
  private metrics: FeeMetrics[] = [];
  private alerts: FeeAlert[] = [];
  private monitoringTimer?: NodeJS.Timeout;
  private alertCount = 0;

  constructor(feeEngine: FeeEngine, config: FeeMonitorConfig) {
    super();
    this.feeEngine = feeEngine;
    this.config = config;
    this.setupMonitoring();
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
      this.cleanupOldData();
    }, this.config.updateInterval);

    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    this.emit('monitoringStopped');
  }

  /**
   * Get current fee metrics
   */
  getCurrentMetrics(): FeeMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get historical metrics
   */
  getHistoricalMetrics(hours: number = 24): FeeMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): FeeAlert[] {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Get performance report
   */
  getPerformanceReport(hours: number = 24): FeePerformanceReport {
    const metrics = this.getHistoricalMetrics(hours);
    const analytics = this.feeEngine.getAnalytics();
    
    if (metrics.length === 0) {
      return {
        period: `${hours}h`,
        totalTransactions: 0,
        totalFees: BigInt(0),
        averageLatency: 0,
        peakThroughput: 0,
        errorRate: 0,
        topTokens: [],
        alerts: [],
        recommendations: []
      };
    }

    const totalTransactions = metrics.reduce((sum, m) => sum + m.transactionCount, 0);
    const totalFees = metrics.reduce((sum, m) => sum + m.totalFees, BigInt(0));
    const averageLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;
    const peakThroughput = Math.max(...metrics.map(m => m.throughput));
    const errorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;

    // Calculate top tokens
    const topTokens = Object.entries(analytics.feesByToken)
      .sort(([, a], [, b]) => Number(b - a))
      .slice(0, 5)
      .map(([token, fees]) => ({
        token,
        volume: BigInt(0), // Would need to track volume separately
        fees
      }));

    const alerts = this.getActiveAlerts();
    const recommendations = this.generateRecommendations(metrics, analytics);

    return {
      period: `${hours}h`,
      totalTransactions,
      totalFees,
      averageLatency,
      peakThroughput,
      errorRate,
      topTokens,
      alerts,
      recommendations
    };
  }

  /**
   * Generate real-time dashboard data
   */
  getDashboardData(): {
    currentMetrics: FeeMetrics | null;
    alerts: FeeAlert[];
    trends: {
      feesTrend: Array<{ timestamp: number; value: number }>;
      throughputTrend: Array<{ timestamp: number; value: number }>;
      latencyTrend: Array<{ timestamp: number; value: number }>;
    };
    summary: {
      totalFees24h: bigint;
      avgThroughput: number;
      avgLatency: number;
      alertCount: number;
    };
  } {
    const currentMetrics = this.getCurrentMetrics();
    const alerts = this.getActiveAlerts();
    const last24h = this.getHistoricalMetrics(24);

    const trends = {
      feesTrend: last24h.map(m => ({
        timestamp: m.timestamp,
        value: Number(m.totalFees)
      })),
      throughputTrend: last24h.map(m => ({
        timestamp: m.timestamp,
        value: m.throughput
      })),
      latencyTrend: last24h.map(m => ({
        timestamp: m.timestamp,
        value: m.latency
      }))
    };

    const summary = {
      totalFees24h: last24h.reduce((sum, m) => sum + m.totalFees, BigInt(0)),
      avgThroughput: last24h.length > 0 ? last24h.reduce((sum, m) => sum + m.throughput, 0) / last24h.length : 0,
      avgLatency: last24h.length > 0 ? last24h.reduce((sum, m) => sum + m.latency, 0) / last24h.length : 0,
      alertCount: alerts.length
    };

    return {
      currentMetrics,
      alerts,
      trends,
      summary
    };
  }

  /**
   * Set alert thresholds
   */
  setAlertThresholds(thresholds: Partial<FeeMonitorConfig['alertThresholds']>): void {
    this.config.alertThresholds = { ...this.config.alertThresholds, ...thresholds };
    this.emit('alertThresholdsUpdated', this.config.alertThresholds);
  }

  /**
   * Export monitoring data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      metrics: this.metrics,
      alerts: this.alerts,
      config: this.config,
      timestamp: Date.now()
    };

    if (format === 'json') {
      return JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2);
    }

    // CSV format implementation would go here
    return JSON.stringify(data);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }

  private setupMonitoring(): void {
    // Listen to fee engine events
    this.feeEngine.on('feeCalculated', (data) => {
      this.handleFeeCalculated(data);
    });

    this.feeEngine.on('feeCalculationError', (data) => {
      this.handleFeeCalculationError(data);
    });

    this.feeEngine.on('networkConditionsUpdated', (conditions) => {
      this.handleNetworkConditionsUpdated(conditions);
    });

    this.feeEngine.on('distributionsProcessed', (data) => {
      this.handleDistributionsProcessed(data);
    });
  }

  private collectMetrics(): void {
    const analytics = this.feeEngine.getAnalytics();
    const currentMetrics = this.getCurrentMetrics();
    
    // Calculate deltas from previous metrics
    const deltaTransactions = currentMetrics ? 
      analytics.volumeMetrics.transactionCount - currentMetrics.transactionCount : 0;
    const deltaFees = currentMetrics ? 
      analytics.totalFeesCollected - currentMetrics.totalFees : BigInt(0);

    // Calculate throughput (transactions per second)
    const timeDelta = currentMetrics ? 
      (Date.now() - currentMetrics.timestamp) / 1000 : this.config.updateInterval / 1000;
    const throughput = deltaTransactions / timeDelta;

    const newMetrics: FeeMetrics = {
      timestamp: Date.now(),
      totalFees: analytics.totalFeesCollected,
      transactionCount: analytics.volumeMetrics.transactionCount,
      averageFee: analytics.volumeMetrics.transactionCount > 0 ? 
        analytics.totalFeesCollected / BigInt(analytics.volumeMetrics.transactionCount) : BigInt(0),
      throughput,
      latency: analytics.performanceMetrics.averageCalculationTime,
      errorRate: analytics.performanceMetrics.errorRate,
      networkConditions: {
        gasPrice: BigInt(30_000_000_000), // This would come from the fee engine
        congestionLevel: 0.2,
        blockTime: 12000,
        pendingTransactions: 10000
      }
    };

    this.metrics.push(newMetrics);
    
    if (this.config.realTimeUpdates) {
      this.emit('metricsUpdated', newMetrics);
    }
  }

  private checkAlerts(): void {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return;

    const thresholds = this.config.alertThresholds;

    // Check high fee rate
    if (Number(currentMetrics.averageFee) > thresholds.highFeeRate) {
      this.createAlert('high_fees', 'high', 
        `Average fee rate is ${Number(currentMetrics.averageFee)} ETH, above threshold of ${thresholds.highFeeRate} ETH`);
    }

    // Check low throughput
    if (currentMetrics.throughput < thresholds.lowThroughput) {
      this.createAlert('low_throughput', 'medium', 
        `Throughput is ${currentMetrics.throughput} TPS, below threshold of ${thresholds.lowThroughput} TPS`);
    }

    // Check high latency
    if (currentMetrics.latency > thresholds.highLatency) {
      this.createAlert('high_latency', 'medium', 
        `Latency is ${currentMetrics.latency}ms, above threshold of ${thresholds.highLatency}ms`);
    }

    // Check error rate
    if (currentMetrics.errorRate > thresholds.errorRate) {
      this.createAlert('error_rate', 'high', 
        `Error rate is ${currentMetrics.errorRate}%, above threshold of ${thresholds.errorRate}%`);
    }

    // Check network congestion
    if (currentMetrics.networkConditions.congestionLevel > 0.8) {
      this.createAlert('network_congestion', 'critical', 
        `Network congestion is ${Math.round(currentMetrics.networkConditions.congestionLevel * 100)}%`);
    }
  }

  private createAlert(type: FeeAlert['type'], severity: FeeAlert['severity'], message: string, data?: any): void {
    const alert: FeeAlert = {
      id: `alert_${++this.alertCount}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      data
    };

    this.alerts.push(alert);
    this.emit('alertCreated', alert);
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (this.config.metricsRetention * 60 * 60 * 1000);
    
    // Remove old metrics
    this.metrics = this.metrics.filter(metric => metric.timestamp >= cutoff);
    
    // Remove old alerts (keep for 7 days)
    const alertCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp >= alertCutoff);
  }

  private handleFeeCalculated(data: any): void {
    // Update performance metrics
    // This would be integrated with the actual fee calculation events
  }

  private handleFeeCalculationError(data: any): void {
    this.createAlert('error_rate', 'high', 
      `Fee calculation error for request ${data.requestId}: ${data.error.message}`);
  }

  private handleNetworkConditionsUpdated(conditions: NetworkConditions): void {
    // Check for significant changes in network conditions
    if (conditions.congestionLevel > 0.8) {
      this.createAlert('network_congestion', 'critical', 
        `High network congestion detected: ${Math.round(conditions.congestionLevel * 100)}%`);
    }
  }

  private handleDistributionsProcessed(data: any): void {
    // Monitor distribution processing
    if (data.failed > 0) {
      this.createAlert('error_rate', 'medium', 
        `${data.failed} fee distributions failed out of ${data.processed + data.failed} total`);
    }
  }

  private generateRecommendations(metrics: FeeMetrics[], analytics: FeeAnalytics): string[] {
    const recommendations: string[] = [];

    if (metrics.length === 0) return recommendations;

    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
    const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;

    // Throughput recommendations
    if (avgThroughput < this.config.alertThresholds.lowThroughput) {
      recommendations.push('Consider increasing batch sizes to improve throughput');
      recommendations.push('Implement fee caching to reduce calculation overhead');
    }

    // Latency recommendations
    if (avgLatency > this.config.alertThresholds.highLatency) {
      recommendations.push('Enable fee caching to reduce calculation latency');
      recommendations.push('Consider pre-calculating fees for common amounts');
    }

    // Error rate recommendations
    if (avgErrorRate > this.config.alertThresholds.errorRate) {
      recommendations.push('Review fee calculation logic for edge cases');
      recommendations.push('Implement better error handling and retry mechanisms');
    }

    // Network condition recommendations
    const lastMetrics = metrics[metrics.length - 1];
    if (lastMetrics.networkConditions.congestionLevel > 0.6) {
      recommendations.push('Consider implementing dynamic fee adjustment for network congestion');
      recommendations.push('Offer users the option to delay transactions during high congestion');
    }

    return recommendations;
  }
}