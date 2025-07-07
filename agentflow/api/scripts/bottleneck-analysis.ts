#!/usr/bin/env ts-node

/**
 * Bottleneck Analysis Script
 * Identifies performance bottlenecks in the API
 */

import { performance } from 'perf_hooks';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

interface BottleneckTest {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: any;
  expectedTime: number;
  concurrency: number;
  iterations: number;
}

interface BottleneckResult {
  testName: string;
  bottleneckDetected: boolean;
  metrics: {
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  bottlenecks: {
    slowQueries: boolean;
    memoryLeaks: boolean;
    highCpuUsage: boolean;
    slowNetworkIO: boolean;
    inefficientAlgorithms: boolean;
    concurrencyIssues: boolean;
  };
  recommendations: string[];
}

class BottleneckAnalyzer {
  private baseUrl: string;
  private results: BottleneckResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async analyzeBottlenecks(): Promise<void> {
    console.log('🔍 Starting Bottleneck Analysis...');
    console.log('='.repeat(60));

    const tests: BottleneckTest[] = [
      {
        name: 'Health Check Bottleneck',
        endpoint: '/health',
        method: 'GET',
        expectedTime: 50,
        concurrency: 100,
        iterations: 1000
      },
      {
        name: 'Database Query Bottleneck',
        endpoint: '/health/detailed',
        method: 'GET',
        expectedTime: 100,
        concurrency: 50,
        iterations: 500
      },
      {
        name: 'Financial API Bottleneck',
        endpoint: '/api/financial/tokens',
        method: 'GET',
        expectedTime: 75,
        concurrency: 75,
        iterations: 750
      },
      {
        name: 'Wallet Creation Bottleneck',
        endpoint: '/api/financial/wallets',
        method: 'POST',
        expectedTime: 150,
        concurrency: 25,
        iterations: 250
      },
      {
        name: 'Memory Usage Bottleneck',
        endpoint: '/health/metrics',
        method: 'GET',
        expectedTime: 25,
        concurrency: 200,
        iterations: 2000
      }
    ];

    for (const test of tests) {
      await this.runBottleneckTest(test);
    }

    this.generateBottleneckReport();
  }

  private async runBottleneckTest(test: BottleneckTest): Promise<void> {
    console.log(`\n🔍 Testing: ${test.name}`);
    console.log(`Endpoint: ${test.method} ${test.endpoint}`);
    console.log(`Concurrency: ${test.concurrency}, Iterations: ${test.iterations}`);

    const measurements: number[] = [];
    const errors: any[] = [];
    const memorySnapshots: NodeJS.MemoryUsage[] = [];
    const cpuUsageSnapshots: NodeJS.CpuUsage[] = [];

    // Initial memory and CPU snapshot
    const initialMemory = process.memoryUsage();
    const initialCpuUsage = process.cpuUsage();

    const startTime = performance.now();

    // Run concurrent requests
    const batchSize = Math.min(test.concurrency, 50);
    const batches = Math.ceil(test.iterations / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<void>[] = [];
      
      for (let i = 0; i < batchSize && (batch * batchSize + i) < test.iterations; i++) {
        batchPromises.push(this.executeRequest(test, measurements, errors));
      }

      await Promise.all(batchPromises);

      // Take memory and CPU snapshots periodically
      if (batch % 10 === 0) {
        memorySnapshots.push(process.memoryUsage());
        cpuUsageSnapshots.push(process.cpuUsage());
      }
    }

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    // Calculate final metrics
    const finalMemory = process.memoryUsage();
    const finalCpuUsage = process.cpuUsage();

    const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const maxResponseTime = Math.max(...measurements);
    const minResponseTime = Math.min(...measurements);
    const sortedMeasurements = measurements.sort((a, b) => a - b);
    const p95ResponseTime = sortedMeasurements[Math.floor(sortedMeasurements.length * 0.95)];
    const p99ResponseTime = sortedMeasurements[Math.floor(sortedMeasurements.length * 0.99)];
    const throughput = (measurements.length / totalDuration) * 1000;
    const errorRate = (errors.length / test.iterations) * 100;

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(
      test,
      { avgResponseTime, maxResponseTime, p95ResponseTime, throughput, errorRate },
      initialMemory,
      finalMemory,
      initialCpuUsage,
      finalCpuUsage,
      memorySnapshots,
      cpuUsageSnapshots
    );

    const result: BottleneckResult = {
      testName: test.name,
      bottleneckDetected: Object.values(bottlenecks).some(b => b),
      metrics: {
        avgResponseTime,
        maxResponseTime,
        minResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        throughput,
        errorRate
      },
      bottlenecks,
      recommendations: this.generateRecommendations(bottlenecks, test)
    };

    this.results.push(result);

    console.log(`Results: ${avgResponseTime.toFixed(2)}ms avg, ${throughput.toFixed(2)} RPS, ${errorRate.toFixed(2)}% errors`);
    console.log(`Bottlenecks: ${result.bottleneckDetected ? '⚠️ DETECTED' : '✅ NONE'}`);
  }

