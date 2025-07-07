/**
 * QuDAG System Integration Tests
 * Tests QuDAG adapter integration with all components
 */

import request from 'supertest';
import { Server } from '../../api/server';

describe('QuDAG System Integration Tests', () => {
  let server: Server;
  let app: any;
  let orderId: string;
  let messageId: string;
  let domainId: string;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
    
    // Ensure QuDAG is connected
    await request(app)
      .post('/api/v1/qudag/connect')
      .expect(200);
  });

  describe('Connection and Status Flow', () => {
    it('should get QuDAG network status', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/status')
        .expect(200);

      expect(response.body.data).toMatchObject({
        connected: expect.any(Boolean),
        peers: expect.any(Number),
        latency: expect.any(Number),
        darkDomainActive: expect.any(Boolean),
        resources: expect.any(Array)
      });
    });

    it('should get health check information', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/health')
        .expect(200);

      expect(response.body.data).toMatchObject({
        status: expect.any(String),
        checks: {
          connectivity: expect.any(Boolean),
          encryption: expect.any(Boolean),
          signing: expect.any(Boolean),
          resourceExchange: expect.any(Boolean),
          performance: expect.any(Boolean)
        },
        metrics: {
          avgLatencyMs: expect.any(Number),
          currentTPS: expect.any(Number),
          memoryUsageMB: expect.any(Number)
        }
      });
    });

    it('should get connection details', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/connection')
        .expect(200);

      expect(response.body.data).toMatchObject({
        connected: true,
        latency: expect.any(Number),
        peers: expect.any(Number),
        darkDomainActive: expect.any(Boolean),
        lastHeartbeat: expect.any(Number)
      });
    });
  });

  describe('Resource Exchange Integration', () => {
    it('should list available resources', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/resources')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Verify all expected resource types
      const resourceTypes = response.body.data.map((resource: any) => resource.type);
      expect(resourceTypes).toContain('CPU');
      expect(resourceTypes).toContain('Storage');
      expect(resourceTypes).toContain('Bandwidth');
      expect(resourceTypes).toContain('Model');
      expect(resourceTypes).toContain('Memory');
    });

    it('should get specific resource balance', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/resources/CPU')
        .expect(200);

      expect(response.body.data).toMatchObject({
        type: 'CPU',
        available: expect.any(Number),
        allocated: expect.any(Number),
        unit: 'cores'
      });
    });

    it('should exchange resources successfully', async () => {
      const exchangeRequest = {
        resourceType: 'CPU',
        amount: 2,
        maxPrice: 5.0,
        urgent: false
      };

      const response = await request(app)
        .post('/api/v1/qudag/resources/exchange')
        .send(exchangeRequest)
        .expect(200);

      expect(response.body.data).toMatchObject({
        orderId: expect.any(String),
        txHash: expect.any(String),
        status: 'FILLED',
        filledAmount: 2,
        remainingAmount: 0,
        averagePrice: expect.any(Number)
      });

      orderId = response.body.data.orderId;
    });

    it('should verify resource balance after exchange', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/resources/CPU')
        .expect(200);

      expect(response.body.data.allocated).toBeGreaterThan(0);
    });
  });

  describe('Order Management Integration', () => {
    it('should list all orders', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/orders')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get specific order details', async () => {
      const response = await request(app)
        .get(`/api/v1/qudag/orders/${orderId}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: orderId,
        type: 'CPU',
        amount: 2,
        price: expect.any(Number),
        timestamp: expect.any(Number),
        status: 'FILLED'
      });
    });
  });

  describe('Transaction History Integration', () => {
    it('should list QuDAG transactions', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/transactions')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Verify transaction structure
      const transaction = response.body.data[0];
      expect(transaction).toMatchObject({
        hash: expect.any(String),
        from: expect.any(String),
        to: expect.any(String),
        value: expect.any(Number),
        resourceType: expect.any(String),
        timestamp: expect.any(Number),
        confirmations: expect.any(Number)
      });
    });

    it('should get specific transaction by hash', async () => {
      // First get a transaction hash
      const listResponse = await request(app)
        .get('/api/v1/qudag/transactions')
        .expect(200);

      const txHash = listResponse.body.data[0].hash;

      const response = await request(app)
        .get(`/api/v1/qudag/transactions/${txHash}`)
        .expect(200);

      expect(response.body.data.hash).toBe(txHash);
    });
  });

  describe('Secure Messaging Integration', () => {
    it('should send secure message', async () => {
      const messageData = {
        recipient: '0x1234567890123456789012345678901234567890',
        message: 'Test secure message for integration',
        encrypted: true
      };

      const response = await request(app)
        .post('/api/v1/qudag/messages/send')
        .send(messageData)
        .expect(200);

      expect(response.body.data).toMatchObject({
        messageId: expect.any(String),
        sent: true
      });

      messageId = response.body.data.messageId;
    });
  });

  describe('Dark Domain Integration', () => {
    it('should register dark domain', async () => {
      domainId = `test-domain-${Date.now()}`;
      
      const domainData = {
        domainId
      };

      const response = await request(app)
        .post('/api/v1/qudag/dark-domain/register')
        .send(domainData)
        .expect(200);

      expect(response.body.data).toMatchObject({
        domainId,
        registered: true
      });
    });

    it('should verify dark domain activation in status', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/status')
        .expect(200);

      expect(response.body.data.darkDomainActive).toBe(true);
    });
  });

  describe('Event System Integration', () => {
    it('should list QuDAG events', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/events')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Verify event structure
      const event = response.body.data[0];
      expect(event).toMatchObject({
        type: expect.any(String),
        data: expect.any(Object),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Performance and Reliability Tests', () => {
    it('should respond to status queries in <100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/qudag/status')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent resource exchanges', async () => {
      const exchangePromises = [];
      
      for (let i = 0; i < 3; i++) {
        const exchangeRequest = {
          resourceType: 'Memory',
          amount: 1,
          maxPrice: 2.0,
          urgent: false
        };

        exchangePromises.push(
          request(app)
            .post('/api/v1/qudag/resources/exchange')
            .send(exchangeRequest)
        );
      }

      const responses = await Promise.all(exchangePromises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('FILLED');
      });
    });

    it('should maintain connection after heavy operations', async () => {
      // Perform multiple operations
      await request(app).get('/api/v1/qudag/resources').expect(200);
      await request(app).get('/api/v1/qudag/transactions').expect(200);
      await request(app).get('/api/v1/qudag/orders').expect(200);
      await request(app).get('/api/v1/qudag/events').expect(200);

      // Verify connection is still active
      const response = await request(app)
        .get('/api/v1/qudag/connection')
        .expect(200);

      expect(response.body.data.connected).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid resource type', async () => {
      const response = await request(app)
        .get('/api/v1/qudag/resources/INVALID')
        .expect(400);

      expect(response.body.error.message).toContain('Invalid resource type');
    });

    it('should handle insufficient resources gracefully', async () => {
      const exchangeRequest = {
        resourceType: 'CPU',
        amount: 999999,
        maxPrice: 1.0
      };

      const response = await request(app)
        .post('/api/v1/qudag/resources/exchange')
        .send(exchangeRequest)
        .expect(400);

      expect(response.body.error.message).toContain('Insufficient resources');
    });

    it('should handle nonexistent order lookup', async () => {
      const fakeOrderId = 'order_fake_12345';
      
      const response = await request(app)
        .get(`/api/v1/qudag/orders/${fakeOrderId}`)
        .expect(404);

      expect(response.body.error.message).toContain('not found');
    });

    it('should handle disconnection and reconnection', async () => {
      // Disconnect
      await request(app)
        .post('/api/v1/qudag/disconnect')
        .expect(200);

      // Verify disconnected
      const disconnectedResponse = await request(app)
        .get('/api/v1/qudag/connection')
        .expect(200);

      expect(disconnectedResponse.body.data.connected).toBe(false);

      // Reconnect
      await request(app)
        .post('/api/v1/qudag/connect')
        .expect(200);

      // Verify reconnected
      const reconnectedResponse = await request(app)
        .get('/api/v1/qudag/connection')
        .expect(200);

      expect(reconnectedResponse.body.data.connected).toBe(true);
    });
  });
});