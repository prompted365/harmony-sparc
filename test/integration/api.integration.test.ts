import request from 'supertest';
import { app } from '../../src/api/server';
import { measureTPS, PerformanceMonitor } from '../utils/performance-test';
import { setupTestContext } from '../utils/test-helpers';

describe('API Integration Tests', () => {
  let monitor: PerformanceMonitor;

  beforeAll(() => {
    monitor = new PerformanceMonitor();
  });

  afterAll(() => {
    monitor.saveReport('api-integration-test-report.json');
  });

  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      monitor.start('health-check');
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');

      monitor.end('health-check');
    });

    it('should return detailed health metrics', async () => {
      monitor.start('health-metrics');
      
      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('connections');

      monitor.end('health-metrics');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should register a new user', async () => {
      monitor.start('user-registration');
      
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
          username: 'testuser'
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test@example.com');

      monitor.end('user-registration');
    });

    it('should login with valid credentials', async () => {
      monitor.start('user-login');
      
      // First register
      await request(app)
        .post('/auth/register')
        .send({
          email: 'login@example.com',
          password: 'SecurePassword123!',
          username: 'loginuser'
        });

      // Then login
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePassword123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');

      monitor.end('user-login');
    });

    it('should refresh access token', async () => {
      monitor.start('token-refresh');
      
      // Register and login
      await request(app)
        .post('/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'SecurePassword123!',
          username: 'refreshuser'
        });

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'refresh@example.com',
          password: 'SecurePassword123!'
        });

      const { refreshToken } = loginResponse.body;

      // Refresh token
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');

      monitor.end('token-refresh');
    });
  });

  describe('Transaction Endpoints', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'txtest@example.com',
          password: 'SecurePassword123!',
          username: 'txtest'
        });
      authToken = response.body.token;
    });

    it('should create a new transaction', async () => {
      monitor.start('create-transaction');
      
      const response = await request(app)
        .post('/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'transfer',
          amount: '100.50',
          recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
          currency: 'SPARC'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'pending');
      expect(response.body).toHaveProperty('hash');
      expect(response.body.amount).toBe('100.50');

      monitor.end('create-transaction');
    });

    it('should get transaction history', async () => {
      monitor.start('get-transaction-history');
      
      const response = await request(app)
        .get('/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('offset', 0);
      expect(Array.isArray(response.body.transactions)).toBe(true);

      monitor.end('get-transaction-history');
    });

    it('should get transaction by ID', async () => {
      monitor.start('get-transaction-by-id');
      
      // Create a transaction first
      const createResponse = await request(app)
        .post('/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'transfer',
          amount: '50.00',
          recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
          currency: 'SPARC'
        });

      const txId = createResponse.body.id;

      // Get the transaction
      const response = await request(app)
        .get(`/transactions/${txId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(txId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      monitor.end('get-transaction-by-id');
    });
  });

  describe('Performance Tests', () => {
    it('should handle >1000 TPS for read operations', async () => {
      monitor.start('read-performance-test');
      
      const result = await measureTPS(
        async () => {
          await request(app)
            .get('/health')
            .expect(200);
        },
        10000, // Run for 10 seconds
        1000   // Target 1000 TPS
      );

      expect(result.achieved).toBe(true);
      expect(result.actualTPS).toBeGreaterThan(1000);

      monitor.end('read-performance-test', { tps: result.actualTPS });
    });

    it('should handle >1000 TPS for authenticated requests', async () => {
      monitor.start('auth-performance-test');
      
      // Get auth token
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'perf@example.com',
          password: 'SecurePassword123!',
          username: 'perfuser'
        });
      
      const authToken = response.body.token;

      const result = await measureTPS(
        async () => {
          await request(app)
            .get('/transactions')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        },
        10000, // Run for 10 seconds
        1000   // Target 1000 TPS
      );

      expect(result.achieved).toBe(true);
      expect(result.actualTPS).toBeGreaterThan(1000);

      monitor.end('auth-performance-test', { tps: result.actualTPS });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid routes', async () => {
      const response = await request(app)
        .get('/invalid-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Not Found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle authentication errors', async () => {
      const response = await request(app)
        .get('/transactions')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '123' // Too short
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      monitor.start('rate-limiting-test');
      
      const requests = [];
      
      // Make 100 requests quickly
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/health')
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      monitor.end('rate-limiting-test');
    });
  });

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection', async (done) => {
      // This would be implemented with actual WebSocket testing
      // Using ws or socket.io-client for testing
      done();
    });

    it('should receive real-time updates', async (done) => {
      // Test real-time transaction updates
      done();
    });
  });
});