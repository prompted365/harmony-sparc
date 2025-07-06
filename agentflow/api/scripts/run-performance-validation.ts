#!/usr/bin/env ts-node

/**
 * Performance Validation Runner
 * Comprehensive performance validation suite
 */

import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { PerformanceMonitor, TestConfig } from './performance-monitor';

interface ValidationResult {
  testName: string;
  passed: boolean;
  metrics: {
    throughput: number;
    avgResponseTime: number;
    maxResponseTime: number;
    errorRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  requirements: {
    minThroughput: number;
    maxResponseTime: number;
    maxErrorRate: number;
  };
  details: string;
}

class PerformanceValidator {
  private baseUrl: string;
  private results: ValidationResult[] = [];
  private serverProcess: ChildProcess | null = null;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async runAllValidations(): Promise<void> {
    console.log('🚀 Starting Comprehensive Performance Validation');
    console.log('='.repeat(60));

    try {
      // Start server if not running
      await this.ensureServerRunning();

      // Run all validation tests
      await this.validateResponseTime();
      await this.validateThroughput();
      await this.validateConcurrentUsers();
      await this.validateSustainedLoad();
      await this.validatePaymentProcessing();
      await this.validateDatabasePerformance();
      await this.validateMemoryUsage();
      await this.validateEndToEndTransaction();

      // Generate comprehensive report
      this.generateFinalReport();

    } catch (error) {
      console.error('❌ Performance validation failed:', error);
    } finally {
      this.cleanup();
    }
  }

  private async ensureServerRunning(): Promise<void> {
    console.log('🔍 Checking if server is running...');
    
    try {
      await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      console.log('✅ Server is already running');
    } catch (error) {
      console.log('🚀 Starting server...');
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      // Wait for server to start
      await new Promise((resolve, reject) => {
        const checkServer = async () => {
          try {
            await axios.get(`${this.baseUrl}/health`, { timeout: 1000 });
            resolve(true);
          } catch (error) {
            setTimeout(checkServer, 1000);
          }
        };
        
        setTimeout(() => reject(new Error('Server failed to start')), 30000);
        checkServer();
      });

      console.log('✅ Server started successfully');
    }
  }

  private async validateResponseTime(): Promise<void> {
    console.log('\n📊 Validating Response Time Requirements (<100ms)...');
    
    const measurements: number[] = [];
    const endpoints = ['/health', '/health/detailed', '/health/metrics'];
    
    for (const endpoint of endpoints) {
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await axios.get(`${this.baseUrl}${endpoint}`);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }
    }

    const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const maxResponseTime = Math.max(...measurements);
    const p95ResponseTime = measurements.sort()[Math.floor(measurements.length * 0.95)];
    const p99ResponseTime = measurements.sort()[Math.floor(measurements.length * 0.99)];

    const passed = avgResponseTime < 100 && p95ResponseTime < 100 && p99ResponseTime < 150;

    this.results.push({
      testName: 'Response Time Validation',
      passed,
      metrics: {
        throughput: 0,
        avgResponseTime,
        maxResponseTime,
        errorRate: 0,
        p95ResponseTime,
        p99ResponseTime
      },
      requirements: {
        minThroughput: 0,
        maxResponseTime: 100,
        maxErrorRate: 0
      },
      details: `Average: ${avgResponseTime.toFixed(2)}ms, P95: ${p95ResponseTime.toFixed(2)}ms, P99: ${p99ResponseTime.toFixed(2)}ms`
    });

    console.log(`${passed ? '✅' : '❌'} Response Time: ${avgResponseTime.toFixed(2)}ms avg, ${p95ResponseTime.toFixed(2)}ms P95`);
  }

