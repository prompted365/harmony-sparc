/**
 * Workflow Management Integration Tests
 * Tests complete workflow lifecycle with <100ms responses
 */

import request from 'supertest';
import { Server } from '../../src/server';

describe('Workflow Management Integration Tests', () => {
  let server: Server;
  let app: any;
  let workflowId: string;
  let instanceId: string;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
  });

  describe('Workflow Creation and Validation', () => {
    it('should create a new workflow', async () => {
      const workflowData = {
        workflow: {
          name: 'Integration Test Workflow',
          version: '1.0.0',
          description: 'Test workflow for integration testing',
          nodes: [
            {
              id: 'start',
              type: 'start',
              data: { label: 'Start' },
              position: { x: 100, y: 100 }
            },
            {
              id: 'process',
              type: 'process',
              data: { 
                label: 'Process Data',
                action: 'processData',
                params: { timeout: 5000 }
              },
              position: { x: 200, y: 200 }
            },
            {
              id: 'end',
              type: 'end',
              data: { label: 'End' },
              position: { x: 300, y: 300 }
            }
          ],
          edges: [
            {
              id: 'start-process',
              source: 'start',
              target: 'process',
              type: 'default'
            },
            {
              id: 'process-end',
              source: 'process',
              target: 'end',
              type: 'default'
            }
          ],
          variables: {
            inputData: 'string',
            outputData: 'string',
            timeout: 10000
          },
          triggers: [
            {
              type: 'manual',
              enabled: true
            }
          ],
          metadata: {
            author: 'Integration Test',
            category: 'testing',
            tags: ['integration', 'test'],
            created: new Date()
          }
        },
        autoStart: false
      };

      const response = await request(app)
        .post('/api/v1/workflows')
        .send(workflowData)
        .expect(201);

      expect(response.body.data.workflow).toMatchObject({
        id: expect.any(String),
        name: 'Integration Test Workflow',
        version: '1.0.0',
        nodes: expect.any(Array),
        edges: expect.any(Array)
      });

      workflowId = response.body.data.workflow.id;
    });

    it('should get workflow by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/workflows/${workflowId}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: workflowId,
        name: 'Integration Test Workflow',
        version: '1.0.0',
        nodes: expect.any(Array),
        edges: expect.any(Array)
      });
    });

    it('should validate workflow definition', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${workflowId}/validate`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        valid: expect.any(Boolean),
        errors: expect.any(Array),
        warnings: expect.any(Array)
      });
    });
  });

  describe('Workflow Execution Flow', () => {
    it('should execute workflow synchronously', async () => {
      const executionData = {
        input: {
          inputData: 'test integration data',
          customParam: 'value123'
        },
        options: {
          async: false,
          timeout: 15000,
          priority: 'normal',
          tags: ['integration-test']
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
        startTime: expect.any(String),
        input: expect.any(Object)
      });

      instanceId = response.body.data.id;
    });

    it('should execute workflow asynchronously', async () => {
      const executionData = {
        input: {
          inputData: 'async test data'
        },
        options: {
          async: true,
          priority: 'high'
        }
      };

      const response = await request(app)
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .send(executionData)
        .expect(202);

      expect(response.body.data).toMatchObject({
        instanceId: expect.any(String),
        status: expect.any(String),
        message: 'Workflow execution started'
      });
    });

    it('should get workflow instances', async () => {
      const response = await request(app)
        .get(`/api/v1/workflows/${workflowId}/instances`)
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Verify instance structure
      const instance = response.body.data[0];
      expect(instance).toMatchObject({
        id: expect.any(String),
        workflowId,
        status: expect.any(String),
        startTime: expect.any(String)
      });
    });
  });

  describe('Workflow Instance Control', () => {
    let controlInstanceId: string;

    it('should start workflow for control testing', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .send({
          input: { inputData: 'control test' },
          options: { async: true }
        })
        .expect(202);

      controlInstanceId = response.body.data.instanceId;
    });

    it('should pause workflow instance', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${controlInstanceId}/pause`)
        .expect(200);

      expect(response.body.data.paused).toBe(true);
    });

    it('should resume workflow instance', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${controlInstanceId}/resume`)
        .expect(200);

      expect(response.body.data.resumed).toBe(true);
    });

    it('should cancel workflow instance', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${controlInstanceId}/cancel`)
        .expect(200);

      expect(response.body.data.cancelled).toBe(true);
    });
  });

  describe('Workflow Management Operations', () => {
    it('should list all workflows with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/workflows?page=1&limit=10')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number)
      });
    });

    it('should update workflow definition', async () => {
      const updateData = {
        workflow: {
          description: 'Updated integration test workflow',
          metadata: {
            updated: new Date(),
            version: '1.1.0'
          }
        }
      };

      const response = await request(app)
        .put(`/api/v1/workflows/${workflowId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.description).toBe('Updated integration test workflow');
    });
  });

  describe('Complex Workflow Scenarios', () => {
    let complexWorkflowId: string;

    it('should create complex workflow with multiple paths', async () => {
      const complexWorkflowData = {
        workflow: {
          name: 'Complex Integration Workflow',
          version: '1.0.0',
          description: 'Multi-path workflow for complex testing',
          nodes: [
            { id: 'start', type: 'start', data: { label: 'Start' }, position: { x: 0, y: 0 } },
            { id: 'decision', type: 'decision', data: { label: 'Decision', condition: 'input.type === "A"' }, position: { x: 100, y: 0 } },
            { id: 'pathA', type: 'process', data: { label: 'Path A', action: 'processA' }, position: { x: 200, y: -50 } },
            { id: 'pathB', type: 'process', data: { label: 'Path B', action: 'processB' }, position: { x: 200, y: 50 } },
            { id: 'merge', type: 'merge', data: { label: 'Merge' }, position: { x: 300, y: 0 } },
            { id: 'end', type: 'end', data: { label: 'End' }, position: { x: 400, y: 0 } }
          ],
          edges: [
            { id: 'start-decision', source: 'start', target: 'decision' },
            { id: 'decision-pathA', source: 'decision', target: 'pathA', data: { condition: 'true' } },
            { id: 'decision-pathB', source: 'decision', target: 'pathB', data: { condition: 'false' } },
            { id: 'pathA-merge', source: 'pathA', target: 'merge' },
            { id: 'pathB-merge', source: 'pathB', target: 'merge' },
            { id: 'merge-end', source: 'merge', target: 'end' }
          ],
          variables: {
            inputType: 'string',
            pathTaken: 'string',
            result: 'object'
          }
        }
      };

      const response = await request(app)
        .post('/api/v1/workflows')
        .send(complexWorkflowData)
        .expect(201);

      complexWorkflowId = response.body.data.workflow.id;
    });

    it('should execute complex workflow with path A', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${complexWorkflowId}/execute`)
        .send({
          input: { type: 'A', data: 'test data for path A' },
          options: { async: false, timeout: 20000 }
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        workflowId: complexWorkflowId,
        status: expect.any(String)
      });
    });

    it('should execute complex workflow with path B', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${complexWorkflowId}/execute`)
        .send({
          input: { type: 'B', data: 'test data for path B' },
          options: { async: false, timeout: 20000 }
        })
        .expect(200);

      expect(response.body.data).toMatchObject({
        workflowId: complexWorkflowId,
        status: expect.any(String)
      });
    });
  });

  describe('Performance and Reliability Tests', () => {
    it('should respond to workflow list queries in <100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/workflows')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should respond to workflow details queries in <100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get(`/api/v1/workflows/${workflowId}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent workflow executions', async () => {
      const executionPromises = [];
      
      for (let i = 0; i < 5; i++) {
        executionPromises.push(
          request(app)
            .post(`/api/v1/workflows/${workflowId}/execute`)
            .send({
              input: { inputData: `concurrent test ${i}` },
              options: { async: true, priority: 'normal' }
            })
        );
      }

      const responses = await Promise.all(executionPromises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(202);
        expect(response.body.data.instanceId).toBeDefined();
      });
    });

    it('should handle workflow execution timeout properly', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .send({
          input: { inputData: 'timeout test' },
          options: { async: false, timeout: 1 } // Very short timeout
        })
        .expect(408);

      expect(response.body.error.message).toContain('timeout');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid workflow definition', async () => {
      const invalidWorkflow = {
        workflow: {
          name: 'Invalid Workflow',
          version: 'invalid-version',
          nodes: [], // Empty nodes array - invalid
          edges: []
        }
      };

      const response = await request(app)
        .post('/api/v1/workflows')
        .send(invalidWorkflow)
        .expect(400);

      expect(response.body.error.message).toContain('Invalid workflow definition');
    });

    it('should handle workflow execution with invalid input', async () => {
      const response = await request(app)
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .send({
          input: null, // Invalid input
          options: { async: false }
        })
        .expect(200); // Should handle gracefully with null input

      expect(response.body.data.workflowId).toBe(workflowId);
    });

    it('should handle nonexistent workflow operations', async () => {
      const fakeWorkflowId = 'wf_fake_123456789';
      
      const response = await request(app)
        .get(`/api/v1/workflows/${fakeWorkflowId}`)
        .expect(404);

      expect(response.body.error.message).toContain('not found');
    });

    it('should handle deletion of workflow with running instances', async () => {
      // Start a workflow instance
      const execResponse = await request(app)
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .send({
          input: { inputData: 'delete test' },
          options: { async: true }
        })
        .expect(202);

      // Try to delete workflow with running instance
      const deleteResponse = await request(app)
        .delete(`/api/v1/workflows/${workflowId}`)
        .expect(409);

      expect(deleteResponse.body.error.message).toContain('running instances');
    });

    it('should handle control operations on nonexistent instances', async () => {
      const fakeInstanceId = 'instance_fake_123';
      
      const response = await request(app)
        .post(`/api/v1/workflows/${fakeInstanceId}/pause`)
        .expect(404);

      expect(response.body.error.message).toContain('not found');
    });
  });

  describe('Workflow Sorting and Filtering', () => {
    it('should sort workflows by name', async () => {
      const response = await request(app)
        .get('/api/v1/workflows?sort=name&order=asc')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      
      if (response.body.data.length > 1) {
        const names = response.body.data.map((w: any) => w.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      }
    });

    it('should handle workflow instances pagination', async () => {
      const response = await request(app)
        .get(`/api/v1/workflows/${workflowId}/instances?page=1&limit=5`)
        .expect(200);

      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number)
      });
    });
  });

  describe('Workflow Auto-Start Feature', () => {
    it('should create and auto-start workflow', async () => {
      const autoStartWorkflow = {
        workflow: {
          name: 'Auto-Start Test Workflow',
          version: '1.0.0',
          nodes: [
            { id: 'start', type: 'start', data: { label: 'Start' }, position: { x: 0, y: 0 } },
            { id: 'end', type: 'end', data: { label: 'End' }, position: { x: 100, y: 0 } }
          ],
          edges: [
            { id: 'start-end', source: 'start', target: 'end' }
          ]
        },
        autoStart: true
      };

      const response = await request(app)
        .post('/api/v1/workflows')
        .send(autoStartWorkflow)
        .expect(201);

      expect(response.body.data.workflow).toBeDefined();
      expect(response.body.data.instance).toBeDefined();
    });
  });
});