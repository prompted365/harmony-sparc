#!/usr/bin/env ts-node

/**
 * Performance Monitoring Script
 * Real-time monitoring of API performance metrics
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface PerformanceMetrics {
  timestamp: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  queueDepth: number;
}

interface TestConfig {
  baseUrl: string;
  testDuration: number;
  targetTPS: number;
  maxResponseTime: number;
  maxErrorRate: number;
  monitoringInterval: number;
  endpoints: string[];
}

class PerformanceMonitor {
  private config: TestConfig;
  private metrics: PerformanceMetrics[] = [];
  private isRunning = false;
  private startTime = 0;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeHistory: number[] = [];

  constructor(config: TestConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Performance Monitoring...');
    console.log(`Target: ${this.config.baseUrl}`);
    console.log(`Duration: ${this.config.testDuration}ms`);
    console.log(`Target TPS: ${this.config.targetTPS}`);
    console.log(`Max Response Time: ${this.config.maxResponseTime}ms`);
    console.log(`Max Error Rate: ${this.config.maxErrorRate}%`);
    console.log('='.repeat(60));

    this.isRunning = true;
    this.startTime = performance.now();

    // Start monitoring
    const monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.displayMetrics();
    }, this.config.monitoringInterval);

    // Start load generation
    const loadGenerationPromise = this.generateLoad();

    // Wait for test completion
    setTimeout(() => {
      this.isRunning = false;
      clearInterval(monitoringInterval);
      console.log('\n⏹️  Performance test completed');
      this.generateReport();
    }, this.config.testDuration);

    await loadGenerationPromise;
  }

  private async generateLoad(): Promise<void> {
    const requestsPerInterval = Math.ceil(this.config.targetTPS / 10); // 10 intervals per second
    const intervalDuration = 100; // 100ms intervals

    while (this.isRunning) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < requestsPerInterval; i++) {
        const endpoint = this.config.endpoints[Math.floor(Math.random() * this.config.endpoints.length)];
        promises.push(this.makeRequest(endpoint));
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, intervalDuration));
    }
  }

  private async makeRequest(endpoint: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
        timeout: this.config.maxResponseTime * 2,
        validateStatus: () => true // Don't throw on non-2xx status codes
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.requestCount++;
      this.responseTimeHistory.push(responseTime);

      if (response.status >= 400) {
        this.errorCount++;
      }

      // Keep only last 1000 response times
      if (this.responseTimeHistory.length > 1000) {
        this.responseTimeHistory.shift();
      }

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.requestCount++;
      this.errorCount++;
      this.responseTimeHistory.push(responseTime);
    }
  }

  private collectMetrics(): void {
    const currentTime = performance.now();
    const elapsedTime = currentTime - this.startTime;
    
    // Calculate metrics
    const throughput = (this.requestCount / elapsedTime) * 1000; // RPS
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    const avgResponseTime = this.responseTimeHistory.length > 0 
      ? this.responseTimeHistory.reduce((a, b) => a + b) / this.responseTimeHistory.length 
      : 0;

    const metric: PerformanceMetrics = {
      timestamp: currentTime,
      responseTime: avgResponseTime,
      throughput,
      errorRate,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      activeConnections: 0, // Would need to implement connection tracking
      queueDepth: 0 // Would need to implement queue tracking
    };

    this.metrics.push(metric);
  }

  private displayMetrics(): void {
    if (this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];
    const elapsedTime = (latest.timestamp - this.startTime) / 1000;
    
    // Calculate percentiles
    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    // Clear console for real-time display
    console.clear();
    
    console.log('📊 REAL-TIME PERFORMANCE METRICS');
    console.log('='.repeat(60));
    console.log(`⏱️  Elapsed Time: ${elapsedTime.toFixed(1)}s`);
    console.log(`📈 Throughput: ${latest.throughput.toFixed(2)} RPS (Target: ${this.config.targetTPS})`);
    console.log(`⚡ Response Time: ${latest.responseTime.toFixed(2)}ms avg (Target: <${this.config.maxResponseTime}ms)`);
    console.log(`📊 Percentiles: P50=${p50.toFixed(2)}ms, P95=${p95.toFixed(2)}ms, P99=${p99.toFixed(2)}ms`);
    console.log(`❌ Error Rate: ${latest.errorRate.toFixed(2)}% (Target: <${this.config.maxErrorRate}%)`);
    console.log(`🧠 Memory: ${(latest.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB heap, ${(latest.memoryUsage.rss / 1024 / 1024).toFixed(2)}MB total`);
    console.log(`📋 Total Requests: ${this.requestCount} (${this.errorCount} errors)`);
    
    // Performance indicators
    console.log('\n🎯 PERFORMANCE STATUS:');
    console.log(`Throughput: ${latest.throughput >= this.config.targetTPS ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Response Time: ${latest.responseTime <= this.config.maxResponseTime ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Error Rate: ${latest.errorRate <= this.config.maxErrorRate ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`P95 Response Time: ${p95 <= this.config.maxResponseTime ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`P99 Response Time: ${p99 <= this.config.maxResponseTime * 1.5 ? '✅ PASS' : '❌ FAIL'}`);
  }

  private generateReport(): void {
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    const totalDuration = (performance.now() - this.startTime) / 1000;
    
    // Calculate final metrics
    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const finalThroughput = (this.requestCount / totalDuration);
    const finalErrorRate = (this.errorCount / this.requestCount) * 100;
    const avgResponseTime = this.responseTimeHistory.reduce((a, b) => a + b) / this.responseTimeHistory.length;

    const report = {
      testConfig: this.config,
      results: {
        totalDuration,
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        throughput: finalThroughput,
        errorRate: finalErrorRate,
        responseTime: {
          average: avgResponseTime,
          min: Math.min(...this.responseTimeHistory),
          max: Math.max(...this.responseTimeHistory),
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)]
        },
        performanceValidation: {
          throughputPass: finalThroughput >= this.config.targetTPS,
          responseTimePass: avgResponseTime <= this.config.maxResponseTime,
          errorRatePass: finalErrorRate <= this.config.maxErrorRate,
          p95Pass: sorted[Math.floor(sorted.length * 0.95)] <= this.config.maxResponseTime,
          p99Pass: sorted[Math.floor(sorted.length * 0.99)] <= this.config.maxResponseTime * 1.5
        }
      },
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📋 FINAL PERFORMANCE REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Total Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`📈 Final Throughput: ${finalThroughput.toFixed(2)} RPS`);
    console.log(`⚡ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`📊 Response Time P95: ${sorted[Math.floor(sorted.length * 0.95)].toFixed(2)}ms`);
    console.log(`📊 Response Time P99: ${sorted[Math.floor(sorted.length * 0.99)].toFixed(2)}ms`);
    console.log(`❌ Final Error Rate: ${finalErrorRate.toFixed(2)}%`);
    console.log(`📋 Total Requests: ${this.requestCount}`);
    console.log(`📋 Total Errors: ${this.errorCount}`);
    
    console.log('\n🎯 VALIDATION RESULTS:');
    console.log(`Throughput (>=${this.config.targetTPS} RPS): ${report.results.performanceValidation.throughputPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Response Time (<=${this.config.maxResponseTime}ms): ${report.results.performanceValidation.responseTimePass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Error Rate (<=${this.config.maxErrorRate}%): ${report.results.performanceValidation.errorRatePass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`P95 Response Time: ${report.results.performanceValidation.p95Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`P99 Response Time: ${report.results.performanceValidation.p99Pass ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  }
}

// Default configuration
const defaultConfig: TestConfig = {
  baseUrl: 'http://localhost:3000',
  testDuration: 60000, // 1 minute
  targetTPS: 1000,
  maxResponseTime: 100,
  maxErrorRate: 5,
  monitoringInterval: 1000,
  endpoints: [
    '/health',
    '/health/detailed',
    '/health/metrics',
    '/health/system',
    '/api/financial/tokens',
    '/api/financial/wallets'
  ]
};

// Parse command line arguments
const args = process.argv.slice(2);
const config = { ...defaultConfig };

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = args[i + 1];
  
  if (key === 'url') config.baseUrl = value;
  if (key === 'duration') config.testDuration = parseInt(value) * 1000;
  if (key === 'tps') config.targetTPS = parseInt(value);
  if (key === 'max-response-time') config.maxResponseTime = parseInt(value);
  if (key === 'max-error-rate') config.maxErrorRate = parseInt(value);
}

// Start monitoring
const monitor = new PerformanceMonitor(config);
monitor.start().catch(console.error);

export { PerformanceMonitor, TestConfig, PerformanceMetrics };