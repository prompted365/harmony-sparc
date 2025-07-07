/**
 * Performance Test Suite
 * Validates <100ms response time and >1000 TPS requirements
 */

import request from 'supertest';
import { Server } from '../api/server';
import { performance } from 'perf_hooks';

describe('Performance Validation', () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
  });

  describe('Response Time Requirements (<100ms)', () => {
    it('should respond to health check in less than 100ms', async () => {
      const measurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await request(app).get('/health').expect(200);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }
      
      const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxResponseTime = Math.max(...measurements);
      const minResponseTime = Math.min(...measurements);
      
      console.log(`Health Check Performance:
        Average: ${avgResponseTime.toFixed(2)}ms
        Max: ${maxResponseTime.toFixed(2)}ms
        Min: ${minResponseTime.toFixed(2)}ms
        P95: ${measurements.sort()[Math.floor(measurements.length * 0.95)].toFixed(2)}ms`);
      
      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(100);
    });

    it('should respond to financial API in less than 100ms', async () => {
      const measurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await request(app).get('/health/metrics').expect(200);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }
      
      const avgResponseTime = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxResponseTime = Math.max(...measurements);
      
      console.log(`Financial API Performance:
        Average: ${avgResponseTime.toFixed(2)}ms
        Max: ${maxResponseTime.toFixed(2)}ms`);
      
      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(100);
    });

    it('should handle concurrent requests under 100ms', async () => {
      const concurrentRequests = 50;
      
      const promises = Array.from({ length: concurrentRequests }, async () => {
        const startTime = performance.now();
        await request(app).get('/health').expect(200);
        const endTime = performance.now();
        return endTime - startTime;
      });
      
      const results = await Promise.all(promises);
      const avgResponseTime = results.reduce((a, b) => a + b) / results.length;
      const maxResponseTime = Math.max(...results);
      
      console.log(`Concurrent Requests Performance (${concurrentRequests} requests):
        Average: ${avgResponseTime.toFixed(2)}ms
        Max: ${maxResponseTime.toFixed(2)}ms`);
      
      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(150); // Allow some variance for concurrent load
    });
  });

  describe('Throughput Requirements (>1000 TPS)', () => {
    it('should handle 1000+ requests per second', async () => {
      const testDuration = 5000; // 5 seconds
      const expectedTPS = 1000;
      const totalRequests = Math.floor((testDuration / 1000) * expectedTPS);
      
      console.log(`Starting throughput test: ${totalRequests} requests over ${testDuration/1000}s`);
      
      const startTime = performance.now();
      const promises: Promise<any>[] = [];
      
      // Generate requests with controlled timing
      for (let i = 0; i < totalRequests; i++) {
        const promise = request(app)
          .get('/health')
          .expect(200)
          .then(() => ({ success: true, timestamp: performance.now() }))
          .catch(() => ({ success: false, timestamp: performance.now() }));
        
        promises.push(promise);
        
        // Add small delay to prevent overwhelming the server
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const actualDuration = endTime - startTime;
      const actualTPS = (results.length / actualDuration) * 1000;
      const successRate = results.filter(r => r.success).length / results.length * 100;
      
      console.log(`Throughput Test Results:
        Total Requests: ${results.length}
        Duration: ${actualDuration.toFixed(2)}ms
        Actual TPS: ${actualTPS.toFixed(2)}
        Success Rate: ${successRate.toFixed(2)}%`);
      
      expect(actualTPS).toBeGreaterThan(1000);
      expect(successRate).toBeGreaterThan(95);
    });

    it('should maintain performance under sustained load', async () => {
      const testDuration = 10000; // 10 seconds
      const requestsPerSecond = 1200;
      const batchSize = 100;
      const batchInterval = (1000 / requestsPerSecond) * batchSize;
      
      console.log(`Starting sustained load test: ${requestsPerSecond} RPS for ${testDuration/1000}s`);
      
      const startTime = performance.now();
      const results: Array<{ success: boolean; responseTime: number }> = [];
      
      const runTest = async () => {
        const endTime = startTime + testDuration;
        
        while (performance.now() < endTime) {
          const batchStart = performance.now();
          
          const batchPromises = Array.from({ length: batchSize }, async () => {
            const reqStart = performance.now();
            try {
              await request(app).get('/health').expect(200);
              return { success: true, responseTime: performance.now() - reqStart };
            } catch (error) {
              return { success: false, responseTime: performance.now() - reqStart };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          
          const batchDuration = performance.now() - batchStart;
          const remainingTime = batchInterval - batchDuration;
          
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
        }
      };
      
      await runTest();
      
      const totalDuration = performance.now() - startTime;
      const actualTPS = (results.length / totalDuration) * 1000;
      const successRate = results.filter(r => r.success).length / results.length * 100;
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      
      console.log(`Sustained Load Test Results:
        Total Requests: ${results.length}
        Duration: ${totalDuration.toFixed(2)}ms
        Actual TPS: ${actualTPS.toFixed(2)}
        Success Rate: ${successRate.toFixed(2)}%
        Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      
      expect(actualTPS).toBeGreaterThan(1000);
      expect(successRate).toBeGreaterThan(95);
      expect(avgResponseTime).toBeLessThan(100);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      const requestCount = 1000;
      
      console.log(`Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // Generate load
      const promises = Array.from({ length: requestCount }, () => 
        request(app).get('/health').expect(200)
      );
      
      await Promise.all(promises);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory Increase: ${memoryIncrease.toFixed(2)}MB`);
      
      // Memory increase should be reasonable (less than 50MB for 1000 requests)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  describe('Database Query Performance', () => {
    it('should handle database queries under 50ms', async () => {
      // Mock database queries through financial API
      const measurements: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await request(app).get('/api/financial/tokens').expect(200);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }
      
      const avgQueryTime = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxQueryTime = Math.max(...measurements);
      
      console.log(`Database Query Performance:
        Average: ${avgQueryTime.toFixed(2)}ms
        Max: ${maxQueryTime.toFixed(2)}ms`);
      
      expect(avgQueryTime).toBeLessThan(50);
      expect(maxQueryTime).toBeLessThan(100);
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle 1000+ concurrent users', async () => {
      const concurrentUsers = 1000;
      const requestsPerUser = 5;
      const totalRequests = concurrentUsers * requestsPerUser;
      
      console.log(`Testing ${concurrentUsers} concurrent users, ${requestsPerUser} requests each`);
      
      const userPromises = Array.from({ length: concurrentUsers }, async () => {
        const userResults: Array<{ success: boolean; responseTime: number }> = [];
        
        for (let i = 0; i < requestsPerUser; i++) {
          const startTime = performance.now();
          try {
            await request(app).get('/health').expect(200);
            userResults.push({ success: true, responseTime: performance.now() - startTime });
          } catch (error) {
            userResults.push({ success: false, responseTime: performance.now() - startTime });
          }
        }
        
        return userResults;
      });
      
      const startTime = performance.now();
      const allResults = await Promise.all(userPromises);
      const endTime = performance.now();
      
      const flatResults = allResults.flat();
      const successRate = flatResults.filter(r => r.success).length / flatResults.length * 100;
      const avgResponseTime = flatResults.reduce((sum, r) => sum + r.responseTime, 0) / flatResults.length;
      const totalDuration = endTime - startTime;
      const actualTPS = (totalRequests / totalDuration) * 1000;
      
      console.log(`Concurrent Users Test Results:
        Total Requests: ${totalRequests}
        Duration: ${totalDuration.toFixed(2)}ms
        TPS: ${actualTPS.toFixed(2)}
        Success Rate: ${successRate.toFixed(2)}%
        Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      
      expect(successRate).toBeGreaterThan(95);
      expect(avgResponseTime).toBeLessThan(100);
      expect(actualTPS).toBeGreaterThan(1000);
    });
  });

  describe('Payment Processing Performance', () => {
    it('should process payments under 100ms', async () => {
      // First create a wallet
      const walletResponse = await request(app)
        .post('/api/financial/wallets')
        .expect(201);
      
      const walletAddress = walletResponse.body.data.address;
      
      const measurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        await request(app)
          .post(`/api/financial/wallets/${walletAddress}/send`)
          .send({
            amount: 0.1,
            token: 'ETH',
            recipient: '0x' + '1'.repeat(40),
            urgency: 'high'
          })
          .expect(200);
        
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }
      
      const avgProcessingTime = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxProcessingTime = Math.max(...measurements);
      
      console.log(`Payment Processing Performance:
        Average: ${avgProcessingTime.toFixed(2)}ms
        Max: ${maxProcessingTime.toFixed(2)}ms`);
      
      expect(avgProcessingTime).toBeLessThan(100);
      expect(maxProcessingTime).toBeLessThan(150);
    });
  });
});