/**
 * AgentFlow Swarm Agent Implementation
 * Simplified agent coordination for AgentFlow workflows
 */

import {
  Agent,
  AgentConfig,
  AgentState,
  AgentStatus,
  Task,
  Message,
  MessageType,
} from '../types';
import { generateId } from '../utils';

export class AgentFlowAgent implements Agent {
  id: string;
  config: AgentConfig;
  state: AgentState;
  connections: string[] = [];
  
  private messageHandlers: Map<MessageType, (message: Message) => Promise<void>> = new Map();

  constructor(config: AgentConfig) {
    this.id = config.id || generateId('af-agent');
    this.config = {
      ...config,
      id: this.id,
    };
    
    this.state = {
      status: 'idle',
      load: 0,
      performance: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageExecutionTime: 0,
        successRate: 0,
      },
    };

    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.messageHandlers.set('task_assignment', this.handleTaskAssignment.bind(this));
    this.messageHandlers.set('coordination', this.handleCoordination.bind(this));
    this.messageHandlers.set('workflow_update', this.handleWorkflowUpdate.bind(this));
    this.messageHandlers.set('status_update', this.handleStatusUpdate.bind(this));
  }

  async execute(task: Task): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.update({ status: 'busy', currentTask: task.id });
      
      // Execute task based on agent type
      const result = await this.executeTaskByType(task);
      
      // Update performance metrics
      const executionTime = Date.now() - startTime;
      this.updatePerformanceMetrics(true, executionTime);
      
      this.update({ status: 'idle', currentTask: undefined });
      
      return result;
    } catch (error) {
      this.updatePerformanceMetrics(false, Date.now() - startTime);
      this.update({ status: 'error', currentTask: undefined });
      throw error;
    }
  }

  protected async executeTaskByType(task: Task): Promise<any> {
    // Base implementation for AgentFlow workflows
    console.log(`AgentFlow Agent ${this.id} executing task ${task.id}: ${task.description}`);
    
    return {
      taskId: task.id,
      agentId: this.id,
      result: `Task completed by ${this.config.type} agent in AgentFlow`,
      timestamp: Date.now(),
    };
  }

  async communicate(message: Message): Promise<void> {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    } else {
      console.warn(`No handler for message type: ${message.type}`);
    }
  }

  update(state: Partial<AgentState>): void {
    this.state = { ...this.state, ...state };
  }

  private updatePerformanceMetrics(success: boolean, executionTime: number): void {
    const performance = this.state.performance;
    
    if (success) {
      performance.tasksCompleted++;
    } else {
      performance.tasksFailed++;
    }
    
    const totalTasks = performance.tasksCompleted + performance.tasksFailed;
    performance.successRate = totalTasks > 0 ? performance.tasksCompleted / totalTasks : 0;
    
    // Update average execution time
    const totalTime = performance.averageExecutionTime * (totalTasks - 1) + executionTime;
    performance.averageExecutionTime = totalTime / totalTasks;
  }

  private async handleTaskAssignment(message: Message): Promise<void> {
    const task = message.payload as Task;
    console.log(`Agent ${this.id} received task assignment: ${task.id}`);
  }

  private async handleCoordination(message: Message): Promise<void> {
    console.log(`Agent ${this.id} received coordination message from ${message.from}`);
  }

  private async handleWorkflowUpdate(message: Message): Promise<void> {
    console.log(`Agent ${this.id} received workflow update from ${message.from}`);
    // Handle workflow-specific updates
  }

  private async handleStatusUpdate(message: Message): Promise<void> {
    console.log(`Agent ${this.id} received status update from ${message.from}`);
  }
}

/**
 * Specialized agent for workflow tasks
 */
export class WorkflowAgent extends AgentFlowAgent {
  constructor(config: Omit<AgentConfig, 'type'>) {
    super({ ...config, type: 'workflow' });
  }

  protected async executeTaskByType(task: Task): Promise<any> {
    console.log(`Workflow Agent ${this.id} processing: ${task.description}`);
    
    return {
      taskId: task.id,
      agentId: this.id,
      type: 'workflow_execution',
      workflowId: task.metadata?.workflowId,
      status: 'completed',
      results: task.metadata?.expectedResults || {},
    };
  }
}

/**
 * Specialized agent for financial tasks
 */
export class FinancialAgent extends AgentFlowAgent {
  constructor(config: Omit<AgentConfig, 'type'>) {
    super({ ...config, type: 'financial' });
  }

  protected async executeTaskByType(task: Task): Promise<any> {
    console.log(`Financial Agent ${this.id} processing: ${task.description}`);
    
    return {
      taskId: task.id,
      agentId: this.id,
      type: 'financial_transaction',
      transactionId: generateId('tx'),
      amount: task.metadata?.amount || 0,
      currency: task.metadata?.currency || 'AGC',
      status: 'completed',
    };
  }
}

/**
 * Specialized agent for ML/AI tasks
 */
export class MLAgent extends AgentFlowAgent {
  constructor(config: Omit<AgentConfig, 'type'>) {
    super({ ...config, type: 'ml' });
  }

  protected async executeTaskByType(task: Task): Promise<any> {
    console.log(`ML Agent ${this.id} processing: ${task.description}`);
    
    return {
      taskId: task.id,
      agentId: this.id,
      type: 'ml_prediction',
      model: task.metadata?.model || 'default',
      predictions: task.metadata?.predictions || [],
      confidence: Math.random() * 0.3 + 0.7,
    };
  }
}

/**
 * Factory function to create specialized AgentFlow agents
 */
export function createAgentFlowAgent(config: AgentConfig): Agent {
  switch (config.type) {
  case 'workflow':
    return new WorkflowAgent(config);
  case 'financial':
    return new FinancialAgent(config);
  case 'ml':
    return new MLAgent(config);
  default:
    return new AgentFlowAgent(config);
  }
}

/**
 * Agent pool for managing AgentFlow agents
 */
export class AgentFlowPool {
  private agents: Map<string, Agent> = new Map();
  private availableAgents: Set<string> = new Set();

  addAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    if (agent.state.status === 'idle') {
      this.availableAgents.add(agent.id);
    }
  }

  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.availableAgents.delete(agentId);
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAvailableAgent(preferredType?: string): Agent | undefined {
    let selectedAgent: Agent | undefined;

    for (const agentId of this.availableAgents) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      if (!preferredType || agent.config.type === preferredType) {
        selectedAgent = agent;
        break;
      }
    }

    if (selectedAgent) {
      this.availableAgents.delete(selectedAgent.id);
    }

    return selectedAgent;
  }

  releaseAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent && agent.state.status === 'idle') {
      this.availableAgents.add(agentId);
    }
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByType(type: string): Agent[] {
    return this.getAllAgents().filter(agent => agent.config.type === type);
  }

  getAgentsByStatus(status: AgentStatus): Agent[] {
    return this.getAllAgents().filter(agent => agent.state.status === status);
  }
}