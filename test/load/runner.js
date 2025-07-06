const { LoadTester } = require('../utils/performance-test');
const http = require('http');
const fs = require('fs');
const path = require('path');

class LoadTestRunner {
  constructor() {
    this.results = [];
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive load testing...');
    
    const tester = new LoadTester();
    
    // Test 1: Basic health check load
    console.log('\n📊 Test 1: Health check load test');
    await tester.runLoadTest(
      'health-check',
      () => this.makeRequest('/health'),
      {
        duration: 30000,
        concurrency: 100,
        targetTPS: 1000
      }
    );
    
    // Test 2: Authentication load
    console.log('\n📊 Test 2: Authentication load test');
    await tester.runLoadTest(
      'auth-load',
      () => this.makeAuthRequest(),
      {
        duration: 60000,
        concurrency: 200,
        targetTPS: 800
      }
    );
    
    // Test 3: Transaction processing load
    console.log('\n📊 Test 3: Transaction processing load test');
    await tester.runLoadTest(
      'transaction-load',
      () => this.makeTransactionRequest(),
      {
        duration: 90000,
        concurrency: 300,
        targetTPS: 1200
      }
    );
    
    // Test 4: Mixed workload
    console.log('\n📊 Test 4: Mixed workload test');
    await tester.runLoadTest(
      'mixed-workload',
      () => this.makeMixedRequest(),
      {
        duration: 120000,
        concurrency: 500,
        targetTPS: 1500
      }
    );
    
    // Test 5: Stress test
    console.log('\n📊 Test 5: Stress test');
    await this.runStressTest();
    
    // Generate summary report
    await this.generateSummaryReport();
    
    console.log('\n✅ Load testing completed!');
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: endpoint,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  async makeAuthRequest() {
    // Simulate user registration/login
    const userCount = Math.floor(Math.random() * 10000);
    
    try {
      await this.makeRequest('/auth/register', {
        method: 'POST',
        body: {
          email: `loadtest${userCount}@example.com`,
          password: 'LoadTest123!',
          username: `loadtest${userCount}`
        }
      });
    } catch (error) {
      // User might already exist, try login instead
      await this.makeRequest('/auth/login', {
        method: 'POST',
        body: {
          email: `loadtest${userCount}@example.com`,
          password: 'LoadTest123!'
        }
      });
    }
  }

  async makeTransactionRequest() {
    // First get auth token
    const authResponse = await this.makeAuthRequest();
    const token = JSON.parse(authResponse.data).token;
    
    // Then make transaction
    return this.makeRequest('/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: {
        type: 'transfer',
        amount: (Math.random() * 1000).toFixed(2),
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
        currency: 'SPARC'
      }
    });
  }

  async makeMixedRequest() {
    const requestTypes = [
      () => this.makeRequest('/health'),
      () => this.makeRequest('/markets'),
      () => this.makeAuthRequest(),
      () => this.makeTransactionRequest()
    ];
    
    const randomRequest = requestTypes[Math.floor(Math.random() * requestTypes.length)];
    return randomRequest();
  }

  async runStressTest() {
    const maxConcurrency = 2000;
    const stepSize = 100;
    const stepDuration = 30000;
    
    console.log(`\n🔥 Stress test: ramping up to ${maxConcurrency} concurrent users`);
    
    for (let concurrency = stepSize; concurrency <= maxConcurrency; concurrency += stepSize) {
      console.log(`\n🔄 Testing with ${concurrency} concurrent users...`);
      
      const tester = new LoadTester();
      await tester.runLoadTest(
        `stress-${concurrency}`,
        () => this.makeRequest('/health'),
        {
          duration: stepDuration,
          concurrency,
          targetTPS: concurrency * 5
        }
      );
      
      const results = tester.getResults();
      this.results.push({
        concurrency,
        ...results
      });
      
      // Break if success rate drops below threshold
      if (results.successRate < 95) {
        console.log(`\n❌ Breaking stress test at ${concurrency} users due to low success rate: ${results.successRate}%`);
        break;
      }
      
      console.log(`✅ Success rate: ${results.successRate}%`);
    }
  }

  async generateSummaryReport() {
    const reportDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      peakTPS: Math.max(...this.results.map(r => r.tps || 0)),
      avgResponseTime: this.results.reduce((sum, r) => sum + (r.performance?.avgDuration || 0), 0) / this.results.length,
      p95: Math.max(...this.results.map(r => r.performance?.percentiles?.p95 || 0)),
      p99: Math.max(...this.results.map(r => r.performance?.percentiles?.p99 || 0)),
      errorRate: this.results.reduce((sum, r) => sum + (100 - r.successRate), 0) / this.results.length,
      maxConcurrentUsers: Math.max(...this.results.map(r => r.concurrency || 0)),
      passed: this.results.every(r => r.successRate >= 95),
      details: this.results
    };
    
    fs.writeFileSync(
      path.join(reportDir, 'load-test-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log(`\n📋 Load Test Summary:`);
    console.log(`   Peak TPS: ${summary.peakTPS}`);
    console.log(`   Average Response Time: ${summary.avgResponseTime.toFixed(2)}ms`);
    console.log(`   95th Percentile: ${summary.p95}ms`);
    console.log(`   99th Percentile: ${summary.p99}ms`);
    console.log(`   Error Rate: ${summary.errorRate.toFixed(2)}%`);
    console.log(`   Max Concurrent Users: ${summary.maxConcurrentUsers}`);
    console.log(`   Overall: ${summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
  }
}

// Run load tests if this script is executed directly
if (require.main === module) {
  const runner = new LoadTestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = LoadTestRunner;