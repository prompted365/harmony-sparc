/**
 * AgentFlow Swarm Coordinator
 * Main coordination engine for workflow execution
 */

import { EventEmitter } from 'events';
import {
  Agent,
  AgentConfig,
  SwarmOptions,
  SwarmState,
  SwarmTopology,
  Task,
  TaskAssignment,
  SwarmMetrics,
  SwarmEventEmitter,
  SwarmEvent,
  Connection,
  Conflict,
  Resolution,
  WorkflowState,
} from '../types';
import { AgentFlowPool, createAgentFlowAgent } from './agent';
import { AgentFlowMemory } from '../memory/persistence';
import { WorkflowOptimizer } from '../neural/base-model';
import { generateId } from '../utils';

export class SwarmCoordinator extends EventEmitter implements SwarmEventEmitter {
  private options: SwarmOptions;
  private state: SwarmState;
  private agentPool: AgentFlowPool;
  private memory: AgentFlowMemory;
  private optimizer?: WorkflowOptimizer;
  private isRunning: boolean = false;

  constructor(options: SwarmOptions = {}) {
    super();
    
    this.options = {
      topology: 'hierarchical',
      maxAgents: 10,
      connectionDensity: 0.5,
      syncInterval: 1000,
      ...options,
    };

    this.agentPool = new AgentFlowPool();
    this.memory = new AgentFlowMemory();
    
    this.state = {
      agents: new Map(),
      tasks: new Map(),
      topology: this.options.topology!,
      connections: [],
      metrics: this.createInitialMetrics(),
      workflows: new Map(),
    };

    this.initializeOptimizer();
  }

  private initializeOptimizer(): void {
    // Initialize neural optimizer for task assignment
    this.optimizer = new WorkflowOptimizer({
      inputDim: 10, // Features: task complexity, agent load, etc.
      outputDim: 5, // Agent types
      hiddenDims: [32, 16],
      activation: 'relu',
      dropout: 0.2,
    });
  }

