import request from 'supertest';
import { Server } from '../api/server';

describe('Health Check Endpoints', () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
  });

  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        responseTime: expect.any(String)
      });
    });

    it('should respond in less than 100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 and alive status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toEqual({
        status: 'alive'
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 and ready status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ready',
        checks: expect.any(Object),
        responseTime: expect.any(String)
      });
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: {
          process: expect.any(Number),
          system: expect.any(Number)
        },
        memory: {
          rss: expect.any(String),
          heapTotal: expect.any(String),
          heapUsed: expect.any(String),
          external: expect.any(String)
        },
        system: {
          platform: expect.any(String),
          cpus: expect.any(Number),
          loadAverage: expect.any(Array),
          totalMemory: expect.any(String),
          freeMemory: expect.any(String)
        },
        config: {
          env: expect.any(String),
          port: expect.any(Number),
          targetTPS: expect.any(Number)
        },
        responseTime: expect.any(String)
      });
    });
  });
});