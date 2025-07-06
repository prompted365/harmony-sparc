/**
 * End-to-End Integration Tests
 * Tests complete system integration: Wallet → Agent → QuDAG → Workflow
 */

import request from 'supertest';
import { Server } from '../../src/server';
import { ethers } from 'ethers';

describe('End-to-End System Integration Tests', () => {
  let server: Server;
  let app: any;
  let walletAddress: string;
  let agentId: string;
  let workflowId: string;
  let orderId: string;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
    
    // Initialize QuDAG connection
    await request(app)
      .post('/api/v1/qudag/connect')
      .expect(200);
  });

  describe('Complete System Workflow: Wallet Creation → Payment → Agent Assignment → Resource Exchange → Workflow Execution', () => {
    it('Step 1: Create wallet and verify balance', async () => {
      console.log('Creating wallet...');
      const response = await request(app)
        .post('/api/v1/financial/wallets')
        .expect(201);

      walletAddress = response.body.data.address;
      expect(ethers.isAddress(walletAddress)).toBe(true);

      // Verify wallet has initial balances
      const balanceResponse = await request(app)
        .get(`/api/v1/financial/wallets/${walletAddress}/balance`)
        .expect(200);

      expect(balanceResponse.body.data.balances.length).toBeGreaterThan(0);
      console.log(`✓ Wallet created: ${walletAddress}`);
    });

    it('Step 2: Create and assign agent for financial operations', async () => {
      console.log('Creating financial agent...');
      const agentData = {
        type: 'financial',
        name: 'E2E Financial Agent',
        capabilities: ['portfolio_analysis', 'payment_processing', 'resource_management'],
        resources: {
          cpu: 4,
          memory: 8192,
          maxConcurrentTasks: 5
        }
      };

      const response = await request(app)
        .post('/api/v1/agents')
        .send(agentData)
        .expect(201);

      agentId = response.body.data.id;
      expect(response.body.data.type).toBe('financial');
      console.log(`✓ Agent created: ${agentId}`);

      // Assign task to agent
      const taskData = {
        agentId,
        taskId: 'e2e_financial_task',
        priority: 9
      };

      await request(app)
        .post('/api/v1/agents/assign')
        .send(taskData)
        .expect(200);

      console.log('✓ Task assigned to agent');
    });

    it('Step 3: Exchange QuDAG resources for computational needs', async () => {
      console.log('Exchanging QuDAG resources...');
      const exchangeRequest = {
        resourceType: 'CPU',
        amount: 4,
        maxPrice: 10.0,
        urgent: true
      };

      const response = await request(app)
        .post('/api/v1/qudag/resources/exchange')
        .send(exchangeRequest)
        .expect(200);

      orderId = response.body.data.orderId;
      expect(response.body.data.status).toBe('FILLED');
      expect(response.body.data.filledAmount).toBe(4);
      console.log(`✓ Resources exchanged: Order ${orderId}`);

      // Verify resource allocation
      const resourceResponse = await request(app)
        .get('/api/v1/qudag/resources/CPU')
        .expect(200);

      expect(resourceResponse.body.data.allocated).toBeGreaterThan(0);
      console.log('✓ Resource allocation verified');
    });

    it('Step 4: Create workflow for automated financial operations', async () => {
      console.log('Creating financial workflow...');
      const workflowData = {
        workflow: {
          name: 'E2E Financial Operations Workflow',
          version: '1.0.0',
          description: 'Automated workflow for financial operations integration',
          nodes: [
            {
              id: 'start',
              type: 'start',
              data: { label: 'Start Financial Operations' },
              position: { x: 0, y: 0 }
            },
            {
              id: 'checkBalance',
              type: 'process',
              data: { 
                label: 'Check Wallet Balance',
                action: 'checkWalletBalance',
                params: { walletAddress }
              },
              position: { x: 100, y: 0 }
            },
            {
              id: 'analyzePortfolio',
              type: 'process',
              data: { 
                label: 'Analyze Portfolio',
                action: 'analyzePortfolio',
                params: { agentId }
              },
              position: { x: 200, y: 0 }
            },
            {
              id: 'executePayment',
              type: 'process',
              data: { 
                label: 'Execute Payment',
                action: 'executePayment',
                params: { amount: 10, token: 'USDC' }
              },
              position: { x: 300, y: 0 }
            },
            {
              id: 'end',
              type: 'end',
              data: { label: 'Complete Operations' },
              position: { x: 400, y: 0 }
            }
          ],
          edges: [
            { id: 'start-check', source: 'start', target: 'checkBalance' },
            { id: 'check-analyze', source: 'checkBalance', target: 'analyzePortfolio' },
            { id: 'analyze-pay', source: 'analyzePortfolio', target: 'executePayment' },
            { id: 'pay-end', source: 'executePayment', target: 'end' }
          ],
          variables: {
            walletAddress: 'string',
            agentId: 'string',
            paymentAmount: 'number',
            portfolioValue: 'number'
          }
        },
        autoStart: false
      };

      const response = await request(app)
        .post('/api/v1/workflows')
        .send(workflowData)
        .expect(201);

      workflowId = response.body.data.workflow.id;
      console.log(`✓ Workflow created: ${workflowId}`);
    });

    it('Step 5: Execute complete workflow with all systems integrated', async () => {
      console.log('Executing end-to-end workflow...');
      const executionData = {
        input: {
          walletAddress,
          agentId,
          paymentAmount: 10,
          targetToken: 'USDC',
          recipientAddress: ethers.Wallet.createRandom().address
        },
        options: {
          async: false,
          timeout: 30000,
          priority: 'high',
          tags: ['e2e-test', 'integration']
        }
      };

      const response = await request(app)
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .send(executionData)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        workflowId,
        status: expect.any(String),
        startTime: expect.any(String)
      });

      console.log(`✓ Workflow executed: Instance ${response.body.data.id}`);
    });

    it('Step 6: Verify all system states after workflow completion', async () => {
      console.log('Verifying system states...');
      
      // Verify agent completed task
      const agentResponse = await request(app)
        .get(`/api/v1/agents/${agentId}`)
        .expect(200);

      expect(agentResponse.body.data.metrics.tasksCompleted).toBeGreaterThan(0);
      console.log('✓ Agent task completion verified');

      // Verify wallet transaction history
      const transactionsResponse = await request(app)
        .get(`/api/v1/financial/wallets/${walletAddress}/transactions`)
        .expect(200);

      expect(transactionsResponse.body.data.length).toBeGreaterThan(0);
      console.log('✓ Wallet transaction history verified');

      // Verify QuDAG resource allocation
      const resourceResponse = await request(app)
        .get('/api/v1/qudag/resources/CPU')
        .expect(200);

      expect(resourceResponse.body.data.allocated).toBeGreaterThan(0);
      console.log('✓ QuDAG resource allocation verified');

      // Verify workflow instances
      const instancesResponse = await request(app)
        .get(`/api/v1/workflows/${workflowId}/instances`)
        .expect(200);

      expect(instancesResponse.body.data.length).toBeGreaterThan(0);
      console.log('✓ Workflow instances verified');
    });
  });

  describe('Multi-User Scenario: Concurrent Operations', () => {
    let user1Wallet: string;
    let user2Wallet: string;
    let user1Agent: string;
    let user2Agent: string;

    it('should handle multiple users with concurrent operations', async () => {
      console.log('Setting up multi-user scenario...');
      
      // Create two wallets
      const wallet1Response = await request(app)
        .post('/api/v1/financial/wallets')
        .expect(201);
      user1Wallet = wallet1Response.body.data.address;

      const wallet2Response = await request(app)
        .post('/api/v1/financial/wallets')
        .expect(201);
      user2Wallet = wallet2Response.body.data.address;

      // Create two agents
      const agent1Response = await request(app)
        .post('/api/v1/agents')
        .send({
          type: 'analyst',
          name: 'User 1 Agent',
          capabilities: ['data_analysis'],
          resources: { cpu: 2, memory: 4096, maxConcurrentTasks: 3 }
        })
        .expect(201);
      user1Agent = agent1Response.body.data.id;

      const agent2Response = await request(app)
        .post('/api/v1/agents')
        .send({
          type: 'coder',
          name: 'User 2 Agent',
          capabilities: ['code_generation'],
          resources: { cpu: 2, memory: 4096, maxConcurrentTasks: 3 }
        })
        .expect(201);
      user2Agent = agent2Response.body.data.id;

      console.log('✓ Multi-user setup complete');
    });

    it('should execute concurrent operations without conflicts', async () => {
      console.log('Executing concurrent operations...');
      
      const operations = [
        // User 1 operations
        request(app)
          .post(`/api/v1/financial/wallets/${user1Wallet}/send`)
          .send({
            amount: 5,
            token: 'USDC',
            recipient: user2Wallet,
            memo: 'Concurrent test payment 1'
          }),
        
        // User 2 operations
        request(app)
          .post(`/api/v1/financial/wallets/${user2Wallet}/send`)
          .send({
            amount: 3,
            token: 'ETH',
            recipient: user1Wallet,
            memo: 'Concurrent test payment 2'
          }),
        
        // QuDAG resource exchanges
        request(app)
          .post('/api/v1/qudag/resources/exchange')
          .send({
            resourceType: 'Memory',
            amount: 2,
            maxPrice: 5.0
          }),
        
        request(app)
          .post('/api/v1/qudag/resources/exchange')
          .send({
            resourceType: 'Storage',
            amount: 10,
            maxPrice: 2.0
          }),
        
        // Agent task assignments
        request(app)
          .post('/api/v1/agents/assign')
          .send({
            agentId: user1Agent,
            taskId: 'concurrent_task_1'
          }),
        
        request(app)
          .post('/api/v1/agents/assign')
          .send({
            agentId: user2Agent,
            taskId: 'concurrent_task_2'
          })
      ];

      const responses = await Promise.all(operations);
      
      // All operations should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      });

      console.log('✓ All concurrent operations completed successfully');
    });
  });

  describe('System Performance Under Load', () => {
    it('should maintain <100ms response times under moderate load', async () => {
      console.log('Testing performance under load...');
      
      const requests = [];
      const startTime = Date.now();
      
      // Create 20 concurrent requests to different endpoints
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app).get('/api/v1/health'),
          request(app).get('/api/v1/financial/tokens'),
          request(app).get('/api/v1/qudag/status'),
          request(app).get('/api/v1/agents/available'),
          request(app).get('/api/v1/workflows')
        );
      }

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const avgResponseTime = totalTime / requests.length;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(100);
      console.log(`✓ Average response time: ${avgResponseTime.toFixed(2)}ms`);
    });

    it('should handle system resource exhaustion gracefully', async () => {
      console.log('Testing resource exhaustion handling...');
      
      // Try to exhaust all available CPU resources
      const exchangePromises = [];
      for (let i = 0; i < 10; i++) {
        exchangePromises.push(
          request(app)
            .post('/api/v1/qudag/resources/exchange')
            .send({
              resourceType: 'CPU',
              amount: 100,
              maxPrice: 1.0
            })
        );
      }

      const responses = await Promise.all(exchangePromises);
      
      // Some should succeed, some should fail gracefully
      let successCount = 0;
      let failureCount = 0;
      
      responses.forEach(response => {
        if (response.status === 200) {
          successCount++;
        } else if (response.status === 400) {
          failureCount++;
          expect(response.body.error.message).toContain('Insufficient resources');
        }
      });

      expect(successCount + failureCount).toBe(responses.length);
      console.log(`✓ Resource exhaustion handled: ${successCount} success, ${failureCount} failures`);
    });
  });

  describe('Error Recovery and System Resilience', () => {
    it('should recover from QuDAG disconnection', async () => {
      console.log('Testing QuDAG disconnection recovery...');
      
      // Disconnect QuDAG
      await request(app)
        .post('/api/v1/qudag/disconnect')
        .expect(200);

      // Try operations that should fail gracefully
      const response = await request(app)
        .post('/api/v1/qudag/resources/exchange')
        .send({
          resourceType: 'CPU',
          amount: 1
        })
        .expect(400);

      // Reconnect
      await request(app)
        .post('/api/v1/qudag/connect')
        .expect(200);

      // Verify operations work again
      await request(app)
        .get('/api/v1/qudag/status')
        .expect(200);

      console.log('✓ QuDAG disconnection recovery successful');
    });

    it('should handle invalid data gracefully across all systems', async () => {
      console.log('Testing invalid data handling...');
      
      const invalidOperations = [
        // Invalid wallet address
        request(app)
          .get('/api/v1/financial/wallets/invalid-address')
          .expect(400),
        
        // Invalid agent type
        request(app)
          .post('/api/v1/agents')
          .send({
            type: 'invalid-type',
            name: 'Invalid Agent',
            capabilities: [],
            resources: { cpu: 1, memory: 1024, maxConcurrentTasks: 1 }
          })
          .expect(400),
        
        // Invalid resource type
        request(app)
          .get('/api/v1/qudag/resources/INVALID')
          .expect(400),
        
        // Invalid workflow
        request(app)
          .post('/api/v1/workflows')
          .send({
            workflow: {
              name: '',
              version: 'invalid',
              nodes: [],
              edges: []
            }
          })
          .expect(400)
      ];

      const responses = await Promise.all(invalidOperations);
      
      // All should fail with proper error messages
      responses.forEach(response => {
        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
      });

      console.log('✓ Invalid data handling verified');
    });
  });

  describe('System State Consistency', () => {
    it('should maintain data consistency across all components', async () => {
      console.log('Verifying system state consistency...');
      
      // Get system metrics from all components
      const [
        healthResponse,
        agentMetricsResponse,
        qudagStatusResponse,
        workflowListResponse
      ] = await Promise.all([
        request(app).get('/api/v1/health/detailed').expect(200),
        request(app).get('/api/v1/agents/system/metrics').expect(200),
        request(app).get('/api/v1/qudag/status').expect(200),
        request(app).get('/api/v1/workflows').expect(200)
      ]);

      // Verify all responses have consistent structure
      expect(healthResponse.body.meta.timestamp).toBeDefined();
      expect(agentMetricsResponse.body.meta.timestamp).toBeDefined();
      expect(qudagStatusResponse.body.meta.timestamp).toBeDefined();
      expect(workflowListResponse.body.meta.timestamp).toBeDefined();

      // Verify system is in healthy state
      expect(healthResponse.body.data.status).toBe('healthy');
      expect(qudagStatusResponse.body.data.connected).toBe(true);

      console.log('✓ System state consistency verified');
    });

    it('should maintain audit trail across all operations', async () => {
      console.log('Verifying audit trail...');
      
      // All operations should have request IDs and timestamps
      const testOperations = [
        request(app).get('/api/v1/financial/tokens').expect(200),
        request(app).get('/api/v1/qudag/events').expect(200),
        request(app).get('/api/v1/agents').expect(200),
        request(app).get('/api/v1/workflows').expect(200)
      ];

      const responses = await Promise.all(testOperations);
      
      responses.forEach(response => {
        expect(response.body.meta).toMatchObject({
          timestamp: expect.any(Number),
          version: '1.0.0',
          requestId: expect.any(String)
        });
      });

      console.log('✓ Audit trail verification complete');
    });
  });

  afterAll(async () => {
    console.log('Cleaning up test data...');
    
    // Complete any pending agent tasks
    if (agentId) {
      await request(app)
        .post(`/api/v1/agents/${agentId}/complete`)
        .send({ taskId: 'e2e_financial_task', success: true })
        .catch(() => {}); // Ignore errors for cleanup
    }
    
    console.log('✓ Test cleanup complete');
  });
});