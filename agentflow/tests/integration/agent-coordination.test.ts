/**
 * Agent Coordination Integration Tests
 * Tests agent management and coordination flows
 */

import request from 'supertest';
import { Server } from '../../src/server';

describe('Agent Coordination Integration Tests', () => {
  let server: Server;
  let app: any;
  let agentId: string;
  let taskId: string;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
    
    // Generate test task ID
    taskId = `task_${Date.now()}_test`;
  });

  describe('Agent Lifecycle Management', () => {
    it('should list initial agents', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Verify agent structure
      const agent = response.body.data[0];
      expect(agent).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        status: expect.any(String),
        capabilities: expect.any(Array),
        metrics: expect.any(Object)
      });
    });

    it('should create a new agent', async () => {
      const agentData = {
        type: 'tester',
        name: 'Integration Test Agent',
        capabilities: ['integration_testing', 'performance_analysis', 'error_detection'],
        resources: {
          cpu: 2,
          memory: 4096,
          maxConcurrentTasks: 3
        }
      };

      const response = await request(app)
        .post('/api/v1/agents')
        .send(agentData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        type: 'tester',
        status: 'idle',
        capabilities: ['integration_testing', 'performance_analysis', 'error_detection'],
        metrics: {
          tasksCompleted: 0,
          successRate: 0,
          avgExecutionTime: 0,
          lastActive: expect.any(String)
        }
      });

      agentId = response.body.data.id;
    });

    it('should get agent by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/agents/${agentId}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: agentId,
        type: 'tester',
        status: 'idle',
        capabilities: expect.any(Array)
      });
    });

    it('should update agent capabilities', async () => {
      const updateData = {
        capabilities: ['integration_testing', 'performance_analysis', 'error_detection', 'load_testing'],
        resources: {
          cpu: 4,
          memory: 8192,
          maxConcurrentTasks: 5
        }
      };

      const response = await request(app)
        .put(`/api/v1/agents/${agentId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.capabilities).toContain('load_testing');
    });
  });

  describe('Task Assignment and Execution Flow', () => {
    it('should assign task to agent', async () => {
      const assignmentData = {
        agentId,
        taskId,
        priority: 8
      };

      const response = await request(app)
        .post('/api/v1/agents/assign')
        .send(assignmentData)
        .expect(200);

      expect(response.body.data).toMatchObject({
        assigned: true,
        agentId,
        taskId
      });
    });

    it('should verify agent status changed to busy', async () => {
      const response = await request(app)
        .get(`/api/v1/agents/${agentId}`)
        .expect(200);

      expect(response.body.data.status).toBe('busy');
      expect(response.body.data.currentTask).toBe(taskId);
    });

    it('should get agent metrics during task execution', async () => {
      const response = await request(app)
        .get(`/api/v1/agents/${agentId}/metrics`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        tasksCompleted: expect.any(Number),
        successRate: expect.any(Number),
        avgExecutionTime: expect.any(Number),
        lastActive: expect.any(String)
      });
    });

    it('should complete task successfully', async () => {
      const completionData = {
        taskId,
        success: true
      };

      const response = await request(app)
        .post(`/api/v1/agents/${agentId}/complete`)
        .send(completionData)
        .expect(200);

      expect(response.body.data).toMatchObject({
        completed: true,
        taskId,
        success: true
      });
    });

    it('should verify agent returned to idle state', async () => {
      const response = await request(app)
        .get(`/api/v1/agents/${agentId}`)
        .expect(200);

      expect(response.body.data.status).toBe('idle');
      expect(response.body.data.currentTask).toBeUndefined();
    });

    it('should verify task completion updated metrics', async () => {
      const response = await request(app)
        .get(`/api/v1/agents/${agentId}/metrics`)
        .expect(200);

      expect(response.body.data.tasksCompleted).toBeGreaterThan(0);
    });
  });

  describe('Agent Filtering and Search', () => {
    it('should filter agents by type', async () => {
      const response = await request(app)
        .get('/api/v1/agents?type=tester')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      response.body.data.forEach((agent: any) => {
        expect(agent.type).toBe('tester');
      });
    });

    it('should filter agents by status', async () => {
      const response = await request(app)
        .get('/api/v1/agents?status=idle')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      response.body.data.forEach((agent: any) => {
        expect(agent.status).toBe('idle');
      });
    });

    it('should get available agents', async () => {
      const response = await request(app)
        .get('/api/v1/agents/available')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      response.body.data.forEach((agent: any) => {
        expect(agent.status).toBe('idle');
      });
    });

    it('should filter available agents by capability', async () => {
      const response = await request(app)
        .get('/api/v1/agents/available?capability=integration_testing')
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
      response.body.data.forEach((agent: any) => {
        expect(agent.capabilities).toContain('integration_testing');
      });
    });
  });

  describe('System Metrics and Monitoring', () => {
    it('should get system-wide agent metrics', async () => {
      const response = await request(app)
        .get('/api/v1/agents/system/metrics')
        .expect(200);

      expect(response.body.data).toMatchObject({
        totalAgents: expect.any(Number),
        activeAgents: expect.any(Number),
        idleAgents: expect.any(Number),
        busyAgents: expect.any(Number),
        offlineAgents: expect.any(Number),
        averageSuccessRate: expect.any(Number),
        totalTasksCompleted: expect.any(Number)
      });

      expect(response.body.data.totalAgents).toBeGreaterThan(0);
    });
  });

  describe('Multi-Agent Coordination', () => {
    let secondAgentId: string;
    let thirdAgentId: string;

    it('should create multiple agents for coordination testing', async () => {
      // Create second agent
      const agent2Data = {
        type: 'coder',
        name: 'Coordination Test Coder',
        capabilities: ['code_generation', 'debugging'],
        resources: { cpu: 2, memory: 4096, maxConcurrentTasks: 2 }
      };

      const response2 = await request(app)
        .post('/api/v1/agents')
        .send(agent2Data)
        .expect(201);

      secondAgentId = response2.body.data.id;

      // Create third agent
      const agent3Data = {
        type: 'analyst',
        name: 'Coordination Test Analyst',
        capabilities: ['data_analysis', 'reporting'],
        resources: { cpu: 1, memory: 2048, maxConcurrentTasks: 4 }
      };

      const response3 = await request(app)
        .post('/api/v1/agents')
        .send(agent3Data)
        .expect(201);

      thirdAgentId = response3.body.data.id;
    });

    it('should assign tasks to multiple agents simultaneously', async () => {
      const assignments = [
        { agentId: secondAgentId, taskId: 'task_coding_123' },
        { agentId: thirdAgentId, taskId: 'task_analysis_456' }
      ];

      for (const assignment of assignments) {
        const response = await request(app)
          .post('/api/v1/agents/assign')
          .send(assignment)
          .expect(200);

        expect(response.body.data.assigned).toBe(true);
      }
    });

    it('should verify all agents are busy with different tasks', async () => {
      const agentsResponse = await request(app)
        .get('/api/v1/agents?status=busy')
        .expect(200);

      expect(agentsResponse.body.data.length).toBeGreaterThanOrEqual(2);
      
      const busyAgents = agentsResponse.body.data;
      const taskIds = busyAgents.map((agent: any) => agent.currentTask);
      
      // Verify unique tasks
      expect(new Set(taskIds).size).toBe(taskIds.length);
    });

    it('should complete all tasks and verify system state', async () => {
      // Complete all tasks
      const completions = [
        { agentId: secondAgentId, taskId: 'task_coding_123', success: true },
        { agentId: thirdAgentId, taskId: 'task_analysis_456', success: true }
      ];

      for (const completion of completions) {
        await request(app)
          .post(`/api/v1/agents/${completion.agentId}/complete`)
          .send({ taskId: completion.taskId, success: completion.success })
          .expect(200);
      }

      // Verify system metrics updated
      const metricsResponse = await request(app)
        .get('/api/v1/agents/system/metrics')
        .expect(200);

      expect(metricsResponse.body.data.totalTasksCompleted).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability Tests', () => {
    it('should respond to agent list queries in <100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/agents')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle pagination efficiently', async () => {
      const response = await request(app)
        .get('/api/v1/agents?page=1&limit=5')
        .expect(200);

      expect(response.body.meta.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number)
      });

      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle assignment to nonexistent agent', async () => {
      const assignment = {
        agentId: 'agent_nonexistent_123',
        taskId: 'task_test_789'
      };

      const response = await request(app)
        .post('/api/v1/agents/assign')
        .send(assignment)
        .expect(400);

      expect(response.body.error.message).toContain('Cannot assign task');
    });

    it('should handle assignment to busy agent', async () => {
      // First assign a task
      await request(app)
        .post('/api/v1/agents/assign')
        .send({ agentId, taskId: 'task_first_123' })
        .expect(200);

      // Try to assign another task to same agent
      const response = await request(app)
        .post('/api/v1/agents/assign')
        .send({ agentId, taskId: 'task_second_456' })
        .expect(400);

      expect(response.body.error.message).toContain('not available');

      // Clean up - complete the first task
      await request(app)
        .post(`/api/v1/agents/${agentId}/complete`)
        .send({ taskId: 'task_first_123', success: true })
        .expect(200);
    });

    it('should handle invalid agent type in creation', async () => {
      const invalidAgentData = {
        type: 'invalid_type',
        name: 'Invalid Agent',
        capabilities: ['test'],
        resources: { cpu: 1, memory: 1024, maxConcurrentTasks: 1 }
      };

      const response = await request(app)
        .post('/api/v1/agents')
        .send(invalidAgentData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle deletion of busy agent', async () => {
      // Assign task to agent
      await request(app)
        .post('/api/v1/agents/assign')
        .send({ agentId, taskId: 'task_delete_test' })
        .expect(200);

      // Try to delete busy agent
      const response = await request(app)
        .delete(`/api/v1/agents/${agentId}`)
        .expect(404);

      expect(response.body.error.message).toContain('not found or currently busy');

      // Clean up
      await request(app)
        .post(`/api/v1/agents/${agentId}/complete`)
        .send({ taskId: 'task_delete_test', success: true })
        .expect(200);
    });
  });

  describe('Authentication and Authorization Flow', () => {
    it('should handle agent operations with proper request tracking', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body.meta.requestId).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.meta.version).toBe('1.0.0');
    });
  });

  afterAll(async () => {
    // Clean up created agents
    if (agentId) {
      await request(app).delete(`/api/v1/agents/${agentId}`).send();
    }
  });
});