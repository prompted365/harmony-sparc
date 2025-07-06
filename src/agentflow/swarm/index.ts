/**
 * AgentFlow Swarm Integration
 * Main entry point for swarm coordination in AgentFlow
 */

export * from './types';
export * from './coordination/agent';
export * from './coordination/coordinator';
export * from './memory/persistence';
export * from './neural/base-model';
export * from './hooks';
export * from './utils';

import { SwarmCoordinator } from './coordination/coordinator';
import { AgentFlowMemory } from './memory/persistence';
import { WorkflowHooks } from './hooks';
import { SwarmOptions, AgentConfig, Task, TaskAssignment } from './types';

/**
 * AgentFlow Swarm - High-level API for workflow coordination
 */
export class AgentFlowSwarm {
  private coordinator: SwarmCoordinator;
  private memory: AgentFlowMemory;
  private hooks: WorkflowHooks;

  constructor(options: SwarmOptions = {}) {
    this.memory = new AgentFlowMemory();
    this.coordinator = new SwarmCoordinator(options);
    this.hooks = new WorkflowHooks(this.memory);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Forward coordinator events through hooks
    this.coordinator.on('task:assigned', async ({ task, assignments }) => {
      await this.hooks.executeHook('pre-task', {
        taskId: task.id,
        timestamp: Date.now(),
      }, task);
    });

    this.coordinator.on('task:completed', async ({ task, result, agentId }) => {
      await this.hooks.executeHook('post-task', {
        taskId: task.id,
        agentId,
        timestamp: Date.now(),
      }, result);
    });

    this.coordinator.on('workflow:started', async ({ workflowId }) => {
      await this.hooks.notifyWorkflowUpdate(workflowId, { type: 'started' });
    });

    this.coordinator.on('workflow:completed', async ({ workflowId, duration }) => {
      await this.hooks.notifyWorkflowUpdate(workflowId, { 
        type: 'completed',
        duration,
      });
    });
  }

  /**
   * Initialize the swarm with a set of agents
   */
  async initialize(agentConfigs: AgentConfig[]): Promise<void> {
    await this.coordinator.start();
    
    for (const config of agentConfigs) {
      await this.coordinator.addAgent(config);
    }
  }

  /**
   * Execute a workflow with the swarm
   */
  async executeWorkflow(workflowId: string, steps: Task[]): Promise<any[]> {
    // Validate workflow
    const hookResult = await this.hooks.executeHook('pre-workflow', {
      workflowId,
      timestamp: Date.now(),
    }, { id: workflowId, steps });

    if (!hookResult.continue) {
      throw new Error(`Workflow validation failed: ${hookResult.reason}`);
    }

    // Start workflow tracking
    await this.coordinator.startWorkflow(workflowId, steps.length);
    
    const results: any[] = [];
    
    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      step.id = `${workflowId}_step_${i}`;
      step.metadata = {
        ...step.metadata,
        workflowId,
        workflowStep: i,
      };
      
      // Assign and execute task
      const assignments = await this.coordinator.assignTask(step);
      
      // Wait for completion
      const result = await this.waitForTaskCompletion(step.id);
      results.push(result);
      
      // Update workflow progress
      await this.coordinator.updateWorkflowProgress(workflowId, i, result);
    }
    
    return results;
  }

  /**
   * Execute a single task
   */
  async executeTask(task: Task): Promise<TaskAssignment[]> {
    return await this.coordinator.assignTask(task);
  }

  /**
   * Add a new agent to the swarm
   */
  async addAgent(config: AgentConfig): Promise<string> {
    const agent = await this.coordinator.addAgent(config);
    return agent.id;
  }

  /**
   * Remove an agent from the swarm
   */
  async removeAgent(agentId: string): Promise<void> {
    await this.coordinator.removeAgent(agentId);
  }

  /**
   * Get current swarm metrics
   */
  getMetrics() {
    return this.coordinator.getMetrics();
  }

  /**
   * Get swarm state
   */
  getState() {
    return this.coordinator.getState();
  }

  /**
   * Store data in swarm memory
   */
  async storeMemory(key: string, value: any, category: string = 'general', ttl?: number): Promise<void> {
    await this.memory.store(key, value, category, ttl);
  }

  /**
   * Retrieve data from swarm memory
   */
  async retrieveMemory(key: string, category?: string): Promise<any> {
    return await this.memory.retrieve(key, category);
  }

  /**
   * List memory entries
   */
  async listMemory(category?: string, pattern?: string) {
    return await this.memory.list(category, pattern);
  }

  /**
   * Register a custom hook
   */
  registerHook(type: string, handler: Function): void {
    this.hooks.registerHook(type as any, handler);
  }

  /**
   * Wait for a task to complete
   */
  private async waitForTaskCompletion(taskId: string, timeout: number = 300000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const task = this.coordinator.getState().tasks.get(taskId);
      
      if (task?.status === 'completed') {
        return task.result;
      }
      
      if (task?.status === 'failed') {
        throw new Error(`Task ${taskId} failed: ${task.error?.message}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Task ${taskId} timed out after ${timeout}ms`);
  }

  /**
   * Shutdown the swarm
   */
  async shutdown(): Promise<void> {
    await this.coordinator.stop();
    await this.coordinator.close();
    this.hooks.clearHooks();
  }
}

/**
 * Create a new AgentFlow swarm instance
 */
export function createSwarm(options?: SwarmOptions): AgentFlowSwarm {
  return new AgentFlowSwarm(options);
}

// Export specific agent types for convenience
export { WorkflowAgent, FinancialAgent, MLAgent } from './coordination/agent';
export { WorkflowOptimizer } from './neural/base-model';