  private async executeRequest(
    test: BottleneckTest,
    measurements: number[],
    errors: any[]
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const config = {
        url: `${this.baseUrl}${test.endpoint}`,
        method: test.method,
        data: test.payload,
        timeout: 10000,
        validateStatus: () => true
      };

      const response = await axios(config);
      
      const endTime = performance.now();
      measurements.push(endTime - startTime);

      if (response.status >= 400) {
        errors.push({ status: response.status, error: response.data });
      }
    } catch (error) {
      const endTime = performance.now();
      measurements.push(endTime - startTime);
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({ error: err.message });
    }
  }

  private detectBottlenecks(
    test: BottleneckTest,
    metrics: { avgResponseTime: number; maxResponseTime: number; p95ResponseTime: number; throughput: number; errorRate: number },
    initialMemory: NodeJS.MemoryUsage,
    finalMemory: NodeJS.MemoryUsage,
    initialCpuUsage: NodeJS.CpuUsage,
    finalCpuUsage: NodeJS.CpuUsage,
    memorySnapshots: NodeJS.MemoryUsage[],
    cpuUsageSnapshots: NodeJS.CpuUsage[]
  ): BottleneckResult['bottlenecks'] {
    const bottlenecks: BottleneckResult['bottlenecks'] = {
      slowQueries: false,
      memoryLeaks: false,
      highCpuUsage: false,
      slowNetworkIO: false,
      inefficientAlgorithms: false,
      concurrencyIssues: false
    };

    // Detect slow queries (response time significantly above expected)
    if (metrics.avgResponseTime > test.expectedTime * 2) {
      bottlenecks.slowQueries = true;
    }

    // Detect memory leaks (memory usage increases significantly)
    const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    if (memoryIncrease > 50) {
      bottlenecks.memoryLeaks = true;
    }

    // Detect high CPU usage (CPU usage increases significantly)
    const cpuIncrease = (finalCpuUsage.user - initialCpuUsage.user) / 1000000;
    if (cpuIncrease > 5) {
      bottlenecks.highCpuUsage = true;
    }

    // Detect slow network I/O (high variance in response times)
    const variance = metrics.maxResponseTime - metrics.avgResponseTime;
    if (variance > metrics.avgResponseTime * 2) {
      bottlenecks.slowNetworkIO = true;
    }

    // Detect inefficient algorithms (P95 much higher than average)
    if (metrics.p95ResponseTime > metrics.avgResponseTime * 3) {
      bottlenecks.inefficientAlgorithms = true;
    }

    // Detect concurrency issues (throughput much lower than expected)
    const expectedThroughput = test.concurrency * 10; // Conservative estimate
    if (metrics.throughput < expectedThroughput * 0.3) {
      bottlenecks.concurrencyIssues = true;
    }

    return bottlenecks;
  }

