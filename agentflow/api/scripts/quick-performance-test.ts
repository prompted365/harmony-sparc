#!/usr/bin/env ts-node

/**
 * Quick Performance Test
 * Simple performance validation without Jest complications
 */

import { performance } from 'perf_hooks';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface TestResult {
  testName: string;
  passed: boolean;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  throughput: number;
  errorRate: number;
  details: string;
}

class QuickPerformanceTester {
  private baseUrl = 'http://localhost:3000';
  private serverProcess: ChildProcess | null = null;
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Quick Performance Validation');
    console.log('='.repeat(60));

    try {
      await this.startServer();
      await this.waitForServer();

      await this.testResponseTime();
      await this.testThroughput();
      await this.testConcurrentLoad();
      await this.testHealthEndpoints();

      this.generateReport();

    } catch (error) {
      console.error('❌ Performance test failed:', error);
    } finally {
      this.cleanup();
    }
  }

  private async startServer(): Promise<void> {
    console.log('🚀 Starting server...');
    this.serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Log server output for debugging
    if (this.serverProcess.stdout) {
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server is running') || output.includes('🚀')) {
          console.log('✅ Server started successfully');
        }
      });
    }
  }

  private async waitForServer(): Promise<void> {
    console.log('⏳ Waiting for server to be ready...');
    
    for (let i = 0; i < 30; i++) {
      try {
        await axios.get(`${this.baseUrl}/health`, { timeout: 1000 });
        console.log('✅ Server is ready');
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Server failed to start within 30 seconds');
  }

  private async testResponseTime(): Promise<void> {
    console.log('\n📊 Testing Response Time (<100ms requirement)...');
    
    const measurements: number[] = [];
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      try {
        await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      } catch (error) {
        measurements.push(5000); // Timeout value
      }
    }

    const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const maxResponseTime = Math.max(...measurements);
    const minResponseTime = Math.min(...measurements);
    const passed = avgResponseTime < 100 && maxResponseTime < 200;

    this.results.push({
      testName: 'Response Time Test',
      passed,
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
      throughput: 0,
      errorRate: 0,
      details: `Avg: ${avgResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`
    });

    console.log(`${passed ? '✅' : '❌'} Response Time: ${avgResponseTime.toFixed(2)}ms avg (requirement: <100ms)`);
  }

  private async testThroughput(): Promise<void> {
    console.log('\n📈 Testing Throughput (>1000 TPS requirement)...');
    
    const testDuration = 10000; // 10 seconds
    const concurrency = 50;
    const requestsPerBatch = 20;
    
    let totalRequests = 0;
    let successfulRequests = 0;
    const measurements: number[] = [];

    const startTime = performance.now();
    const endTime = startTime + testDuration;

    while (performance.now() < endTime) {
      const batchPromises: Promise<void>[] = [];
      
      for (let i = 0; i < Math.min(concurrency, requestsPerBatch); i++) {
        batchPromises.push(this.makeRequest(measurements));
      }

      const batchResults = await Promise.allSettled(batchPromises);
      totalRequests += batchResults.length;
      successfulRequests += batchResults.filter(r => r.status === 'fulfilled').length;

      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const actualDuration = performance.now() - startTime;
    const throughput = (totalRequests / actualDuration) * 1000;
    const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;
    const avgResponseTime = measurements.length > 0 ? measurements.reduce((a, b) => a + b) / measurements.length : 0;
    const passed = throughput >= 1000 && errorRate <= 5;

    this.results.push({
      testName: 'Throughput Test',
      passed,
      avgResponseTime,
      maxResponseTime: Math.max(...measurements),
      minResponseTime: Math.min(...measurements),
      throughput,
      errorRate,
      details: `${throughput.toFixed(2)} TPS, ${errorRate.toFixed(2)}% errors`
    });

    console.log(`${passed ? '✅' : '❌'} Throughput: ${throughput.toFixed(2)} TPS (requirement: >1000 TPS)`);
  }

  private async testConcurrentLoad(): Promise<void> {
    console.log('\n👥 Testing Concurrent Load (1000 concurrent users)...');
    
    const concurrentUsers = 1000;
    const requestsPerUser = 3;
    const measurements: number[] = [];
    let successfulRequests = 0;
    let totalRequests = 0;

    const startTime = performance.now();

    const userPromises = Array.from({ length: concurrentUsers }, async () => {
      for (let i = 0; i < requestsPerUser; i++) {
        const reqStart = performance.now();
        try {
          await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
          measurements.push(performance.now() - reqStart);
          successfulRequests++;
        } catch (error) {
          measurements.push(5000);
        }
        totalRequests++;
      }
    });

    await Promise.all(userPromises);

    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = (totalRequests / duration) * 1000;
    const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;
    const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const passed = successfulRequests >= totalRequests * 0.95 && avgResponseTime <= 150;

    this.results.push({
      testName: 'Concurrent Load Test',
      passed,
      avgResponseTime,
      maxResponseTime: Math.max(...measurements),
      minResponseTime: Math.min(...measurements),
      throughput,
      errorRate,
      details: `${concurrentUsers} users, ${successfulRequests}/${totalRequests} successful`
    });

    console.log(`${passed ? '✅' : '❌'} Concurrent Load: ${successfulRequests}/${totalRequests} successful requests`);
  }

  private async testHealthEndpoints(): Promise<void> {
    console.log('\n🏥 Testing Health Endpoints Performance...');
    
    const endpoints = ['/health', '/health/detailed', '/health/metrics'];
    const measurements: number[] = [];
    let allPassed = true;

    for (const endpoint of endpoints) {
      const endpointMeasurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        try {
          await axios.get(`${this.baseUrl}${endpoint}`, { timeout: 2000 });
          const responseTime = performance.now() - startTime;
          endpointMeasurements.push(responseTime);
          measurements.push(responseTime);
        } catch (error) {
          endpointMeasurements.push(2000);
          measurements.push(2000);
          allPassed = false;
        }
      }

      const avgTime = endpointMeasurements.reduce((a, b) => a + b) / endpointMeasurements.length;
      console.log(`  ${endpoint}: ${avgTime.toFixed(2)}ms avg`);
    }

    const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const passed = allPassed && avgResponseTime <= 100;

    this.results.push({
      testName: 'Health Endpoints Test',
      passed,
      avgResponseTime,
      maxResponseTime: Math.max(...measurements),
      minResponseTime: Math.min(...measurements),
      throughput: 0,
      errorRate: allPassed ? 0 : 10,
      details: `All health endpoints averaged ${avgResponseTime.toFixed(2)}ms`
    });

    console.log(`${passed ? '✅' : '❌'} Health Endpoints: ${avgResponseTime.toFixed(2)}ms avg response time`);
  }

  private async makeRequest(measurements: number[]): Promise<void> {
    const startTime = performance.now();
    try {
      await axios.get(`${this.baseUrl}/health`, { timeout: 2000 });
      measurements.push(performance.now() - startTime);
    } catch (error) {
      measurements.push(2000);
      throw error;
    }
  }

  private generateReport(): void {
    const reportPath = path.join(process.cwd(), 'quick-performance-report.json');
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const overallPassed = passedTests === totalTests;

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        overallStatus: overallPassed ? 'PASS' : 'FAIL',
        passedTests,
        totalTests,
        passRate: (passedTests / totalTests) * 100
      },
      requirements: {
        responseTime: '<100ms',
        throughput: '>1000 TPS',
        errorRate: '<5%',
        concurrentUsers: '1000+'
      },
      results: this.results
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📋 QUICK PERFORMANCE VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Overall Result: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests Passed: ${passedTests}/${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log('');

    this.results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.testName}`);
      console.log(`   ${result.details}`);
    });

    console.log('');
    console.log(`📄 Report saved to: ${reportPath}`);

    // Note validation completion
    console.log('\n📝 Performance validation completed successfully');
  }

  private cleanup(): void {
    if (this.serverProcess) {
      console.log('\n🧹 Cleaning up server process...');
      this.serverProcess.kill('SIGTERM');
      
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          this.serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

// Run quick performance test
const tester = new QuickPerformanceTester();
tester.runAllTests().catch(console.error);

export { QuickPerformanceTester, TestResult };