const net = require('net');
const http = require('http');

class ServiceWaiter {
  constructor() {
    this.services = [
      { name: 'API Server', host: 'localhost', port: 3000, type: 'http' },
      { name: 'Database', host: 'localhost', port: 5432, type: 'tcp' },
      { name: 'Redis', host: 'localhost', port: 6379, type: 'tcp' },
      { name: 'Blockchain Node', host: 'localhost', port: 8545, type: 'tcp' }
    ];
    this.maxWaitTime = 300000; // 5 minutes
    this.checkInterval = 1000; // 1 second
  }

  async waitForServices() {
    console.log('⏳ Waiting for services to be ready...');
    
    const startTime = Date.now();
    const promises = this.services.map(service => this.waitForService(service));
    
    try {
      await Promise.all(promises);
      console.log('✅ All services are ready!');
      return true;
    } catch (error) {
      console.error('❌ Failed to wait for services:', error.message);
      return false;
    }
  }

  async waitForService(service) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.maxWaitTime) {
      try {
        const isReady = await this.checkService(service);
        if (isReady) {
          console.log(`✅ ${service.name} is ready`);
          return true;
        }
      } catch (error) {
        // Service not ready, continue waiting
      }
      
      await this.sleep(this.checkInterval);
      process.stdout.write('.');
    }
    
    throw new Error(`${service.name} failed to start within ${this.maxWaitTime}ms`);
  }

  async checkService(service) {
    if (service.type === 'http') {
      return this.checkHttpService(service);
    } else if (service.type === 'tcp') {
      return this.checkTcpService(service);
    }
    return false;
  }

  async checkHttpService(service) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: service.host,
        port: service.port,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => resolve(false));
      req.on('timeout', () => resolve(false));
      req.end();
    });
  }

  async checkTcpService(service) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(5000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => resolve(false));
      
      socket.connect(service.port, service.host);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run service waiter if this script is executed directly
if (require.main === module) {
  const waiter = new ServiceWaiter();
  waiter.waitForServices().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = ServiceWaiter;