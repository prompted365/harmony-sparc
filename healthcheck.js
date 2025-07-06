#!/usr/bin/env node

/**
 * Health Check Script for Harmony SPARC Docker Container
 * Performs comprehensive health checks on all system components
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

class HealthChecker {
  constructor() {
    this.checks = [];
    this.results = [];
  }

  async runChecks() {
    console.log('🏥 Starting health checks...');
    
    // Basic API health check
    await this.checkApiHealth();
    
    // Database connectivity
    await this.checkDatabaseHealth();
    
    // Redis connectivity
    await this.checkRedisHealth();
    
    // File system checks
    await this.checkFileSystemHealth();
    
    // Memory and CPU checks
    await this.checkResourceHealth();
    
    // Blockchain connectivity
    await this.checkBlockchainHealth();
    
    // External dependencies
    await this.checkExternalDependencies();
    
    return this.generateReport();
  }

  async checkApiHealth() {
    try {
      const result = await this.makeRequest({
        hostname: 'localhost',
        port: process.env.PORT || 3000,
        path: '/health',
        method: 'GET',
        timeout: 5000
      });
      
      if (result.statusCode === 200) {
        this.results.push({ check: 'API Health', status: 'PASS', details: 'API responding normally' });
      } else {
        this.results.push({ check: 'API Health', status: 'FAIL', details: `HTTP ${result.statusCode}` });
      }
    } catch (error) {
      this.results.push({ check: 'API Health', status: 'FAIL', details: error.message });
    }
  }

  async checkDatabaseHealth() {
    try {
      // This would typically use your database client
      // For now, we'll check if the database port is accessible
      const result = await this.checkPort('postgres', 5432);
      if (result) {
        this.results.push({ check: 'Database', status: 'PASS', details: 'Database port accessible' });
      } else {
        this.results.push({ check: 'Database', status: 'FAIL', details: 'Cannot connect to database' });
      }
    } catch (error) {
      this.results.push({ check: 'Database', status: 'FAIL', details: error.message });
    }
  }

  async checkRedisHealth() {
    try {
      const result = await this.checkPort('redis', 6379);
      if (result) {
        this.results.push({ check: 'Redis', status: 'PASS', details: 'Redis port accessible' });
      } else {
        this.results.push({ check: 'Redis', status: 'FAIL', details: 'Cannot connect to Redis' });
      }
    } catch (error) {
      this.results.push({ check: 'Redis', status: 'FAIL', details: error.message });
    }
  }

  async checkFileSystemHealth() {
    try {
      const checks = [
        { path: '/app/logs', type: 'directory' },
        { path: '/app/dist', type: 'directory' },
        { path: '/app/package.json', type: 'file' }
      ];

      let allPassed = true;
      const details = [];

      for (const check of checks) {
        try {
          const stats = fs.statSync(check.path);
          if (check.type === 'directory' && stats.isDirectory()) {
            details.push(`✓ ${check.path} (directory)`);
          } else if (check.type === 'file' && stats.isFile()) {
            details.push(`✓ ${check.path} (file)`);
          } else {
            allPassed = false;
            details.push(`✗ ${check.path} (wrong type)`);
          }
        } catch (error) {
          allPassed = false;
          details.push(`✗ ${check.path} (${error.code})`);
        }
      }

      this.results.push({
        check: 'File System',
        status: allPassed ? 'PASS' : 'FAIL',
        details: details.join(', ')
      });
    } catch (error) {
      this.results.push({ check: 'File System', status: 'FAIL', details: error.message });
    }
  }

  async checkResourceHealth() {
    try {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const memoryMB = Math.round(usage.rss / 1024 / 1024);
      const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      // Check if memory usage is reasonable (under 1GB for this app)
      const memoryOK = memoryMB < 1024;
      const heapOK = heapMB < 512;
      
      this.results.push({
        check: 'Resource Usage',
        status: memoryOK && heapOK ? 'PASS' : 'WARN',
        details: `Memory: ${memoryMB}MB, Heap: ${heapMB}MB`
      });
    } catch (error) {
      this.results.push({ check: 'Resource Usage', status: 'FAIL', details: error.message });
    }
  }

  async checkBlockchainHealth() {
    try {
      if (process.env.BLOCKCHAIN_RPC_URL) {
        // Check blockchain connectivity
        const url = new URL(process.env.BLOCKCHAIN_RPC_URL);
        const result = await this.checkPort(url.hostname, url.port || 8545);
        
        this.results.push({
          check: 'Blockchain',
          status: result ? 'PASS' : 'FAIL',
          details: result ? 'Blockchain node accessible' : 'Cannot connect to blockchain'
        });
      } else {
        this.results.push({
          check: 'Blockchain',
          status: 'SKIP',
          details: 'No blockchain URL configured'
        });
      }
    } catch (error) {
      this.results.push({ check: 'Blockchain', status: 'FAIL', details: error.message });
    }
  }

  async checkExternalDependencies() {
    try {
      // Check internet connectivity
      const result = await this.makeRequest({
        hostname: 'www.google.com',
        port: 443,
        path: '/',
        method: 'HEAD',
        timeout: 5000
      }, true);
      
      this.results.push({
        check: 'External Connectivity',
        status: result.statusCode < 400 ? 'PASS' : 'FAIL',
        details: `HTTP ${result.statusCode}`
      });
    } catch (error) {
      this.results.push({
        check: 'External Connectivity',
        status: 'FAIL',
        details: error.message
      });
    }
  }

  async checkPort(hostname, port) {
    return new Promise((resolve) => {
      const socket = require('net').createConnection(port, hostname);
      socket.setTimeout(3000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  async makeRequest(options, useHttps = false) {
    const client = useHttps ? https : http;
    
    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });
      
      req.on('error', reject);
      req.setTimeout(options.timeout || 5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  generateReport() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    const overall = failed > 0 ? 'UNHEALTHY' : warnings > 0 ? 'DEGRADED' : 'HEALTHY';
    
    const report = {
      status: overall,
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed,
        failed,
        warnings,
        skipped
      },
      checks: this.results
    };
    
    console.log('🏥 Health Check Results:');
    console.log(`Overall Status: ${overall}`);
    console.log(`Passed: ${passed}, Failed: ${failed}, Warnings: ${warnings}, Skipped: ${skipped}`);
    
    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'WARN' ? '⚠️' : '⏭️';
      console.log(`${icon} ${result.check}: ${result.details}`);
    });
    
    return report;
  }
}

// Run health check if called directly
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runChecks()
    .then(report => {
      if (report.status === 'HEALTHY') {
        process.exit(0);
      } else if (report.status === 'DEGRADED') {
        process.exit(1);
      } else {
        process.exit(2);
      }
    })
    .catch(error => {
      console.error('❌ Health check failed:', error);
      process.exit(3);
    });
}

module.exports = HealthChecker;