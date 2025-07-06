/**
 * AgentFlow Swarm Hooks Integration
 * Provides hook-based coordination for AgentFlow workflows
 */

import { EventEmitter } from 'events';
import { AgentFlowMemory } from '../memory/persistence';
import { Task, Agent, WorkflowState } from '../types';
import { generateId, formatDuration } from '../utils';

export interface HookContext {
  workflowId?: string;
  agentId?: string;
  taskId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface HookResult {
  continue: boolean;
  reason?: string;
  modifications?: any;
  metadata?: Record<string, any>;
}

export type HookType = 
  | 'pre-task'
  | 'post-task'
  | 'pre-workflow'
  | 'post-workflow'
  | 'pre-decision'
  | 'post-decision'
  | 'error'
  | 'notification';

export class WorkflowHooks extends EventEmitter {
  private memory: AgentFlowMemory;
  private activeHooks: Map<string, Function> = new Map();

  constructor(memory: AgentFlowMemory) {
    super();
    this.memory = memory;
    this.setupDefaultHooks();
  }

  private setupDefaultHooks(): void {
    // Pre-task validation hook
    this.registerHook('pre-task', async (context: HookContext, task: Task) => {
      // Validate task has required fields
      if (!task.description || !task.priority) {
        return {
          continue: false,
          reason: 'Task missing required fields',
        };
      }

      // Check dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        const pendingDeps = await this.checkDependencies(task.dependencies);
        if (pendingDeps.length > 0) {
          return {
            continue: false,
            reason: `Waiting for dependencies: ${pendingDeps.join(', ')}`,
            metadata: { pendingDependencies: pendingDeps },
          };
        }
      }

      // Log task start
      await this.memory.logCoordinationEvent('task_start', context.agentId, context.workflowId, {
        taskId: task.id,
        priority: task.priority,
      });

      return { continue: true };
    });

    // Post-task completion hook
    this.registerHook('post-task', async (context: HookContext, result: any) => {
      // Store task result
      await this.memory.store(
        `task_${context.taskId}_result`,
        result,
        'task_results',
        300 // 5 minute TTL
      );

      // Update workflow progress if part of workflow
      if (context.workflowId) {
        await this.updateWorkflowProgress(context.workflowId, context.taskId!, result);
      }

      // Calculate and store performance metrics
      const metrics = await this.calculateTaskMetrics(context.taskId!);
      await this.memory.store(
        `task_${context.taskId}_metrics`,
        metrics,
        'performance_metrics'
      );

      return { continue: true, metadata: metrics };
    });

    // Pre-workflow validation hook
    this.registerHook('pre-workflow', async (context: HookContext, workflow: any) => {
      // Validate workflow structure
      if (!workflow.steps || workflow.steps.length === 0) {
        return {
          continue: false,
          reason: 'Workflow has no steps defined',
        };
      }

      // Check resource availability
      const resourceCheck = await this.checkResourceAvailability(workflow);
      if (!resourceCheck.available) {
        return {
          continue: false,
          reason: resourceCheck.reason,
          metadata: { missingResources: resourceCheck.missing },
        };
      }

      // Initialize workflow state
      await this.memory.storeWorkflowMemory(workflow.id, {
        workflowId: workflow.id,
        stepResults: new Map(),
        decisions: [],
        performance: {
          startTime: Date.now(),
          resourcesUsed: {},
          errors: [],
        },
      });

      return { continue: true };
    });

    // Error handling hook
    this.registerHook('error', async (context: HookContext, error: Error) => {
      // Log error details
      await this.memory.logCoordinationEvent('error', context.agentId, context.workflowId, {
        taskId: context.taskId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });

      // Determine if error is recoverable
      const isRecoverable = this.isRecoverableError(error);
      
      if (isRecoverable) {
        // Store retry information
        await this.memory.store(
          `retry_${context.taskId}`,
          {
            attempts: 1,
            lastError: error.message,
            nextRetry: Date.now() + 5000,
          },
          'retry_queue'
        );
      }

      return {
        continue: isRecoverable,
        reason: isRecoverable ? 'Error is recoverable, will retry' : 'Fatal error occurred',
        metadata: { recoverable: isRecoverable },
      };
    });
  }