  private async validateThroughput(): Promise<void> {
    console.log('\n📈 Validating Throughput Requirements (>1000 TPS)...');
    
    const testDuration = 30000; // 30 seconds
    const targetTPS = 1000;
    
    const config: TestConfig = {
      baseUrl: this.baseUrl,
      testDuration,
      targetTPS,
      maxResponseTime: 100,
      maxErrorRate: 5,
      monitoringInterval: 1000,
      endpoints: ['/health', '/health/metrics']
    };

    const monitor = new PerformanceMonitor(config);
    await monitor.start();

    // Read results from generated report
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    const passed = report.results.throughput >= targetTPS && 
                  report.results.responseTime.average <= 100 && 
                  report.results.errorRate <= 5;

    this.results.push({
      testName: 'Throughput Validation',
      passed,
      metrics: {
        throughput: report.results.throughput,
        avgResponseTime: report.results.responseTime.average,
        maxResponseTime: report.results.responseTime.max,
        errorRate: report.results.errorRate,
        p95ResponseTime: report.results.responseTime.p95,
        p99ResponseTime: report.results.responseTime.p99
      },
      requirements: {
        minThroughput: targetTPS,
        maxResponseTime: 100,
        maxErrorRate: 5
      },
      details: `Achieved ${report.results.throughput.toFixed(2)} TPS with ${report.results.responseTime.average.toFixed(2)}ms avg response time`
    });

    console.log(`${passed ? '✅' : '❌'} Throughput: ${report.results.throughput.toFixed(2)} TPS`);
  }

  private async validateConcurrentUsers(): Promise<void> {
    console.log('\n👥 Validating Concurrent Users (1000+ simultaneous)...');
    
    const concurrentUsers = 1000;
    const requestsPerUser = 3;
    const measurements: number[] = [];
    let successCount = 0;
    let totalRequests = 0;

    const userPromises = Array.from({ length: concurrentUsers }, async () => {
      const userMeasurements: number[] = [];
      
      for (let i = 0; i < requestsPerUser; i++) {
        const startTime = performance.now();
        try {
          await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
          const endTime = performance.now();
          userMeasurements.push(endTime - startTime);
          successCount++;
        } catch (error) {
          userMeasurements.push(5000); // Max timeout
        }
        totalRequests++;
      }
      
      return userMeasurements;
    });

    const startTime = performance.now();
    const allResults = await Promise.all(userPromises);
    const endTime = performance.now();

    const flatMeasurements = allResults.flat();
    const avgResponseTime = flatMeasurements.reduce((a, b) => a + b) / flatMeasurements.length;
    const maxResponseTime = Math.max(...flatMeasurements);
    const errorRate = ((totalRequests - successCount) / totalRequests) * 100;
    const actualTPS = (totalRequests / (endTime - startTime)) * 1000;

    const passed = successCount >= totalRequests * 0.95 && 
                  avgResponseTime <= 150 && 
                  actualTPS >= 1000;

    this.results.push({
      testName: 'Concurrent Users Validation',
      passed,
      metrics: {
        throughput: actualTPS,
        avgResponseTime,
        maxResponseTime,
        errorRate,
        p95ResponseTime: flatMeasurements.sort()[Math.floor(flatMeasurements.length * 0.95)],
        p99ResponseTime: flatMeasurements.sort()[Math.floor(flatMeasurements.length * 0.99)]
      },
      requirements: {
        minThroughput: 1000,
        maxResponseTime: 150,
        maxErrorRate: 5
      },
      details: `${concurrentUsers} concurrent users, ${successCount}/${totalRequests} successful requests`
    });

    console.log(`${passed ? '✅' : '❌'} Concurrent Users: ${successCount}/${totalRequests} successful (${actualTPS.toFixed(2)} TPS)`);
  }

