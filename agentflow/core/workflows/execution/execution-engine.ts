/**
 * AgentFlow Execution Engine
 * Orchestrates workflow task execution with parallel support
 */

import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStatus,
  TaskInstance,
  TaskStatus,
  WorkflowNode,
  NodeType,
  WorkflowContext,
  ExecutionOptions,
  TaskError,
  WorkflowError,
  Condition,
  WorkflowEventType
} from '../types';
import { EventBus } from '../events/event-bus';
import { WorkflowRegistry } from '../registry/workflow-registry';

export interface TaskExecutor {
  execute(node: WorkflowNode, context: WorkflowContext): Promise<any>;
  canExecute(nodeType: NodeType): boolean;
}

export interface ExecutionEngineOptions {
  maxParallelTasks?: number;
  defaultTimeout?: number;
  enableCheckpoints?: boolean;
  taskExecutors?: Map<NodeType, TaskExecutor>;
}

export class ExecutionEngine {
  private eventBus: EventBus;
  private registry: WorkflowRegistry;
  private options: ExecutionEngineOptions;
  private activeInstances: Map<string, WorkflowInstance> = new Map();
  private taskExecutors: Map<NodeType, TaskExecutor>;
  private executionQueue: Map<string, Set<string>> = new Map();

  constructor(
    eventBus: EventBus,
    registry: WorkflowRegistry,
    options: ExecutionEngineOptions = {}
  ) {
    this.eventBus = eventBus;
    this.registry = registry;
    this.options = {
      maxParallelTasks: options.maxParallelTasks || 10,
      defaultTimeout: options.defaultTimeout || 300000, // 5 minutes
      enableCheckpoints: options.enableCheckpoints ?? true,
      ...options
    };
    this.taskExecutors = options.taskExecutors || new Map();
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    context: WorkflowContext = { variables: {} },
    options: ExecutionOptions = {}
  ): Promise<WorkflowInstance> {
    // Get workflow definition
    const workflow = this.registry.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create instance
    const instance: WorkflowInstance = {
      id: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId,
      status: WorkflowStatus.PENDING,
      startTime: new Date(),
      context: this.mergeContext(context, workflow),
      tasks: []
    };

    // Store active instance
    this.activeInstances.set(instance.id, instance);

    try {
      // Emit start event
      await this.eventBus.publish({
        id: `evt_${Date.now()}`,
        type: WorkflowEventType.WORKFLOW_STARTED,
        timestamp: new Date(),
        workflowId,
        instanceId: instance.id,
        data: { instance }
      });

      // Execute workflow
      instance.status = WorkflowStatus.RUNNING;
      await this.executeWorkflow(workflow, instance, options);

      // Mark as completed
      instance.status = WorkflowStatus.COMPLETED;
      instance.endTime = new Date();

      // Emit completion event
      await this.eventBus.publish({
        id: `evt_${Date.now()}`,
        type: WorkflowEventType.WORKFLOW_COMPLETED,
        timestamp: new Date(),
        workflowId,
        instanceId: instance.id,
        data: { instance }
      });

      return instance;
    } catch (error) {
      // Mark as failed
      instance.status = WorkflowStatus.FAILED;
      instance.endTime = new Date();
      instance.error = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };

      // Emit failure event
      await this.eventBus.publish({
        id: `evt_${Date.now()}`,
        type: WorkflowEventType.WORKFLOW_FAILED,
        timestamp: new Date(),
        workflowId,
        instanceId: instance.id,
        data: { instance, error }
      });

      throw error;
    } finally {
      // Clean up
      this.activeInstances.delete(instance.id);
      this.executionQueue.delete(instance.id);
    }
  }

  /**
   * Execute workflow nodes
   */
  private async executeWorkflow(
    workflow: WorkflowDefinition,
    instance: WorkflowInstance,
    options: ExecutionOptions
  ): Promise<void> {
    // Build execution graph
    const graph = this.buildExecutionGraph(workflow);
    
    // Find start nodes
    const startNodes = workflow.nodes.filter(n => n.type === NodeType.START);
    if (startNodes.length === 0) {
      throw new Error('No start node found');
    }

    // Initialize execution queue
    this.executionQueue.set(instance.id, new Set(startNodes.map(n => n.id)));

    // Execute nodes
    while (this.executionQueue.get(instance.id)?.size ?? 0 > 0) {
      const queue = this.executionQueue.get(instance.id)!;
      const readyNodes = await this.getReadyNodes(
        Array.from(queue),
        workflow,
        instance,
        graph
      );

      if (readyNodes.length === 0 && queue.size > 0) {
        throw new Error('Deadlock detected: no nodes ready for execution');
      }

      // Execute ready nodes in parallel
      const parallelLimit = options.maxParallelTasks || this.options.maxParallelTasks!;
      const chunks = this.chunkArray(readyNodes, parallelLimit);

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(nodeId => this.executeNode(nodeId, workflow, instance, graph, options))
        );
      }
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    nodeId: string,
    workflow: WorkflowDefinition,
    instance: WorkflowInstance,
    graph: Map<string, string[]>,
    options: ExecutionOptions
  ): Promise<void> {
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Create task instance
    const task: TaskInstance = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodeId,
      status: TaskStatus.PENDING,
      retries: 0
    };

    instance.tasks.push(task);

    try {
      // Emit task start event
      task.status = TaskStatus.RUNNING;
      task.startTime = new Date();
      
      await this.eventBus.publish({
        id: `evt_${Date.now()}`,
        type: WorkflowEventType.TASK_STARTED,
        timestamp: new Date(),
        workflowId: workflow.id,
        instanceId: instance.id,
        taskId: task.id,
        data: { task, node }
      });

      // Execute based on node type
      const output = await this.executeNodeByType(node, instance, task, options);
      
      // Store output
      task.output = output;
      task.status = TaskStatus.COMPLETED;
      task.endTime = new Date();

      // Remove from queue
      this.executionQueue.get(instance.id)?.delete(nodeId);

      // Add next nodes to queue
      const nextNodes = await this.getNextNodes(node, workflow, instance, graph);
      for (const nextNode of nextNodes) {
        this.executionQueue.get(instance.id)?.add(nextNode);
      }

      // Emit task completion event
      await this.eventBus.publish({
        id: `evt_${Date.now()}`,
        type: WorkflowEventType.TASK_COMPLETED,
        timestamp: new Date(),
        workflowId: workflow.id,
        instanceId: instance.id,
        taskId: task.id,
        data: { task, node, output }
      });
    } catch (error) {
      // Handle task failure
      task.status = TaskStatus.FAILED;
      task.endTime = new Date();
      task.error = {
        code: 'TASK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        taskId: task.id,
        nodeId: node.id
      };

      // Check retry policy
      if (node.retryPolicy && task.retries! < node.retryPolicy.maxAttempts) {
        task.retries!++;
        task.status = TaskStatus.PENDING;
        
        // Emit retry event
        await this.eventBus.publish({
          id: `evt_${Date.now()}`,
          type: WorkflowEventType.TASK_RETRYING,
          timestamp: new Date(),
          workflowId: workflow.id,
          instanceId: instance.id,
          taskId: task.id,
          data: { task, node, attempt: task.retries }
        });

        // Calculate delay
        const delay = this.calculateRetryDelay(node.retryPolicy, task.retries!);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry execution
        return this.executeNode(nodeId, workflow, instance, graph, options);
      }

      // Emit task failure event
      await this.eventBus.publish({
        id: `evt_${Date.now()}`,
        type: WorkflowEventType.TASK_FAILED,
        timestamp: new Date(),
        workflowId: workflow.id,
        instanceId: instance.id,
        taskId: task.id,
        data: { task, node, error }
      });

      throw error;
    }
  }

  /**
   * Execute node based on type
   */
  private async executeNodeByType(
    node: WorkflowNode,
    instance: WorkflowInstance,
    task: TaskInstance,
    options: ExecutionOptions
  ): Promise<any> {
    // Get executor for node type
    const executor = this.taskExecutors.get(node.type);
    if (executor && executor.canExecute(node.type)) {
      return executor.execute(node, instance.context);
    }

    // Default execution logic
    switch (node.type) {
      case NodeType.START:
        return { started: true };

      case NodeType.END:
        return { completed: true };

      case NodeType.TASK:
        return this.executeTaskNode(node, instance, task);

      case NodeType.CONDITIONAL:
        return this.executeConditionalNode(node, instance);

      case NodeType.PARALLEL:
        return this.executeParallelNode(node, instance, options);

      case NodeType.LOOP:
        return this.executeLoopNode(node, instance, options);

      case NodeType.SUBWORKFLOW:
        return this.executeSubworkflowNode(node, instance, options);

      case NodeType.AGENT:
        return this.executeAgentNode(node, instance, task);

      case NodeType.HUMAN:
        return this.executeHumanNode(node, instance, task);

      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  /**
   * Execute task node
   */
  private async executeTaskNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    task: TaskInstance
  ): Promise<any> {
    // Simple task execution simulation
    const timeout = node.timeout || this.options.defaultTimeout!;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Task timeout'));
      }, timeout);

      // Simulate task execution
      setTimeout(() => {
        clearTimeout(timer);
        resolve({
          taskId: task.id,
          result: 'Task completed',
          timestamp: new Date()
        });
      }, Math.random() * 1000);
    });
  }

  /**
   * Execute conditional node
   */
  private async executeConditionalNode(
    node: WorkflowNode,
    instance: WorkflowInstance
  ): Promise<any> {
    const condition = node.config?.condition as Condition;
    if (!condition) {
      throw new Error('Conditional node missing condition');
    }

    const result = await this.evaluateCondition(condition, instance.context);
    return { condition: result };
  }

  /**
   * Execute parallel node
   */
  private async executeParallelNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    options: ExecutionOptions
  ): Promise<any> {
    const branches = node.config?.branches || [];
    const results = await Promise.all(
      branches.map(branchId => {
        // Execute branch nodes in parallel
        return { branchId, result: 'Branch executed' };
      })
    );
    return { branches: results };
  }

  /**
   * Execute loop node
   */
  private async executeLoopNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    options: ExecutionOptions
  ): Promise<any> {
    const maxIterations = node.config?.maxIterations || 100;
    const results = [];

    for (let i = 0; i < maxIterations; i++) {
      // Check loop condition
      if (node.config?.condition) {
        const shouldContinue = await this.evaluateCondition(
          node.config.condition,
          instance.context
        );
        if (!shouldContinue) break;
      }

      // Execute loop body
      results.push({ iteration: i, result: 'Loop iteration' });

      // Check count-based loop
      if (node.config?.count && i >= node.config.count - 1) {
        break;
      }
    }

    return { iterations: results.length, results };
  }

  /**
   * Execute subworkflow node
   */
  private async executeSubworkflowNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    options: ExecutionOptions
  ): Promise<any> {
    const subworkflowId = node.config?.workflowId;
    if (!subworkflowId) {
      throw new Error('Subworkflow node missing workflow ID');
    }

    // Execute subworkflow
    const subInstance = await this.execute(
      subworkflowId,
      instance.context,
      options
    );

    return {
      subworkflowId,
      instanceId: subInstance.id,
      status: subInstance.status,
      output: subInstance.tasks[subInstance.tasks.length - 1]?.output
    };
  }

  /**
   * Execute agent node
   */
  private async executeAgentNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    task: TaskInstance
  ): Promise<any> {
    if (!node.agent) {
      throw new Error('Agent node missing agent configuration');
    }

    // Assign agent
    task.assignedAgent = `agent_${node.agent.type}_${Date.now()}`;

    // Emit agent assignment event
    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.AGENT_ASSIGNED,
      timestamp: new Date(),
      workflowId: instance.workflowId,
      instanceId: instance.id,
      taskId: task.id,
      data: { agent: node.agent, assignedAgent: task.assignedAgent }
    });

    // Simulate agent execution
    const result = await new Promise(resolve => {
      setTimeout(() => {
        resolve({
          agent: task.assignedAgent,
          type: node.agent!.type,
          result: `${node.agent!.type} agent completed task`,
          timestamp: new Date()
        });
      }, Math.random() * 2000);
    });

    // Emit agent completion event
    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.AGENT_COMPLETED,
      timestamp: new Date(),
      workflowId: instance.workflowId,
      instanceId: instance.id,
      taskId: task.id,
      data: { agent: node.agent, result }
    });

    return result;
  }

  /**
   * Execute human node
   */
  private async executeHumanNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    task: TaskInstance
  ): Promise<any> {
    // In real implementation, this would wait for human input
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          type: 'human',
          approved: true,
          approver: instance.context.user?.id || 'anonymous',
          timestamp: new Date()
        });
      }, 1000);
    });
  }

  /**
   * Evaluate condition
   */
  private async evaluateCondition(
    condition: Condition,
    context: WorkflowContext
  ): Promise<boolean> {
    switch (condition.type) {
      case 'expression':
        // Simple expression evaluation
        try {
          // In production, use a safe expression evaluator
          return !!condition.value;
        } catch {
          return false;
        }

      case 'script':
        // Script evaluation would be handled by sandboxed environment
        return true;

      case 'function':
        // Function evaluation
        return true;

      default:
        return false;
    }
  }

  /**
   * Get nodes ready for execution
   */
  private async getReadyNodes(
    queuedNodes: string[],
    workflow: WorkflowDefinition,
    instance: WorkflowInstance,
    graph: Map<string, string[]>
  ): Promise<string[]> {
    const ready: string[] = [];

    for (const nodeId of queuedNodes) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Check dependencies
      if (node.dependencies && node.dependencies.length > 0) {
        const allDepsCompleted = node.dependencies.every(depId => {
          const depTask = instance.tasks.find(t => t.nodeId === depId);
          return depTask && depTask.status === TaskStatus.COMPLETED;
        });

        if (!allDepsCompleted) continue;
      }

      // Check incoming edges
      const incomingCompleted = await this.checkIncomingEdges(
        node,
        workflow,
        instance
      );

      if (incomingCompleted) {
        ready.push(nodeId);
      }
    }

    return ready;
  }

  /**
   * Check if all incoming edges are satisfied
   */
  private async checkIncomingEdges(
    node: WorkflowNode,
    workflow: WorkflowDefinition,
    instance: WorkflowInstance
  ): Promise<boolean> {
    const incomingEdges = workflow.edges.filter(e => e.target === node.id);

    for (const edge of incomingEdges) {
      const sourceTask = instance.tasks.find(t => t.nodeId === edge.source);
      
      // Source must be completed
      if (!sourceTask || sourceTask.status !== TaskStatus.COMPLETED) {
        return false;
      }

      // Check edge condition
      if (edge.condition) {
        const conditionMet = await this.evaluateCondition(
          edge.condition,
          instance.context
        );
        if (!conditionMet) return false;
      }
    }

    return true;
  }

  /**
   * Get next nodes to execute
   */
  private async getNextNodes(
    node: WorkflowNode,
    workflow: WorkflowDefinition,
    instance: WorkflowInstance,
    graph: Map<string, string[]>
  ): Promise<string[]> {
    const nextNodes: string[] = [];
    const outgoingEdges = workflow.edges.filter(e => e.source === node.id);

    for (const edge of outgoingEdges) {
      // Check edge condition
      if (edge.condition) {
        const conditionMet = await this.evaluateCondition(
          edge.condition,
          instance.context
        );
        if (!conditionMet) continue;
      }

      nextNodes.push(edge.target);
    }

    return nextNodes;
  }

  /**
   * Build execution graph
   */
  private buildExecutionGraph(workflow: WorkflowDefinition): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    // Initialize nodes
    for (const node of workflow.nodes) {
      graph.set(node.id, []);
    }

    // Add edges
    for (const edge of workflow.edges) {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
    }

    return graph;
  }

  /**
   * Merge context with workflow defaults
   */
  private mergeContext(
    context: WorkflowContext,
    workflow: WorkflowDefinition
  ): WorkflowContext {
    return {
      variables: {
        ...workflow.variables,
        ...context.variables
      },
      secrets: context.secrets,
      user: context.user,
      environment: context.environment
    };
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(policy: any, attempt: number): number {
    const base = policy.initialDelay || 1000;

    switch (policy.backoffStrategy) {
      case 'exponential':
        return Math.min(
          base * Math.pow(2, attempt - 1),
          policy.maxDelay || 60000
        );
      case 'linear':
        return Math.min(
          base * attempt,
          policy.maxDelay || 60000
        );
      case 'fixed':
      default:
        return base;
    }
  }

  /**
   * Chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get active instances
   */
  getActiveInstances(): WorkflowInstance[] {
    return Array.from(this.activeInstances.values());
  }

  /**
   * Cancel workflow instance
   */
  async cancel(instanceId: string): Promise<void> {
    const instance = this.activeInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    instance.status = WorkflowStatus.CANCELLED;
    instance.endTime = new Date();

    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.WORKFLOW_CANCELLED,
      timestamp: new Date(),
      workflowId: instance.workflowId,
      instanceId: instance.id,
      data: { instance }
    });
  }

  /**
   * Pause workflow instance
   */
  async pause(instanceId: string): Promise<void> {
    const instance = this.activeInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    instance.status = WorkflowStatus.PAUSED;

    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.WORKFLOW_PAUSED,
      timestamp: new Date(),
      workflowId: instance.workflowId,
      instanceId: instance.id,
      data: { instance }
    });
  }

  /**
   * Resume workflow instance
   */
  async resume(instanceId: string): Promise<void> {
    const instance = this.activeInstances.get(instanceId);
    if (!instance || instance.status !== WorkflowStatus.PAUSED) {
      throw new Error(`Instance not paused: ${instanceId}`);
    }

    instance.status = WorkflowStatus.RUNNING;

    await this.eventBus.publish({
      id: `evt_${Date.now()}`,
      type: WorkflowEventType.WORKFLOW_RESUMED,
      timestamp: new Date(),
      workflowId: instance.workflowId,
      instanceId: instance.id,
      data: { instance }
    });
  }

  /**
   * Register task executor
   */
  registerExecutor(nodeType: NodeType, executor: TaskExecutor): void {
    this.taskExecutors.set(nodeType, executor);
  }
}