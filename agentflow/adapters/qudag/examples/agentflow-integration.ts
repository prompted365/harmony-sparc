/**
 * AgentFlow Integration Example
 * Shows how to integrate QuDAG adapter with AgentFlow platform
 */

import { QuDAGAdapter, ResourceType, QuDAGEventType } from '../index';

// Example AgentFlow agent interface
interface AgentFlowAgent {
  id: string;
  name: string;
  capabilities: string[];
  darkDomain?: string;
}

// Example workflow interface
interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  agentId: string;
  action: string;
  params: any;
  resourceRequirements?: {
    type: ResourceType;
    amount: number;
  }[];
}

/**
 * AgentFlow-QuDAG Integration Manager
 */
class AgentFlowQuDAGIntegration {
  private adapter: QuDAGAdapter;
  private agents: Map<string, AgentFlowAgent> = new Map();
  private workflows: Map<string, Workflow> = new Map();

  constructor(config: any) {
    this.adapter = new QuDAGAdapter({
      nodeUrl: config.qudag.nodeUrl,
      rpcPort: config.qudag.rpcPort,
      onionRoutingHops: config.security.onionHops || 3,
      obfuscation: config.security.obfuscation || true,
      performanceTargets: config.performance
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    console.log('Initializing AgentFlow-QuDAG integration...');
    await this.adapter.initialize();
    console.log('✓ QuDAG adapter initialized');

    // Register dark domains for agents
    await this.registerAgentDomains();
  }

  /**
   * Register an agent with dark domain
   */
  async registerAgent(agent: AgentFlowAgent): Promise<void> {
    // Generate dark domain for agent
    const darkDomain = `${agent.name.toLowerCase().replace(/\s+/g, '-')}.dark`;
    agent.darkDomain = darkDomain;

    // Store agent
    this.agents.set(agent.id, agent);

    console.log(`✓ Registered agent: ${agent.name} (${darkDomain})`);
  }

  /**
   * Execute workflow with resource allocation
   */
  async executeWorkflow(workflow: Workflow): Promise<void> {
    console.log(`\nExecuting workflow: ${workflow.name}`);
    this.workflows.set(workflow.id, workflow);

    for (const step of workflow.steps) {
      await this.executeWorkflowStep(workflow.id, step);
    }

    console.log(`✓ Workflow ${workflow.name} completed`);
  }

  /**
   * Execute single workflow step
   */
  private async executeWorkflowStep(workflowId: string, step: WorkflowStep): Promise<void> {
    const agent = this.agents.get(step.agentId);
    if (!agent) {
      throw new Error(`Agent ${step.agentId} not found`);
    }

    console.log(`\n  Step: ${step.id} - ${step.action} (Agent: ${agent.name})`);

    // Allocate resources if required
    if (step.resourceRequirements) {
      await this.allocateResources(step.resourceRequirements);
    }

    // Send task to agent via secure channel
    const taskMessage = {
      workflowId,
      stepId: step.id,
      action: step.action,
      params: step.params,
      timestamp: Date.now()
    };

    if (agent.darkDomain) {
      const messageId = await this.adapter.sendMessage(agent.darkDomain, taskMessage);
      console.log(`    ✓ Task sent to ${agent.darkDomain} (Message: ${messageId})`);
    }

    // Simulate step execution
    await this.simulateStepExecution(step);
  }

  /**
   * Allocate resources for workflow step
   */
  private async allocateResources(requirements: any[]): Promise<void> {
    for (const req of requirements) {
      console.log(`    Allocating ${req.amount} ${req.type}...`);
      
      const order = {
        type: req.type,
        amount: req.amount,
        price: this.calculateResourcePrice(req.type),
        timestamp: Date.now(),
        signature: Buffer.from('mock-signature') as Uint8Array
      };

      try {
        const result = await this.adapter.createResourceOrder(order);
        console.log(`    ✓ Allocated ${req.amount} ${req.type} (Order: ${result.orderId})`);
      } catch (error: any) {
        console.error(`    ✗ Failed to allocate ${req.type}: ${error.message}`);
      }
    }
  }

  /**
   * Calculate resource price based on type
   */
  private calculateResourcePrice(type: ResourceType): number {
    const prices: Record<ResourceType, number> = {
      [ResourceType.CPU]: 0.10,
      [ResourceType.STORAGE]: 0.05,
      [ResourceType.BANDWIDTH]: 0.08,
      [ResourceType.MODEL]: 0.50,
      [ResourceType.MEMORY]: 0.12
    };
    return prices[type] || 0.10;
  }

  /**
   * Register dark domains for all agents
   */
  private async registerAgentDomains(): Promise<void> {
    // In production, each agent would have its own keys
    // For demo, we'll use shadow addresses
    const domainManager = (this.adapter as any).domainManager;
    
    for (const agent of this.agents.values()) {
      if (!agent.darkDomain) {
        const shadowDomain = await domainManager.generateShadowAddress(3600000); // 1 hour
        agent.darkDomain = shadowDomain;
      }
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle incoming messages from agents
    this.adapter.on(QuDAGEventType.MESSAGE_RECEIVED, (event) => {
      console.log('\n📨 Message received:', {
        from: event.message.sender,
        id: event.message.id
      });
      // Process agent responses
    });

    // Monitor resource exchanges
    this.adapter.on(QuDAGEventType.RESOURCE_EXCHANGE_COMPLETED, (event) => {
      console.log('\n💱 Resource exchange completed:', {
        orderId: event.result.orderId,
        status: event.result.status
      });
    });

    // Monitor performance
    this.adapter.on(QuDAGEventType.PERFORMANCE_METRIC, (event) => {
      if (event.metric.latency > 100) {
        console.warn('⚠️  High latency detected:', event.metric.latency + 'ms');
      }
    });
  }

  /**
   * Simulate workflow step execution
   */
  private async simulateStepExecution(step: WorkflowStep): Promise<void> {
    // Simulate processing time
    const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));
    console.log(`    ✓ Step completed in ${(processingTime / 1000).toFixed(1)}s`);
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<any> {
    const health = await this.adapter.performHealthCheck();
    const status = this.adapter.getConnectionStatus();
    
    return {
      qudag: health,
      connection: status,
      agents: this.agents.size,
      workflows: this.workflows.size
    };
  }

  /**
   * Shutdown integration
   */
  async shutdown(): Promise<void> {
    await this.adapter.disconnect();
    console.log('✓ AgentFlow-QuDAG integration shutdown complete');
  }
}

/**
 * Example usage of the integration
 */
async function runIntegrationExample() {
  console.log('=== AgentFlow-QuDAG Integration Example ===\n');

  // Create integration manager
  const integration = new AgentFlowQuDAGIntegration({
    qudag: {
      nodeUrl: 'http://localhost:8000',
      rpcPort: 9090
    },
    security: {
      onionHops: 5,
      obfuscation: true
    },
    performance: {
      maxLatencyMs: 100,
      targetTPS: 1000,
      maxMemoryMB: 500
    }
  });

  try {
    // Initialize
    await integration.initialize();

    // Register agents
    await integration.registerAgent({
      id: 'agent-1',
      name: 'Data Analyst',
      capabilities: ['data-processing', 'analytics', 'reporting']
    });

    await integration.registerAgent({
      id: 'agent-2',
      name: 'ML Engineer',
      capabilities: ['model-training', 'inference', 'optimization']
    });

    await integration.registerAgent({
      id: 'agent-3',
      name: 'Report Generator',
      capabilities: ['visualization', 'documentation', 'export']
    });

    // Create and execute workflow
    const analyticsWorkflow: Workflow = {
      id: 'wf-001',
      name: 'Customer Analytics Pipeline',
      steps: [
        {
          id: 'step-1',
          agentId: 'agent-1',
          action: 'process-data',
          params: {
            source: 'customer-db',
            filters: { active: true, region: 'US' }
          },
          resourceRequirements: [
            { type: ResourceType.CPU, amount: 10 },
            { type: ResourceType.MEMORY, amount: 16 }
          ]
        },
        {
          id: 'step-2',
          agentId: 'agent-2',
          action: 'train-model',
          params: {
            algorithm: 'random-forest',
            features: ['purchase-history', 'demographics']
          },
          resourceRequirements: [
            { type: ResourceType.CPU, amount: 50 },
            { type: ResourceType.MODEL, amount: 1 }
          ]
        },
        {
          id: 'step-3',
          agentId: 'agent-3',
          action: 'generate-report',
          params: {
            format: 'pdf',
            include: ['charts', 'predictions', 'recommendations']
          },
          resourceRequirements: [
            { type: ResourceType.STORAGE, amount: 10 }
          ]
        }
      ]
    };

    await integration.executeWorkflow(analyticsWorkflow);

    // Check system health
    console.log('\nSystem Health Check:');
    const health = await integration.getSystemHealth();
    console.log('  QuDAG Status:', health.qudag.status);
    console.log('  Connected Peers:', health.connection.peers);
    console.log('  Active Agents:', health.agents);
    console.log('  Active Workflows:', health.workflows);

  } finally {
    await integration.shutdown();
  }
}

// Export for use in other modules
export { AgentFlowQuDAGIntegration };

// Run if executed directly
if (require.main === module) {
  runIntegrationExample().catch(console.error);
}