  private generateRecommendations(
    bottlenecks: BottleneckResult['bottlenecks'],
    test: BottleneckTest
  ): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.slowQueries) {
      recommendations.push('Optimize database queries with indexing and query optimization');
      recommendations.push('Consider implementing database connection pooling');
      recommendations.push('Add query result caching for frequently accessed data');
    }

    if (bottlenecks.memoryLeaks) {
      recommendations.push('Investigate memory leaks in request handlers');
      recommendations.push('Implement proper resource cleanup in middleware');
      recommendations.push('Consider using memory profiling tools');
    }

    if (bottlenecks.highCpuUsage) {
      recommendations.push('Optimize CPU-intensive operations');
      recommendations.push('Consider implementing worker threads for heavy computations');
      recommendations.push('Add CPU usage monitoring and throttling');
    }

    if (bottlenecks.slowNetworkIO) {
      recommendations.push('Optimize network I/O operations');
      recommendations.push('Implement request/response compression');
      recommendations.push('Consider using CDN for static assets');
    }

    if (bottlenecks.inefficientAlgorithms) {
      recommendations.push('Review and optimize algorithms in the endpoint');
      recommendations.push('Consider implementing more efficient data structures');
      recommendations.push('Add algorithmic complexity analysis');
    }

    if (bottlenecks.concurrencyIssues) {
      recommendations.push('Implement proper connection pooling');
      recommendations.push('Optimize middleware for concurrent requests');
      recommendations.push('Consider using async/await patterns consistently');
    }

    return recommendations;
  }

  private generateBottleneckReport(): void {
    const reportPath = path.join(process.cwd(), 'bottleneck-analysis-report.json');
    
    const totalBottlenecks = this.results.filter(r => r.bottleneckDetected).length;
    const totalTests = this.results.length;

    const report = {
      summary: {
        totalTests,
        bottlenecksDetected: totalBottlenecks,
        bottleneckFreeTests: totalTests - totalBottlenecks,
        overallHealth: totalBottlenecks === 0 ? 'EXCELLENT' : 
                      totalBottlenecks <= 2 ? 'GOOD' : 
                      totalBottlenecks <= 4 ? 'FAIR' : 'POOR'
      },
      criticalBottlenecks: this.results
        .filter(r => r.bottleneckDetected)
        .map(r => ({
          test: r.testName,
          avgResponseTime: r.metrics.avgResponseTime,
          throughput: r.metrics.throughput,
          mainBottlenecks: Object.keys(r.bottlenecks).filter(k => r.bottlenecks[k as keyof typeof r.bottlenecks])
        })),
      results: this.results,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('🔍 BOTTLENECK ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log(`Overall Health: ${report.summary.overallHealth}`);
    console.log(`Bottlenecks Detected: ${totalBottlenecks}/${totalTests} tests`);
    console.log('');

    this.results.forEach(result => {
      console.log(`${result.bottleneckDetected ? '⚠️' : '✅'} ${result.testName}`);
      console.log(`   Response Time: ${result.metrics.avgResponseTime.toFixed(2)}ms avg`);
      console.log(`   Throughput: ${result.metrics.throughput.toFixed(2)} RPS`);
      
      if (result.bottleneckDetected) {
        const detectedBottlenecks = Object.keys(result.bottlenecks)
          .filter(k => result.bottlenecks[k as keyof typeof result.bottlenecks]);
        console.log(`   Bottlenecks: ${detectedBottlenecks.join(', ')}`);
        console.log(`   Recommendations:`);
        result.recommendations.forEach(rec => console.log(`     - ${rec}`));
      }
      console.log('');
    });

    console.log(`📄 Full report saved to: ${reportPath}`);
  }
}

// Run bottleneck analysis
const analyzer = new BottleneckAnalyzer();
analyzer.analyzeBottlenecks().catch(console.error);

export { BottleneckAnalyzer, BottleneckTest, BottleneckResult };