  private createInitialMetrics(): SwarmMetrics {
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageCompletionTime: 0,
      agentUtilization: new Map(),
      throughput: 0,
      workflowMetrics: {
        totalWorkflows: 0,
        activeWorkflows: 0,
        completedWorkflows: 0,
        averageWorkflowTime: 0,
        successRate: 0,
      },
    };
  }

  // Agent management
  async addAgent(config: AgentConfig): Promise<Agent> {
    if (this.state.agents.size >= this.options.maxAgents!) {
      throw new Error(`Maximum agent limit (${this.options.maxAgents}) reached`);
    }

    const agent = createAgentFlowAgent(config);
    this.state.agents.set(agent.id, agent);
    this.agentPool.addAgent(agent);

    // Initialize agent connections based on topology
    this.updateAgentConnections(agent);

    // Store agent state in memory
    await this.memory.updateAgentState(agent.id, agent.state);

    // Log coordination event
    await this.memory.logCoordinationEvent('agent_added', agent.id, undefined, {
      agentType: config.type,
      capabilities: config.capabilities,
    });

    this.emit('agent:added', agent);
    return agent;
  }

  async removeAgent(agentId: string): Promise<void> {
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Reassign any active tasks
    if (agent.state.currentTask) {
      const task = this.state.tasks.get(agent.state.currentTask);
      if (task) {
        task.assignedAgents = task.assignedAgents?.filter(id => id !== agentId);
        task.status = 'pending';
      }
    }

    this.state.agents.delete(agentId);
    this.agentPool.removeAgent(agentId);

    // Update connections
    this.state.connections = this.state.connections.filter(
      conn => conn.from !== agentId && conn.to !== agentId
    );

    await this.memory.logCoordinationEvent('agent_removed', agentId);
    this.emit('agent:removed', { agentId });
  }

  // Task management
  async assignTask(task: Task): Promise<TaskAssignment[]> {
    task.id = task.id || generateId('task');
    task.status = 'pending';
    
    this.state.tasks.set(task.id, task);
    this.state.metrics.totalTasks++;

    // Use optimizer to find best agent assignments
    const assignments = await this.optimizeTaskAssignment(task);
    
    // Execute assignments
    for (const assignment of assignments) {
      const agent = this.state.agents.get(assignment.agentId);
      if (agent) {
        task.assignedAgents = task.assignedAgents || [];
        task.assignedAgents.push(assignment.agentId);
        task.status = 'assigned';
        
        // Execute task
        this.executeAgentTask(agent, task, assignment);
      }
    }

    await this.memory.logCoordinationEvent('task_assigned', undefined, undefined, {
      taskId: task.id,
      assignments: assignments.map(a => a.agentId),
    });

    this.emit('task:assigned', { task, assignments });
    return assignments;
  }

  private async optimizeTaskAssignment(task: Task): Promise<TaskAssignment[]> {
    const assignments: TaskAssignment[] = [];
    
    // Simple assignment strategy for now
    // In production, this would use the neural optimizer
    const availableAgent = this.agentPool.getAvailableAgent();
    
    if (availableAgent) {
      assignments.push({
        agentId: availableAgent.id,
        taskId: task.id,
        deadline: Date.now() + 300000, // 5 minutes default
      });
    }

    return assignments;
  }

  private async executeAgentTask(agent: Agent, task: Task, assignment: TaskAssignment): Promise<void> {
    try {
      this.emit('task:started', { agentId: agent.id, taskId: task.id });
      
      const startTime = Date.now();
      const result = await agent.execute(task);
      const executionTime = Date.now() - startTime;

      task.status = 'completed';
      task.result = result;
      
      // Update metrics
      this.state.metrics.completedTasks++;
      this.updateAverageCompletionTime(executionTime);
      
      // Store result in memory
      await this.memory.store(
        `task_result_${task.id}`,
        { result, executionTime, agentId: agent.id },
        'task_results'
      );

      await this.memory.logCoordinationEvent('task_completed', agent.id, undefined, {
        taskId: task.id,
        executionTime,
      });

      this.emit('task:completed', { task, result, agentId: agent.id });
    } catch (error) {
      task.status = 'failed';
      task.error = error as Error;
      
      this.state.metrics.failedTasks++;
      
      await this.memory.logCoordinationEvent('task_failed', agent.id, undefined, {
        taskId: task.id,
        error: error.message,
      });

      this.emit('task:failed', { task, error, agentId: agent.id });
    } finally {
      // Release agent
      this.agentPool.releaseAgent(agent.id);
    }
  }

  // Workflow management
  async startWorkflow(workflowId: string, steps: number): Promise<void> {
    const workflowState: WorkflowState = {
      id: workflowId,
      status: 'active',
      currentStep: 0,
      totalSteps: steps,
      assignedAgents: [],
      startTime: Date.now(),
    };

    this.state.workflows?.set(workflowId, workflowState);
    
    if (this.state.metrics.workflowMetrics) {
      this.state.metrics.workflowMetrics.totalWorkflows++;
      this.state.metrics.workflowMetrics.activeWorkflows++;
    }

    await this.memory.storeWorkflowMemory(workflowId, {
      workflowId,
      stepResults: new Map(),
      decisions: [],
      performance: {
        startTime: Date.now(),
        resourcesUsed: {},
        errors: [],
      },
    });

    this.emit('workflow:started', { workflowId, steps });
  }

  async updateWorkflowProgress(workflowId: string, stepNumber: number, result: any): Promise<void> {
    const workflow = this.state.workflows?.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.currentStep = stepNumber;
    
    // Update workflow memory
    const workflowMemory = await this.memory.getWorkflowMemory(workflowId);
    if (workflowMemory) {
      workflowMemory.stepResults.set(stepNumber, result);
      await this.memory.storeWorkflowMemory(workflowId, workflowMemory);
    }

    // Check if workflow is complete
    if (stepNumber >= workflow.totalSteps - 1) {
      await this.completeWorkflow(workflowId);
    }
  }

  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.state.workflows?.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.endTime = Date.now();
    
    const duration = workflow.endTime - workflow.startTime;
    
    if (this.state.metrics.workflowMetrics) {
      this.state.metrics.workflowMetrics.activeWorkflows--;
      this.state.metrics.workflowMetrics.completedWorkflows++;
      
      // Update average workflow time
      const total = this.state.metrics.workflowMetrics.completedWorkflows;
      const currentAvg = this.state.metrics.workflowMetrics.averageWorkflowTime;
      this.state.metrics.workflowMetrics.averageWorkflowTime = 
        (currentAvg * (total - 1) + duration) / total;
      
      // Update success rate
      this.state.metrics.workflowMetrics.successRate = 
        this.state.metrics.workflowMetrics.completedWorkflows / 
        this.state.metrics.workflowMetrics.totalWorkflows;
    }

    this.emit('workflow:completed', { workflowId, duration });
  }

  // Topology management
  private updateAgentConnections(agent: Agent): void {
    const topology = this.options.topology!;
    const agents = Array.from(this.state.agents.values());
    
    switch (topology) {
      case 'mesh':
        // Connect to all other agents
        agents.forEach(other => {
          if (other.id !== agent.id) {
            this.addConnection(agent.id, other.id, 'coordination');
          }
        });
        break;
        
      case 'hierarchical':
        // Connect to coordinator or subordinates
        if (agent.config.type === 'coordinator') {
          agents.forEach(other => {
            if (other.id !== agent.id && other.config.type !== 'coordinator') {
              this.addConnection(agent.id, other.id, 'control');
            }
          });
        } else {
          // Find coordinator and connect
          const coordinator = agents.find(a => a.config.type === 'coordinator');
          if (coordinator) {
            this.addConnection(agent.id, coordinator.id, 'feedback');
          }
        }
        break;
        
      case 'distributed':
        // Connect to random subset of agents
        const connectionCount = Math.floor(agents.length * this.options.connectionDensity!);
        const shuffled = agents.sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < connectionCount && i < shuffled.length; i++) {
          if (shuffled[i].id !== agent.id) {
            this.addConnection(agent.id, shuffled[i].id, 'data');
          }
        }
        break;
    }
  }

  private addConnection(from: string, to: string, type: ConnectionType): void {
    const connection: Connection = {
      from,
      to,
      weight: 1.0,
      type,
    };
    
    this.state.connections.push(connection);
    
    // Update agent connections
    const fromAgent = this.state.agents.get(from);
    const toAgent = this.state.agents.get(to);
    
    if (fromAgent && !fromAgent.connections.includes(to)) {
      fromAgent.connections.push(to);
    }
    
    if (toAgent && !toAgent.connections.includes(from)) {
      toAgent.connections.push(from);
    }
  }

  // Conflict resolution
  async resolveConflicts(conflicts: Conflict[]): Promise<Resolution[]> {
    const resolutions: Resolution[] = [];
    
    for (const conflict of conflicts) {
      let solution: string;
      
      switch (conflict.type) {
        case 'resource':
          // Simple priority-based resolution
          solution = 'Assign resource to highest priority task';
          break;
          
        case 'scheduling':
          // Time-based resolution
          solution = 'Reschedule lower priority tasks';
          break;
          
        case 'dependency':
          // Topological sort resolution
          solution = 'Reorder tasks based on dependencies';
          break;
          
        default:
          solution = 'Manual intervention required';
      }
      
      resolutions.push({
        conflictId: generateId('resolution'),
        solution,
        affectedAgents: conflict.agents,
      });
    }
    
    return resolutions;
  }

  // Metrics
  private updateAverageCompletionTime(newTime: number): void {
    const completed = this.state.metrics.completedTasks;
    const currentAvg = this.state.metrics.averageCompletionTime;
    
    this.state.metrics.averageCompletionTime = 
      (currentAvg * (completed - 1) + newTime) / completed;
  }

  getMetrics(): SwarmMetrics {
    // Update agent utilization
    this.state.agents.forEach((agent, id) => {
      const utilization = agent.state.status === 'busy' ? 1.0 : 0.0;
      this.state.metrics.agentUtilization.set(id, utilization);
    });
    
    // Calculate throughput (tasks per minute)
    const runtime = this.isRunning ? Date.now() - this.startTime : 0;
    if (runtime > 0) {
      this.state.metrics.throughput = 
        (this.state.metrics.completedTasks / runtime) * 60000;
    }
    
    return { ...this.state.metrics };
  }

  getState(): SwarmState {
    return this.state;
  }

  // Lifecycle
  private startTime: number = 0;

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    await this.memory.logCoordinationEvent('swarm_started');
    
    // Start sync interval
    if (this.options.syncInterval) {
      this.syncInterval = setInterval(() => {
        this.syncAgents();
      }, this.options.syncInterval);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    await this.memory.logCoordinationEvent('swarm_stopped');
  }

  private syncInterval?: NodeJS.Timeout;

  private async syncAgents(): Promise<void> {
    // Sync agent states and handle any pending messages
    for (const agent of this.state.agents.values()) {
      await this.memory.updateAgentState(agent.id, agent.state);
    }
  }

  async close(): Promise<void> {
    await this.stop();
    this.memory.close();
  }
}

export { SwarmEventEmitter, SwarmEvent } from '../types';