  private async validateSustainedLoad(): Promise<void> {
    console.log('\n⏱️ Validating Sustained Load (5 minutes at 1200 TPS)...');
    
    const testDuration = 300000; // 5 minutes
    const targetTPS = 1200;
    
    const config: TestConfig = {
      baseUrl: this.baseUrl,
      testDuration,
      targetTPS,
      maxResponseTime: 100,
      maxErrorRate: 5,
      monitoringInterval: 5000,
      endpoints: ['/health', '/health/metrics', '/health/system']
    };

    const monitor = new PerformanceMonitor(config);
    await monitor.start();

    // Read results
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    const passed = report.results.throughput >= targetTPS && 
                  report.results.responseTime.average <= 100 && 
                  report.results.errorRate <= 5;

    this.results.push({
      testName: 'Sustained Load Validation',
      passed,
      metrics: {
        throughput: report.results.throughput,
        avgResponseTime: report.results.responseTime.average,
        maxResponseTime: report.results.responseTime.max,
        errorRate: report.results.errorRate,
        p95ResponseTime: report.results.responseTime.p95,
        p99ResponseTime: report.results.responseTime.p99
      },
      requirements: {
        minThroughput: targetTPS,
        maxResponseTime: 100,
        maxErrorRate: 5
      },
      details: `Sustained ${report.results.throughput.toFixed(2)} TPS for 5 minutes`
    });

    console.log(`${passed ? '✅' : '❌'} Sustained Load: ${report.results.throughput.toFixed(2)} TPS maintained`);
  }

  private async validatePaymentProcessing(): Promise<void> {
    console.log('\n💳 Validating Payment Processing Performance...');
    
    const measurements: number[] = [];
    let successCount = 0;
    let totalRequests = 0;

    // Create test wallet first
    const walletResponse = await axios.post(`${this.baseUrl}/api/financial/wallets`);
    const walletAddress = walletResponse.data.data.address;

    for (let i = 0; i < 50; i++) {
      const startTime = performance.now();
      try {
        await axios.post(`${this.baseUrl}/api/financial/wallets/${walletAddress}/send`, {
          amount: 0.1,
          token: 'ETH',
          recipient: '0x' + '1'.repeat(40),
          urgency: 'high'
        });
        const endTime = performance.now();
        measurements.push(endTime - startTime);
        successCount++;
      } catch (error) {
        measurements.push(5000);
      }
      totalRequests++;
    }

    const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const maxResponseTime = Math.max(...measurements);
    const errorRate = ((totalRequests - successCount) / totalRequests) * 100;

    const passed = avgResponseTime <= 100 && errorRate <= 5;

    this.results.push({
      testName: 'Payment Processing Validation',
      passed,
      metrics: {
        throughput: 0,
        avgResponseTime,
        maxResponseTime,
        errorRate,
        p95ResponseTime: measurements.sort()[Math.floor(measurements.length * 0.95)],
        p99ResponseTime: measurements.sort()[Math.floor(measurements.length * 0.99)]
      },
      requirements: {
        minThroughput: 0,
        maxResponseTime: 100,
        maxErrorRate: 5
      },
      details: `${successCount}/${totalRequests} payments processed successfully`
    });

    console.log(`${passed ? '✅' : '❌'} Payment Processing: ${avgResponseTime.toFixed(2)}ms avg, ${errorRate.toFixed(2)}% error rate`);
  }

  private async validateDatabasePerformance(): Promise<void> {
    console.log('\n🗄️ Validating Database Query Performance...');
    
    const measurements: number[] = [];
    const queries = [
      '/api/financial/tokens',
      '/api/financial/wallets',
      '/health/detailed'
    ];

    for (const query of queries) {
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await axios.get(`${this.baseUrl}${query}`);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }
    }

    const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const maxResponseTime = Math.max(...measurements);
    const p95ResponseTime = measurements.sort()[Math.floor(measurements.length * 0.95)];

    const passed = avgResponseTime <= 50 && p95ResponseTime <= 100;

    this.results.push({
      testName: 'Database Performance Validation',
      passed,
      metrics: {
        throughput: 0,
        avgResponseTime,
        maxResponseTime,
        errorRate: 0,
        p95ResponseTime,
        p99ResponseTime: measurements.sort()[Math.floor(measurements.length * 0.99)]
      },
      requirements: {
        minThroughput: 0,
        maxResponseTime: 50,
        maxErrorRate: 0
      },
      details: `Database queries averaged ${avgResponseTime.toFixed(2)}ms`
    });

