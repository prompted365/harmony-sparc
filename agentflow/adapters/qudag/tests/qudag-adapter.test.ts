/**
 * Tests for QuDAG Adapter
 * Comprehensive test suite for quantum-resistant communication and resource exchange
 */

import { QuDAGAdapter } from '../index';
import {
  QuDAGConfig,
  ResourceType,
  ResourceOrder,
  OrderStatus,
  QuDAGEventType,
  QuDAGErrorCode
} from '../types';

describe('QuDAGAdapter', () => {
  let adapter: QuDAGAdapter;
  let config: QuDAGConfig;

  beforeEach(() => {
    config = {
      nodeUrl: 'http://localhost:8000',
      rpcPort: 9090,
      darkDomain: 'test-agent.dark',
      onionRoutingHops: 3,
      obfuscation: true,
      resourceTypes: [ResourceType.CPU, ResourceType.STORAGE],
      performanceTargets: {
        maxLatencyMs: 100,
        targetTPS: 1000,
        maxMemoryMB: 500
      }
    };
    adapter = new QuDAGAdapter(config);
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  describe('Initialization', () => {
    it('should initialize successfully with quantum-resistant keys', async () => {
      await adapter.initialize();
      
      const status = adapter.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.darkDomainActive).toBe(true);
      
      const publicKey = adapter.getPublicKey();
      expect(publicKey).toBeDefined();
      expect(publicKey.length).toBeGreaterThan(0);
    });

    it('should emit connection status change on initialization', async () => {
      const connectionPromise = new Promise(resolve => {
        adapter.on(QuDAGEventType.CONNECTION_STATUS_CHANGED, (event) => {
          resolve(event);
        });
      });

      await adapter.initialize();
      const event: any = await connectionPromise;
      
      expect(event.connected).toBe(true);
      expect(event.timestamp).toBeDefined();
    });

    it('should handle initialization failure gracefully', async () => {
      // Create adapter with invalid config
      const badConfig = { ...config, nodeUrl: 'invalid-url' };
      const badAdapter = new QuDAGAdapter(badConfig);
      
      // Mock network failure
      jest.spyOn(badAdapter as any, 'networkManager', 'get').mockReturnValue({
        connect: jest.fn().mockRejectedValue(new Error('Connection failed'))
      });

      await expect(badAdapter.initialize()).rejects.toThrow();
    });
  });

  describe('Secure Messaging', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should send encrypted message successfully', async () => {
      const recipient = 'recipient.dark';
      const payload = { 
        type: 'test',
        data: 'Hello, quantum world!'
      };

      const messageId = await adapter.sendMessage(recipient, payload);
      
      expect(messageId).toBeDefined();
      expect(messageId).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('should use onion routing when configured', async () => {
      const recipient = 'secure-recipient.dark';
      const payload = { sensitive: true };

      // Spy on routing manager
      const routingManager = (adapter as any).routingManager;
      const sendSpy = jest.spyOn(routingManager, 'sendThroughOnionRoute');

      await adapter.sendMessage(recipient, payload);

      expect(sendSpy).toHaveBeenCalled();
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient,
          payload: expect.any(Uint8Array),
          signature: expect.any(Uint8Array)
        }),
        config.onionRoutingHops
      );
    });

    it('should handle message sending errors', async () => {
      await adapter.disconnect();

      await expect(
        adapter.sendMessage('recipient.dark', { test: true })
      ).rejects.toThrow('QuDAG adapter not initialized');
    });
  });

  describe('Resource Exchange', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should create and submit resource order', async () => {
      const order: ResourceOrder = {
        type: ResourceType.CPU,
        amount: 100,
        price: 0.5,
        timestamp: Date.now(),
        signature: new Uint8Array()
      };

      const result = await adapter.createResourceOrder(order);

      expect(result.orderId).toBeDefined();
      expect(result.status).toBe(OrderStatus.FILLED);
      expect(result.filledAmount).toBe(order.amount);
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should emit resource exchange event', async () => {
      const eventPromise = new Promise(resolve => {
        adapter.on(QuDAGEventType.RESOURCE_EXCHANGE_COMPLETED, resolve);
      });

      const order: ResourceOrder = {
        type: ResourceType.STORAGE,
        amount: 50,
        price: 0.1,
        timestamp: Date.now(),
        signature: new Uint8Array()
      };

      await adapter.createResourceOrder(order);
      const event: any = await eventPromise;

      expect(event.result).toBeDefined();
      expect(event.result.orderId).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    it('should get resource balances', async () => {
      const balances = await adapter.getResourceBalances();

      expect(Array.isArray(balances)).toBe(true);
      expect(balances.length).toBeGreaterThan(0);
      
      const cpuBalance = balances.find(b => b.type === ResourceType.CPU);
      expect(cpuBalance).toBeDefined();
      expect(cpuBalance?.available).toBeGreaterThanOrEqual(0);
      expect(cpuBalance?.unit).toBe('vCPU-hours');
    });

    it('should handle insufficient resources', async () => {
      const largeOrder: ResourceOrder = {
        type: ResourceType.CPU,
        amount: 999999, // More than available
        price: 1.0,
        timestamp: Date.now(),
        signature: new Uint8Array()
      };

      await expect(
        adapter.createResourceOrder(largeOrder)
      ).rejects.toThrow('Insufficient resources');
    });
  });

  describe('Dark Domain Operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should resolve registered dark domain', async () => {
      const address = await adapter.resolveDarkDomain('test-agent.dark');
      
      expect(address).toBeDefined();
      expect(address).toMatch(/^\/qudag\/p2p\/[a-f0-9]+$/);
    });

    it('should handle domain not found', async () => {
      await expect(
        adapter.resolveDarkDomain('non-existent.dark')
      ).rejects.toThrow('Domain not found');
    });

    it('should create shadow addresses', async () => {
      const domainManager = (adapter as any).domainManager;
      const shadowDomain = await domainManager.generateShadowAddress(60000);
      
      expect(shadowDomain).toMatch(/^shadow-[a-z0-9]+\.dark$/);
      
      // Should be resolvable
      const address = await adapter.resolveDarkDomain(shadowDomain);
      expect(address).toBeDefined();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should perform comprehensive health check', async () => {
      const health = await adapter.performHealthCheck();

      expect(health.status).toBe('healthy');
      expect(health.checks.connectivity).toBe(true);
      expect(health.checks.encryption).toBe(true);
      expect(health.checks.signing).toBe(true);
      expect(health.checks.resourceExchange).toBe(true);
      expect(health.checks.performance).toBe(true);
      
      expect(health.metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(health.metrics.currentTPS).toBeGreaterThanOrEqual(0);
      expect(health.metrics.memoryUsageMB).toBeGreaterThan(0);
    });

    it('should detect degraded performance', async () => {
      // Mock high latency
      const networkManager = (adapter as any).networkManager;
      jest.spyOn(networkManager, 'getAverageLatency').mockReturnValue(150);
      
      const health = await adapter.performHealthCheck();
      
      expect(health.checks.performance).toBe(false);
      expect(health.status).not.toBe('healthy');
    });
  });

  describe('Connection Management', () => {
    it('should maintain connection status', async () => {
      await adapter.initialize();
      
      let status = adapter.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.peers).toBeGreaterThan(0);
      
      await adapter.disconnect();
      
      status = adapter.getConnectionStatus();
      expect(status.connected).toBe(false);
    });

    it('should emit disconnection event', async () => {
      await adapter.initialize();

      const eventPromise = new Promise(resolve => {
        adapter.on(QuDAGEventType.CONNECTION_STATUS_CHANGED, (event) => {
          if (!event.connected) resolve(event);
        });
      });

      await adapter.disconnect();
      const event: any = await eventPromise;
      
      expect(event.connected).toBe(false);
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should emit performance metrics', async () => {
      const metricPromise = new Promise(resolve => {
        adapter.on(QuDAGEventType.PERFORMANCE_METRIC, resolve);
      });

      await adapter.sendMessage('test.dark', { metric: 'test' });
      
      const metric: any = await metricPromise;
      expect(metric.metric.type).toBe('message_sent');
      expect(metric.metric.latency).toBeDefined();
      expect(metric.timestamp).toBeDefined();
    });

    it('should track performance against targets', async () => {
      const health = await adapter.performHealthCheck();
      
      if (config.performanceTargets) {
        expect(health.metrics.avgLatencyMs).toBeLessThanOrEqual(
          config.performanceTargets.maxLatencyMs * 2 // Allow some margin
        );
        expect(health.metrics.memoryUsageMB).toBeLessThanOrEqual(
          config.performanceTargets.maxMemoryMB
        );
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw appropriate errors with error codes', async () => {
      try {
        await adapter.sendMessage('test.dark', {});
      } catch (error: any) {
        expect(error.name).toBe('QuDAGError');
        expect(error.code).toBe(QuDAGErrorCode.CONNECTION_FAILED);
      }
    });

    it('should handle network failures gracefully', async () => {
      await adapter.initialize();
      
      // Mock network failure
      const networkManager = (adapter as any).networkManager;
      jest.spyOn(networkManager, 'sendMessage').mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        adapter.sendMessage('test.dark', { fail: true })
      ).rejects.toThrow('Message sending failed');
    });
  });

  describe('Cryptographic Operations', () => {
    it('should test encryption functionality', async () => {
      const cryptoManager = (adapter as any).cryptoManager;
      const result = await cryptoManager.testEncryption();
      expect(result).toBe(true);
    });

    it('should test signing functionality', async () => {
      const cryptoManager = (adapter as any).cryptoManager;
      const result = await cryptoManager.testSigning();
      expect(result).toBe(true);
    });
  });
});

// Integration tests
describe('QuDAGAdapter Integration', () => {
  let adapter: QuDAGAdapter;

  beforeAll(async () => {
    adapter = new QuDAGAdapter({
      nodeUrl: 'http://localhost:8000',
      rpcPort: 9090,
      darkDomain: 'integration-test.dark',
      onionRoutingHops: 5
    });
    await adapter.initialize();
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  it('should handle complete workflow', async () => {
    // Send message
    const messageId = await adapter.sendMessage('recipient.dark', {
      workflow: 'test',
      step: 1
    });
    expect(messageId).toBeDefined();

    // Create resource order
    const order: ResourceOrder = {
      type: ResourceType.CPU,
      amount: 10,
      price: 0.1,
      timestamp: Date.now(),
      signature: new Uint8Array()
    };
    const result = await adapter.createResourceOrder(order);
    expect(result.status).toBe(OrderStatus.FILLED);

    // Check balances
    const balances = await adapter.getResourceBalances();
    const cpuBalance = balances.find(b => b.type === ResourceType.CPU);
    expect(cpuBalance?.allocated).toBeGreaterThan(0);

    // Verify health
    const health = await adapter.performHealthCheck();
    expect(health.status).toBe('healthy');
  });
});