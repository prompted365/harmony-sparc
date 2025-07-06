/**
 * Example: AgentFlow Workflow Execution with Swarm
 * Demonstrates how to use swarm coordination for workflow execution
 */

import { createSwarm, AgentConfig, Task } from '../index';

async function runWorkflowExample() {
  console.log('🚀 Starting AgentFlow Swarm Workflow Example\n');

  // 1. Create and initialize swarm
  const swarm = createSwarm({
    topology: 'hierarchical',
    maxAgents: 8,
    syncInterval: 500,
  });

  // 2. Define agent configurations
  const agents: AgentConfig[] = [
    {
      id: 'coordinator-1',
      type: 'coordinator',
      capabilities: ['orchestrate', 'monitor'],
    },
    {
      id: 'workflow-1',
      type: 'workflow',
      capabilities: ['execute', 'validate'],
      workflowSpecific: {
        supportedWorkflowTypes: ['payment', 'data-processing'],
        maxConcurrentWorkflows: 3,
      },
    },
    {
      id: 'workflow-2',
      type: 'workflow',
      capabilities: ['execute', 'validate'],
      workflowSpecific: {
        supportedWorkflowTypes: ['payment', 'data-processing'],
        maxConcurrentWorkflows: 3,
      },
    },
    {
      id: 'financial-1',
      type: 'financial',
      capabilities: ['transact', 'calculate', 'validate-payment'],
    },
    {
      id: 'ml-1',
      type: 'ml',
      capabilities: ['predict', 'analyze', 'optimize'],
    },
  ];

  // 3. Initialize swarm with agents
  console.log('📊 Initializing swarm with agents...');
  await swarm.initialize(agents);

  // 4. Register custom hooks
  swarm.registerHook('pre-task', async (context, task) => {
    console.log(`\n⚡ Pre-task hook: ${task.description}`);
    
    // Add custom validation
    if (task.metadata?.requiresApproval && !task.metadata?.approved) {
      return {
        continue: false,
        reason: 'Task requires approval before execution',
      };
    }
    
    return { continue: true };
  });

  swarm.registerHook('post-task', async (context, result) => {
    console.log(`✅ Post-task hook: Task ${context.taskId} completed`);
    
    // Store important results
    if (result.important) {
      await swarm.storeMemory(
        `important_result_${context.taskId}`,
        result,
        'important_results',
        86400 // 24 hour TTL
      );
    }
    
    return { continue: true };
  });

  // 5. Define a payment workflow
  const paymentWorkflow: Task[] = [
    {
      id: 'validate-request',
      description: 'Validate payment request',
      priority: 'high',
      metadata: {
        validationType: 'payment',
        requiredFields: ['amount', 'recipient', 'currency'],
      },
    },
    {
      id: 'check-balance',
      description: 'Check sender balance',
      priority: 'high',
      dependencies: ['validate-request'],
      metadata: {
        account: 'sender-123',
        currency: 'AGC',
      },
    },
    {
      id: 'fraud-check',
      description: 'Run fraud detection',
      priority: 'high',
      dependencies: ['validate-request'],
      metadata: {
        model: 'fraud-detector-v2',
        threshold: 0.8,
      },
    },
    {
      id: 'execute-payment',
      description: 'Execute payment transaction',
      priority: 'critical',
      dependencies: ['check-balance', 'fraud-check'],
      metadata: {
        amount: 1000,
        currency: 'AGC',
        recipient: 'recipient-456',
        requiresApproval: true,
        approved: true, // Pre-approved for demo
      },
    },
    {
      id: 'notify-parties',
      description: 'Send notifications to sender and recipient',
      priority: 'medium',
      dependencies: ['execute-payment'],
      metadata: {
        notificationTypes: ['email', 'push'],
        important: true,
      },
    },
  ];

  // 6. Execute the workflow
  console.log('\n📋 Executing payment workflow...\n');
  
  try {
    const results = await swarm.executeWorkflow('payment-workflow-001', paymentWorkflow);
    
    console.log('\n✨ Workflow completed successfully!');
    console.log('Results:', results);
    
    // 7. Check metrics
    const metrics = swarm.getMetrics();
    console.log('\n📊 Swarm Metrics:');
    console.log(`- Total tasks: ${metrics.totalTasks}`);
    console.log(`- Completed: ${metrics.completedTasks}`);
    console.log(`- Failed: ${metrics.failedTasks}`);
    console.log(`- Average completion time: ${Math.round(metrics.averageCompletionTime)}ms`);
    console.log(`- Workflow success rate: ${(metrics.workflowMetrics?.successRate || 0) * 100}%`);
    
    // 8. Retrieve stored results
    const importantResults = await swarm.listMemory('important_results');
    console.log(`\n💾 Stored ${importantResults.length} important results`);
    
  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
  }

  // 9. Execute a single task
  console.log('\n🎯 Executing single task...');
  
  const analysisTask: Task = {
    id: 'analyze-transactions',
    description: 'Analyze recent transactions for patterns',
    priority: 'medium',
    metadata: {
      timeframe: '24h',
      model: 'pattern-analyzer',
    },
  };
  
  const assignments = await swarm.executeTask(analysisTask);
  console.log(`Task assigned to ${assignments.length} agent(s)`);

  // 10. Check agent states
  const state = swarm.getState();
  console.log('\n👥 Agent States:');
  state.agents.forEach((agent, id) => {
    console.log(`- ${id}: ${agent.state.status} (${agent.state.performance.tasksCompleted} tasks completed)`);
  });

  // 11. Shutdown
  console.log('\n🛑 Shutting down swarm...');
  await swarm.shutdown();
  
  console.log('✅ Example completed!');
}

// Run the example
if (require.main === module) {
  runWorkflowExample().catch(console.error);
}

export { runWorkflowExample };