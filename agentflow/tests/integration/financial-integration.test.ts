/**
 * Financial System Integration Tests
 * Tests wallet system + payment processor integration
 */

import request from 'supertest';
import { Server } from '../../api/server';
import { ethers, Wallet } from 'ethers';

describe('Financial System Integration Tests', () => {
  let server: Server;
  let app: any;
  let walletAddress: string;
  let testWalletAddress: string;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
    
    // Create test wallet
    const response = await request(app)
      .post('/api/v1/financial/wallets')
      .expect(201);
    
    walletAddress = response.body.data.address;
    testWalletAddress = Wallet.createRandom().address;
  });

  describe('Wallet Creation → Balance Check → Payment Flow', () => {
    it('should create wallet and verify initial state', async () => {
      const response = await request(app)
        .get(`/api/v1/financial/wallets/${walletAddress}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        address: walletAddress,
        balances: expect.any(Array),
        transactions: expect.any(Array),
        totalValue: expect.any(Number)
      });
    });

    it('should retrieve wallet balance details', async () => {
      const response = await request(app)
        .get(`/api/v1/financial/wallets/${walletAddress}/balance`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        address: walletAddress,
        balances: expect.any(Array),
        totalValue: expect.any(Number)
      });

      // Verify balance has multiple tokens
      expect(response.body.data.balances.length).toBeGreaterThan(0);
    });

    it('should send payment between wallets', async () => {
      const paymentData = {
        amount: 10,
        token: 'USDC',
        recipient: testWalletAddress,
        memo: 'Integration test payment',
        urgency: 'normal'
      };

      const response = await request(app)
        .post(`/api/v1/financial/wallets/${walletAddress}/send`)
        .send(paymentData)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        type: 'send',
        amount: 10,
        token: 'USDC',
        from: walletAddress,
        to: testWalletAddress,
        status: 'pending',
        fee: expect.any(Number)
      });
    });

    it('should verify transaction history after payment', async () => {
      const response = await request(app)
        .get(`/api/v1/financial/wallets/${walletAddress}/transactions`)
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Check that recent transaction is there
      const recentTransaction = response.body.data[0];
      expect(recentTransaction.type).toBe('send');
      expect(recentTransaction.token).toBe('USDC');
    });
  });

  describe('Multi-Token Payment Flow', () => {
    it('should handle payments with different tokens', async () => {
      const tokens = ['ETH', 'USDC', 'DAI', 'QUDAG'];
      
      for (const token of tokens) {
        const paymentData = {
          amount: 1,
          token,
          recipient: testWalletAddress,
          memo: `Test payment with ${token}`,
          urgency: 'normal'
        };

        const response = await request(app)
          .post(`/api/v1/financial/wallets/${walletAddress}/send`)
          .send(paymentData)
          .expect(200);

        expect(response.body.data.token).toBe(token);
        expect(response.body.data.amount).toBe(1);
      }
    });

    it('should get portfolio analysis after multiple payments', async () => {
      const response = await request(app)
        .get(`/api/v1/financial/portfolio/${walletAddress}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        address: walletAddress,
        totalValue: expect.any(Number),
        dayChange: expect.any(Number),
        dayChangePercent: expect.any(Number),
        tokenAllocation: expect.any(Array),
        lastUpdated: expect.any(Number)
      });
    });
  });

  describe('Gas Estimation Integration', () => {
    it('should estimate gas for transaction', async () => {
      const estimateData = {
        from: walletAddress,
        to: testWalletAddress,
        amount: 10,
        token: 'USDC'
      };

      const response = await request(app)
        .post('/api/v1/financial/gas/estimate')
        .send(estimateData)
        .expect(200);

      expect(response.body.data).toMatchObject({
        gasEstimate: expect.any(Number),
        gasPrice: expect.any(Number),
        totalCost: expect.any(Number),
        unit: 'ETH'
      });
    });

    it('should get current gas price', async () => {
      const response = await request(app)
        .get('/api/v1/financial/gas')
        .expect(200);

      expect(response.body.data).toMatchObject({
        gasPrice: expect.any(Number),
        unit: 'gwei',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle insufficient balance gracefully', async () => {
      const paymentData = {
        amount: 999999,
        token: 'USDC',
        recipient: testWalletAddress,
        memo: 'Insufficient balance test'
      };

      const response = await request(app)
        .post(`/api/v1/financial/wallets/${walletAddress}/send`)
        .send(paymentData)
        .expect(400);

      expect(response.body.error.message).toContain('Insufficient balance');
    });

    it('should handle invalid wallet address', async () => {
      const invalidAddress = '0xinvalid';
      
      const response = await request(app)
        .get(`/api/v1/financial/wallets/${invalidAddress}`)
        .expect(400);

      expect(response.body.error.message).toContain('Invalid wallet address');
    });

    it('should handle nonexistent wallet', async () => {
      const nonexistentAddress = Wallet.createRandom().address;
      
      const response = await request(app)
        .get(`/api/v1/financial/wallets/${nonexistentAddress}`)
        .expect(404);

      expect(response.body.error.message).toContain('not found');
    });
  });

  describe('Performance Tests', () => {
    it('should respond to wallet queries in <100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get(`/api/v1/financial/wallets/${walletAddress}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent payment requests', async () => {
      const paymentPromises = [];
      
      for (let i = 0; i < 5; i++) {
        const paymentData = {
          amount: 1,
          token: 'USDC',
          recipient: testWalletAddress,
          memo: `Concurrent payment ${i}`
        };

        paymentPromises.push(
          request(app)
            .post(`/api/v1/financial/wallets/${walletAddress}/send`)
            .send(paymentData)
        );
      }

      const responses = await Promise.all(paymentPromises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.amount).toBe(1);
      });
    });
  });

  describe('Token System Integration', () => {
    it('should list all supported tokens', async () => {
      const response = await request(app)
        .get('/api/v1/financial/tokens')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Check required tokens exist
      const symbols = response.body.data.map((token: any) => token.symbol);
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('QUDAG');
    });

    it('should get specific token information', async () => {
      const response = await request(app)
        .get('/api/v1/financial/tokens/QUDAG')
        .expect(200);

      expect(response.body.data).toMatchObject({
        symbol: 'QUDAG',
        name: 'QuDAG Token',
        decimals: 18,
        price: expect.any(Number),
        change24h: expect.any(Number)
      });
    });
  });
});