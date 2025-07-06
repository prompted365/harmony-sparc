import { performance } from 'perf_hooks';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface PerformanceMetrics {
  testName: string;
  duration: number;
  memoryUsed: number;
  cpuUsage: NodeJS.CpuUsage;
  timestamp: number;
  tps?: number;
  gasUsed?: number;
  blockTime?: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private startTime: number = 0;
  private startCpuUsage: NodeJS.CpuUsage | null = null;
  private startMemory: number = 0;

  start(testName: string): void {
    this.startTime = performance.now();
    this.startCpuUsage = process.cpuUsage();
    this.startMemory = process.memoryUsage().heapUsed;
  }

  end(testName: string, additionalMetrics?: Partial<PerformanceMetrics>): PerformanceMetrics {
    const endTime = performance.now();
    const endCpuUsage = process.cpuUsage(this.startCpuUsage!);
    const endMemory = process.memoryUsage().heapUsed;

    const metrics: PerformanceMetrics = {
      testName,
      duration: endTime - this.startTime,
      memoryUsed: endMemory - this.startMemory,
      cpuUsage: endCpuUsage,
      timestamp: Date.now(),
      ...additionalMetrics
    };

    this.metrics.push(metrics);
    return metrics;
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  generateReport(): string {
    const report = {
      summary: {
        totalTests: this.metrics.length,
        totalDuration: this.metrics.reduce((sum, m) => sum + m.duration, 0),
        averageDuration: this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length,
        totalMemoryUsed: this.metrics.reduce((sum, m) => sum + m.memoryUsed, 0),
        systemInfo: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          nodeVersion: process.version
        }
      },
      metrics: this.metrics
    };

    return JSON.stringify(report, null, 2);
  }

  saveReport(filename: string = 'performance-report.json'): void {
    const reportPath = path.join(process.cwd(), 'reports', filename);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, this.generateReport());
  }
}

export async function measureTPS(
  testFn: () => Promise<void>,
  duration: number = 60000,
  targetTPS: number = 1000
): Promise<{ achieved: boolean; actualTPS: number; metrics: any }> {
  const startTime = Date.now();
  let transactionCount = 0;
  const errors: Error[] = [];

  const promises: Promise<void>[] = [];
  
  while (Date.now() - startTime < duration) {
    promises.push(
      testFn()
        .then(() => { transactionCount++; })
        .catch(err => { errors.push(err); })
    );

    // Control the rate to avoid overwhelming the system
    if (promises.length >= targetTPS / 10) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }

  // Wait for remaining promises
  await Promise.all(promises);

  const actualDuration = (Date.now() - startTime) / 1000; // in seconds
  const actualTPS = transactionCount / actualDuration;

  return {
    achieved: actualTPS >= targetTPS,
    actualTPS,
    metrics: {
      transactionCount,
      duration: actualDuration * 1000,
      errorCount: errors.length,
      errorRate: (errors.length / (transactionCount + errors.length)) * 100,
      targetTPS,
      performance: (actualTPS / targetTPS) * 100
    }
  };
}

export class LoadTester {
  private results: any[] = [];

  async runLoadTest(
    testName: string,
    testFn: () => Promise<void>,
    options: {
      duration?: number;
      concurrency?: number;
      rampUp?: number;
      targetTPS?: number;
    } = {}
  ): Promise<void> {
    const {
      duration = 60000,
      concurrency = 100,
      rampUp = 5000,
      targetTPS = 1000
    } = options;

    console.log(`Starting load test: ${testName}`);
    console.log(`Duration: ${duration}ms, Concurrency: ${concurrency}, Target TPS: ${targetTPS}`);

    const monitor = new PerformanceMonitor();
    monitor.start(testName);

    // Ramp up phase
    const workers: Promise<void>[] = [];
    const rampUpInterval = rampUp / concurrency;

    for (let i = 0; i < concurrency; i++) {
      await new Promise(resolve => setTimeout(resolve, rampUpInterval));
      workers.push(this.runWorker(testFn, duration));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    const metrics = monitor.end(testName);
    
    // Calculate TPS
    const tps = (this.results.length / duration) * 1000;
    metrics.tps = tps;

    console.log(`Load test completed: ${testName}`);
    console.log(`Achieved TPS: ${tps.toFixed(2)}, Target: ${targetTPS}`);
    console.log(`Success: ${tps >= targetTPS ? 'YES' : 'NO'}`);

    monitor.saveReport(`load-test-${testName}-${Date.now()}.json`);
  }

  private async runWorker(testFn: () => Promise<void>, duration: number): Promise<void> {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      try {
        const start = performance.now();
        await testFn();
        const end = performance.now();
        
        this.results.push({
          success: true,
          duration: end - start,
          timestamp: Date.now()
        });
      } catch (error) {
        this.results.push({
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
  }

  getResults(): any {
    const successCount = this.results.filter(r => r.success).length;
    const failureCount = this.results.filter(r => !r.success).length;
    const totalCount = this.results.length;
    const successRate = (successCount / totalCount) * 100;

    const durations = this.results
      .filter(r => r.success && r.duration)
      .map(r => r.duration);

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    // Calculate percentiles
    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    return {
      totalRequests: totalCount,
      successCount,
      failureCount,
      successRate,
      performance: {
        avgDuration,
        minDuration,
        maxDuration,
        percentiles: { p50, p95, p99 }
      },
      results: this.results
    };
  }
}

export function createStressTest(
  name: string,
  testFn: () => Promise<void>,
  options: {
    duration?: number;
    maxConcurrency?: number;
    stepSize?: number;
    stepDuration?: number;
  } = {}
): () => Promise<void> {
  return async () => {
    const {
      duration = 300000, // 5 minutes
      maxConcurrency = 1000,
      stepSize = 100,
      stepDuration = 30000 // 30 seconds per step
    } = options;

    const tester = new LoadTester();
    const results: any[] = [];

    for (let concurrency = stepSize; concurrency <= maxConcurrency; concurrency += stepSize) {
      console.log(`\nStress test step: ${concurrency} concurrent users`);
      
      await tester.runLoadTest(
        `${name}-${concurrency}`,
        testFn,
        {
          duration: stepDuration,
          concurrency,
          targetTPS: concurrency * 10 // Assume each user does 10 TPS
        }
      );

      const stepResults = tester.getResults();
      results.push({
        concurrency,
        ...stepResults
      });

      // Break if failure rate is too high
      if (stepResults.successRate < 95) {
        console.log('Breaking stress test due to high failure rate');
        break;
      }
    }

    // Generate stress test report
    const report = {
      testName: name,
      timestamp: Date.now(),
      steps: results,
      maxSuccessfulConcurrency: results
        .filter(r => r.successRate >= 95)
        .map(r => r.concurrency)
        .pop() || 0
    };

    fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
    fs.writeFileSync(
      path.join(process.cwd(), 'reports', `stress-test-${name}-${Date.now()}.json`),
      JSON.stringify(report, null, 2)
    );
  };
}