    console.log(`${passed ? '✅' : '❌'} Database Performance: ${avgResponseTime.toFixed(2)}ms avg query time`);
  }

  private async validateMemoryUsage(): Promise<void> {
    console.log('\n🧠 Validating Memory Usage Under Load...');
    
    const initialMemory = process.memoryUsage();
    const requestCount = 1000;
    
    // Generate load
    const promises = Array.from({ length: requestCount }, () => 
      axios.get(`${this.baseUrl}/health`)
    );
    
    await Promise.all(promises);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    const memoryUsage = finalMemory.heapUsed / 1024 / 1024;

    const passed = memoryIncrease < 50 && memoryUsage < 512;

    this.results.push({
      testName: 'Memory Usage Validation',
      passed,
      metrics: {
        throughput: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        errorRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      },
      requirements: {
        minThroughput: 0,
        maxResponseTime: 0,
        maxErrorRate: 0
      },
      details: `Memory increase: ${memoryIncrease.toFixed(2)}MB, Total: ${memoryUsage.toFixed(2)}MB`
    });

    console.log(`${passed ? '✅' : '❌'} Memory Usage: ${memoryIncrease.toFixed(2)}MB increase, ${memoryUsage.toFixed(2)}MB total`);
  }

  private async validateEndToEndTransaction(): Promise<void> {
    console.log('\n🔄 Validating End-to-End Transaction Performance...');
    
    const measurements: number[] = [];
    let successCount = 0;

    for (let i = 0; i < 20; i++) {
      const startTime = performance.now();
      try {
        // Complete transaction flow
        const walletResponse = await axios.post(`${this.baseUrl}/api/financial/wallets`);
        const walletAddress = walletResponse.data.data.address;
        
        await axios.get(`${this.baseUrl}/api/financial/wallets/${walletAddress}/balance`);
        
        await axios.post(`${this.baseUrl}/api/financial/wallets/${walletAddress}/send`, {
          amount: 0.01,
          token: 'ETH',
          recipient: '0x' + '2'.repeat(40),
          urgency: 'normal'
        });
        
        await axios.get(`${this.baseUrl}/api/financial/wallets/${walletAddress}/transactions`);
        
        const endTime = performance.now();
        measurements.push(endTime - startTime);
        successCount++;
      } catch (error) {
        measurements.push(5000);
      }
    }

    const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
    const maxResponseTime = Math.max(...measurements);
    const errorRate = ((20 - successCount) / 20) * 100;

    const passed = avgResponseTime <= 200 && errorRate <= 5;

    this.results.push({
      testName: 'End-to-End Transaction Validation',
      passed,
      metrics: {
        throughput: 0,
        avgResponseTime,
        maxResponseTime,
        errorRate,
        p95ResponseTime: measurements.sort()[Math.floor(measurements.length * 0.95)],
        p99ResponseTime: measurements.sort()[Math.floor(measurements.length * 0.99)]
      },
      requirements: {
        minThroughput: 0,
        maxResponseTime: 200,
        maxErrorRate: 5
      },
      details: `${successCount}/20 complete transactions successful`
    });

    console.log(`${passed ? '✅' : '❌'} End-to-End: ${avgResponseTime.toFixed(2)}ms avg, ${successCount}/20 successful`);
  }

  private generateFinalReport(): void {
    const reportPath = path.join(process.cwd(), 'performance-validation-report.json');
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const overallPassed = passedTests === totalTests;

    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        overallPassed,
        passRate: (passedTests / totalTests) * 100
      },
      requirements: {
        maxResponseTime: 100,
        minThroughput: 1000,
        maxErrorRate: 5,
        supportsConcurrentUsers: 1000
      },
      results: this.results,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📋 PERFORMANCE VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Overall Result: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests Passed: ${passedTests}/${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log('');

    this.results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.testName}`);
      console.log(`   ${result.details}`);
    });

    console.log('');
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }

  private cleanup(): void {
    if (this.serverProcess) {
      console.log('🧹 Cleaning up server process...');
      this.serverProcess.kill();
    }
  }
}

// Run validation
const validator = new PerformanceValidator();
validator.runAllValidations().catch(console.error);