  registerHook(type: HookType, handler: Function): void {
    const hookId = `${type}_${Date.now()}`;
    this.activeHooks.set(hookId, handler);
    this.on(type, handler);
  }

  async executeHook(type: HookType, context: HookContext, ...args: any[]): Promise<HookResult> {
    try {
      const results = await Promise.all(
        this.listeners(type).map(listener => 
          (listener as Function)(context, ...args)
        )
      );

      // Merge results - if any hook says don't continue, we stop
      const shouldContinue = results.every(r => r.continue !== false);
      const mergedMetadata = results.reduce((acc, r) => ({
        ...acc,
        ...(r.metadata || {}),
      }), {});

      return {
        continue: shouldContinue,
        reason: results.find(r => !r.continue)?.reason,
        metadata: mergedMetadata,
      };
    } catch (error) {
      return {
        continue: false,
        reason: `Hook execution failed: ${error.message}`,
      };
    }
  }

  // Helper methods
  private async checkDependencies(dependencies: string[]): Promise<string[]> {
    const pending: string[] = [];
    
    for (const dep of dependencies) {
      const result = await this.memory.retrieve(`task_${dep}_result`, 'task_results');
      if (!result) {
        pending.push(dep);
      }
    }
    
    return pending;
  }

  private async updateWorkflowProgress(workflowId: string, taskId: string, result: any): Promise<void> {
    const workflow = await this.memory.getWorkflowMemory(workflowId);
    if (!workflow) return;

    // Find step number from task ID
    const stepMatch = taskId.match(/step_(\d+)/);
    if (stepMatch) {
      const stepNumber = parseInt(stepMatch[1]);
      workflow.stepResults.set(stepNumber, result);
      await this.memory.storeWorkflowMemory(workflowId, workflow);
    }
  }

  private async calculateTaskMetrics(taskId: string): Promise<any> {
    const events = await this.memory.getCoordinationEvents({
      taskId,
      limit: 100,
    });

    const startEvent = events.find(e => e.eventType === 'task_start');
    const endEvent = events.find(e => e.eventType === 'task_completed' || e.eventType === 'task_failed');

    if (!startEvent || !endEvent) {
      return { executionTime: 0 };
    }

    const executionTime = endEvent.timestamp - startEvent.timestamp;
    
    return {
      executionTime,
      executionTimeFormatted: formatDuration(executionTime),
      success: endEvent.eventType === 'task_completed',
    };
  }

  private async checkResourceAvailability(workflow: any): Promise<{ available: boolean; reason?: string; missing?: string[] }> {
    // Simple resource check - can be extended
    const requiredAgents = workflow.requiredAgents || 1;
    const availableAgents = await this.getAvailableAgentCount();
    
    if (availableAgents < requiredAgents) {
      return {
        available: false,
        reason: `Insufficient agents: ${availableAgents}/${requiredAgents} available`,
        missing: ['agents'],
      };
    }
    
    return { available: true };
  }

  private async getAvailableAgentCount(): Promise<number> {
    // This would query the actual swarm state
    // For now, return a mock value
    return 5;
  }

  private isRecoverableError(error: Error): boolean {
    const recoverableErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'Network error',
      'Temporary failure',
    ];
    
    return recoverableErrors.some(err => 
      error.message.includes(err) || error.name.includes(err)
    );
  }

  // Notification hooks for external integrations
  async notifyWorkflowUpdate(workflowId: string, update: any): Promise<void> {
    const context: HookContext = {
      workflowId,
      timestamp: Date.now(),
      metadata: { updateType: update.type },
    };

    await this.executeHook('notification', context, {
      type: 'workflow_update',
      workflowId,
      update,
    });
  }

  async notifyAgentStatus(agentId: string, status: any): Promise<void> {
    const context: HookContext = {
      agentId,
      timestamp: Date.now(),
      metadata: { status: status.state },
    };

    await this.executeHook('notification', context, {
      type: 'agent_status',
      agentId,
      status,
    });
  }

  // Cleanup
  clearHooks(): void {
    this.removeAllListeners();
    this.activeHooks.clear();
  }
}