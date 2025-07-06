import { ethers } from 'hardhat';
import request from 'supertest';
import { app } from '../../src/api/server';
import { setupTestContext, advanceTime, expandTo18Decimals } from '../utils/test-helpers';
import { PerformanceMonitor } from '../utils/performance-test';

describe('End-to-End Full Flow Tests', () => {
  let monitor: PerformanceMonitor;
  let authToken: string;
  let userId: string;
  let walletAddress: string;

  beforeAll(async () => {
    monitor = new PerformanceMonitor();
    
    // Register a user
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'e2e@example.com',
        password: 'SecurePassword123!',
        username: 'e2euser'
      });
    
    authToken = response.body.token;
    userId = response.body.user.id;
    walletAddress = response.body.user.walletAddress;
  });

  afterAll(() => {
    monitor.saveReport('e2e-full-flow-report.json');
  });

  describe('Complete User Journey', () => {
    it('should complete full user onboarding flow', async () => {
      monitor.start('full-onboarding-flow');

      // Step 1: Verify email
      const verifyResponse = await request(app)
        .post('/auth/verify-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '123456' }) // In real tests, this would be retrieved from email
        .expect(200);

      expect(verifyResponse.body.verified).toBe(true);

      // Step 2: Complete KYC
      const kycResponse = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          country: 'US',
          documentType: 'passport',
          documentNumber: 'A12345678'
        })
        .expect(200);

      expect(kycResponse.body.status).toBe('pending');

      // Step 3: Simulate KYC approval (in real scenario, this would be async)
      await request(app)
        .post('/admin/kyc/approve')
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .send({ userId })
        .expect(200);

      // Step 4: Fund wallet
      const fundingResponse = await request(app)
        .post('/wallet/fund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '1000',
          currency: 'USDC',
          paymentMethod: 'card'
        })
        .expect(200);

      expect(fundingResponse.body.balance).toBe('1000');

      monitor.end('full-onboarding-flow');
    });

    it('should complete full staking flow', async () => {
      monitor.start('full-staking-flow');

      // Step 1: Get staking options
      const stakingOptions = await request(app)
        .get('/staking/options')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(stakingOptions.body.length).toBeGreaterThan(0);
      const selectedOption = stakingOptions.body[0];

      // Step 2: Calculate expected rewards
      const rewardsCalc = await request(app)
        .post('/staking/calculate-rewards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          poolId: selectedOption.id,
          amount: '500',
          duration: 30 // days
        })
        .expect(200);

      expect(rewardsCalc.body.estimatedRewards).toBeDefined();
      expect(parseFloat(rewardsCalc.body.apy)).toBeGreaterThan(0);

      // Step 3: Stake tokens
      const stakeResponse = await request(app)
        .post('/staking/stake')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          poolId: selectedOption.id,
          amount: '500'
        })
        .expect(200);

      expect(stakeResponse.body.stakeId).toBeDefined();
      expect(stakeResponse.body.status).toBe('active');

      // Step 4: Check staking position
      const positionResponse = await request(app)
        .get(`/staking/positions/${stakeResponse.body.stakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(positionResponse.body.amount).toBe('500');
      expect(positionResponse.body.rewards).toBe('0'); // No rewards yet

      // Step 5: Advance time and claim rewards
      await advanceTime(30 * 24 * 60 * 60); // 30 days

      const claimResponse = await request(app)
        .post(`/staking/positions/${stakeResponse.body.stakeId}/claim`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(parseFloat(claimResponse.body.claimedAmount)).toBeGreaterThan(0);

      monitor.end('full-staking-flow');
    });

    it('should complete full trading flow', async () => {
      monitor.start('full-trading-flow');

      // Step 1: Get market data
      const marketsResponse = await request(app)
        .get('/markets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(marketsResponse.body.length).toBeGreaterThan(0);
      const market = marketsResponse.body.find(m => m.pair === 'SPARC/USDC');

      // Step 2: Get order book
      const orderBookResponse = await request(app)
        .get(`/markets/${market.id}/orderbook`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(orderBookResponse.body.bids.length).toBeGreaterThan(0);
      expect(orderBookResponse.body.asks.length).toBeGreaterThan(0);

      // Step 3: Place limit order
      const orderResponse = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          marketId: market.id,
          side: 'buy',
          type: 'limit',
          amount: '10',
          price: orderBookResponse.body.asks[0].price
        })
        .expect(201);

      expect(orderResponse.body.orderId).toBeDefined();
      expect(orderResponse.body.status).toBe('open');

      // Step 4: Check order status
      const orderStatus = await request(app)
        .get(`/orders/${orderResponse.body.orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(['open', 'filled', 'partially_filled']).toContain(orderStatus.body.status);

      // Step 5: Get trade history
      const tradesResponse = await request(app)
        .get('/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ marketId: market.id })
        .expect(200);

      expect(Array.isArray(tradesResponse.body.trades)).toBe(true);

      monitor.end('full-trading-flow');
    });

    it('should complete full governance flow', async () => {
      monitor.start('full-governance-flow');

      // Step 1: Get voting power
      const votingPowerResponse = await request(app)
        .get('/governance/voting-power')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(parseFloat(votingPowerResponse.body.votingPower)).toBeGreaterThanOrEqual(0);

      // Step 2: Get active proposals
      const proposalsResponse = await request(app)
        .get('/governance/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'active' })
        .expect(200);

      if (proposalsResponse.body.proposals.length > 0) {
        const proposal = proposalsResponse.body.proposals[0];

        // Step 3: Get proposal details
        const proposalDetails = await request(app)
          .get(`/governance/proposals/${proposal.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(proposalDetails.body.description).toBeDefined();
        expect(proposalDetails.body.votingOptions).toBeDefined();

        // Step 4: Cast vote
        const voteResponse = await request(app)
          .post(`/governance/proposals/${proposal.id}/vote`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            option: 'for',
            reason: 'I support this proposal'
          })
          .expect(200);

        expect(voteResponse.body.voteId).toBeDefined();
        expect(voteResponse.body.votingPower).toBeDefined();

        // Step 5: Check vote receipt
        const voteReceipt = await request(app)
          .get(`/governance/proposals/${proposal.id}/votes/${voteResponse.body.voteId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(voteReceipt.body.option).toBe('for');
        expect(voteReceipt.body.voter).toBe(walletAddress);
      }

      monitor.end('full-governance-flow');
    });

    it('should complete full ML prediction flow', async () => {
      monitor.start('full-ml-prediction-flow');

      // Step 1: Get available ML models
      const modelsResponse = await request(app)
        .get('/ml/models')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(modelsResponse.body.length).toBeGreaterThan(0);
      const priceModel = modelsResponse.body.find(m => m.type === 'price_prediction');

      // Step 2: Get historical data for training context
      const historicalData = await request(app)
        .get('/markets/SPARC-USDC/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ interval: '1h', limit: 168 }) // 1 week
        .expect(200);

      expect(historicalData.body.candles.length).toBeGreaterThan(0);

      // Step 3: Request price prediction
      const predictionResponse = await request(app)
        .post('/ml/predict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          modelId: priceModel.id,
          input: {
            symbol: 'SPARC',
            timeframe: '24h',
            features: ['price', 'volume', 'volatility']
          }
        })
        .expect(200);

      expect(predictionResponse.body.prediction).toBeDefined();
      expect(predictionResponse.body.confidence).toBeGreaterThan(0);
      expect(predictionResponse.body.confidence).toBeLessThanOrEqual(1);

      // Step 4: Get prediction explanation
      const explanationResponse = await request(app)
        .get(`/ml/predictions/${predictionResponse.body.predictionId}/explain`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(explanationResponse.body.features).toBeDefined();
      expect(explanationResponse.body.shap_values).toBeDefined();

      // Step 5: Provide feedback for model improvement
      const feedbackResponse = await request(app)
        .post(`/ml/predictions/${predictionResponse.body.predictionId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          accuracy: 0.85,
          comments: 'Prediction was close to actual',
          actualValue: 10.5
        })
        .expect(200);

      expect(feedbackResponse.body.feedbackId).toBeDefined();

      monitor.end('full-ml-prediction-flow');
    });

    it('should complete full quantum optimization flow', async () => {
      monitor.start('full-quantum-optimization-flow');

      // Step 1: Check quantum service availability
      const quantumStatus = await request(app)
        .get('/quantum/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (quantumStatus.body.available) {
        // Step 2: Submit portfolio optimization task
        const optimizationRequest = await request(app)
          .post('/quantum/optimize-portfolio')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            assets: ['SPARC', 'ETH', 'BTC', 'USDC'],
            constraints: {
              maxRisk: 0.2,
              minReturn: 0.15,
              maxAllocation: 0.4
            },
            optimizationType: 'sharpe_ratio'
          })
          .expect(202); // Accepted for processing

        expect(optimizationRequest.body.taskId).toBeDefined();
        expect(optimizationRequest.body.estimatedTime).toBeDefined();

        // Step 3: Poll for results (in real scenario, use websockets)
        let result;
        let attempts = 0;
        while (attempts < 10) {
          const statusResponse = await request(app)
            .get(`/quantum/tasks/${optimizationRequest.body.taskId}`)
            .set('Authorization', `Bearer ${authToken}`);

          if (statusResponse.body.status === 'completed') {
            result = statusResponse.body.result;
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }

        if (result) {
          expect(result.allocations).toBeDefined();
          expect(result.expectedReturn).toBeGreaterThan(0.15);
          expect(result.risk).toBeLessThan(0.2);
          expect(result.sharpeRatio).toBeDefined();

          // Step 4: Apply optimization
          const applyResponse = await request(app)
            .post('/portfolio/rebalance')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              allocations: result.allocations,
              executionType: 'market',
              slippageTolerance: 0.01
            })
            .expect(200);

          expect(applyResponse.body.transactions).toBeDefined();
          expect(applyResponse.body.status).toBe('executed');
        }
      }

      monitor.end('full-quantum-optimization-flow');
    });

    it('should handle concurrent multi-user scenarios', async () => {
      monitor.start('concurrent-multi-user-flow');

      const userCount = 10;
      const users = [];

      // Create multiple users
      for (let i = 0; i < userCount; i++) {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: `concurrent${i}@example.com`,
            password: 'SecurePassword123!',
            username: `concurrent${i}`
          });

        users.push({
          token: response.body.token,
          userId: response.body.user.id
        });
      }

      // Simulate concurrent activities
      const activities = users.map(async (user, index) => {
        // Each user performs different actions
        const actions = [];

        // Check balance
        actions.push(
          request(app)
            .get('/wallet/balance')
            .set('Authorization', `Bearer ${user.token}`)
        );

        // Get market data
        actions.push(
          request(app)
            .get('/markets')
            .set('Authorization', `Bearer ${user.token}`)
        );

        // Submit transaction
        actions.push(
          request(app)
            .post('/transactions')
            .set('Authorization', `Bearer ${user.token}`)
            .send({
              type: 'transfer',
              amount: '10',
              recipient: users[(index + 1) % userCount].userId,
              currency: 'SPARC'
            })
        );

        return Promise.all(actions);
      });

      const results = await Promise.all(activities);
      
      // Verify all users completed their actions
      results.forEach(userResults => {
        expect(userResults[0].status).toBe(200); // Balance check
        expect(userResults[1].status).toBe(200); // Market data
        expect([200, 201]).toContain(userResults[2].status); // Transaction
      });

      monitor.end('concurrent-multi-user-flow');
    });
  });

  describe('Error Recovery Flows', () => {
    it('should handle and recover from network failures', async () => {
      monitor.start('network-failure-recovery');

      // Simulate network failure during transaction
      const originalFetch = global.fetch;
      let callCount = 0;

      global.fetch = jest.fn(async (...args) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Network error');
        }
        return originalFetch(...args);
      });

      try {
        // Attempt transaction that will fail
        const response = await request(app)
          .post('/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'transfer',
            amount: '50',
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
            currency: 'SPARC'
          });

        // Should handle gracefully
        expect([200, 201, 503]).toContain(response.status);
        
        if (response.status === 503) {
          expect(response.body.error).toContain('temporarily unavailable');
          expect(response.body.retryAfter).toBeDefined();
        }
      } finally {
        global.fetch = originalFetch;
      }

      monitor.end('network-failure-recovery');
    });

    it('should handle partial system failures', async () => {
      monitor.start('partial-failure-handling');

      // Test graceful degradation when some services are down
      const response = await request(app)
        .get('/health/detailed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.services).toBeDefined();
      
      // Even if some services are down, critical services should be up
      expect(response.body.services.api).toBe('healthy');
      expect(response.body.services.database).toBe('healthy');

      monitor.end('partial-failure-handling');
    });
  });
});