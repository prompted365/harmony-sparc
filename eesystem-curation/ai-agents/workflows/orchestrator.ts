/**
 * AI Agent Orchestrator - EESystem Content Curation Platform
 * Coordinates all AI agents for content generation and curation workflows
 */

import { Agent, AgentConfig, AgentType, Workflow, WorkflowStatus } from '../types/agent-types';
import { ResearchAgent } from '../agents/research-agent';
import { CurationAgent } from '../agents/curation-agent';
import { AnalysisAgent } from '../agents/analysis-agent';
import { ScriptWriterAgent } from '../agents/script-writer-agent';
import { CaptionWriterAgent } from '../agents/caption-writer-agent';
import { MediaPromptAgent } from '../agents/media-prompt-agent';
import { SchedulingAgent } from '../agents/scheduling-agent';
import { ComplianceAgent } from '../agents/compliance-agent';

export class AgentOrchestrator {
  private agents: Map<AgentType, Agent>;
  private workflows: Map<string, Workflow>;
  private memory: Map<string, any>;
  private isInitialized: boolean;

  constructor() {
    this.agents = new Map();
    this.workflows = new Map();
    this.memory = new Map();
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
    // Initialize all agents
    await this.initializeAgents();
    
    // Load predefined workflows
    await this.loadWorkflows();
    
    // Initialize shared memory
    await this.initializeSharedMemory();
    
    this.isInitialized = true;
    console.log('Agent Orchestrator initialized successfully');
  }

  async executeWorkflow(workflowId: string, context?: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    console.log(`Executing workflow: ${workflow.name}`);
    workflow.status = WorkflowStatus.RUNNING;

    try {
      const result = await this.executeWorkflowSteps(workflow, context);
      workflow.status = WorkflowStatus.COMPLETED;
      workflow.completedAt = new Date().toISOString();
      
      console.log(`Workflow ${workflow.name} completed successfully`);
      return result;
    } catch (error) {
      workflow.status = WorkflowStatus.FAILED;
      console.error(`Workflow ${workflow.name} failed:`, error);
      throw error;
    }
  }

  async executeContentGeneration(request: any): Promise<any> {
    // Execute the full content generation workflow
    console.log('Starting content generation workflow...');
    
    const context = {
      request,
      timestamp: new Date().toISOString(),
      workflowId: 'content-generation-' + Date.now()
    };

    // Store initial context in memory
    this.memory.set('current-context', context);
    
    try {
      // Step 1: Research
      console.log('Step 1: Research Phase');
      const researchAgent = this.agents.get(AgentType.RESEARCH);
      const researchResult = await researchAgent.execute(request.task || 'Research content for EESystem', context);
      context.research = researchResult.data;
      
      // Step 2: Curation
      console.log('Step 2: Curation Phase');
      const curationAgent = this.agents.get(AgentType.CURATION);
      const curationResult = await curationAgent.execute('Curate content based on research', context);
      context.curation = curationResult.data;
      
      // Step 3: Content Generation (Parallel)
      console.log('Step 3: Content Generation Phase');
      const contentResults = await this.executeParallelContentGeneration(context);
      context.content = contentResults;
      
      // Step 4: Analysis
      console.log('Step 4: Analysis Phase');
      const analysisAgent = this.agents.get(AgentType.ANALYSIS);
      const analysisResult = await analysisAgent.execute('Analyze generated content', context);
      context.analysis = analysisResult.data;
      
      // Step 5: Compliance Check
      console.log('Step 5: Compliance Check');
      const complianceAgent = this.agents.get(AgentType.COMPLIANCE);
      const complianceResult = await complianceAgent.execute('Check content compliance', context);
      context.compliance = complianceResult.data;
      
      // Step 6: Scheduling
      console.log('Step 6: Scheduling Phase');
      const schedulingAgent = this.agents.get(AgentType.SCHEDULING);
      const schedulingResult = await schedulingAgent.execute('Schedule content publication', context);
      context.scheduling = schedulingResult.data;
      
      // Final result compilation
      const finalResult = {
        workflowId: context.workflowId,
        status: 'completed',
        timestamp: new Date().toISOString(),
        research: context.research,
        curation: context.curation,
        content: context.content,
        analysis: context.analysis,
        compliance: context.compliance,
        scheduling: context.scheduling,
        summary: this.generateWorkflowSummary(context)
      };
      
      // Store result in memory
      this.memory.set('latest-workflow-result', finalResult);
      
      console.log('Content generation workflow completed successfully');
      return finalResult;
      
    } catch (error) {
      console.error('Content generation workflow failed:', error);
      throw error;
    }
  }

  async executeParallelContentGeneration(context: any): Promise<any> {
    // Execute content generation agents in parallel
    console.log('Executing parallel content generation...');
    
    const scriptAgent = this.agents.get(AgentType.SCRIPT_WRITER);
    const captionAgent = this.agents.get(AgentType.CAPTION_WRITER);
    const mediaAgent = this.agents.get(AgentType.MEDIA_PROMPT);
    
    // Execute all content generation agents in parallel
    const [scriptResult, captionResult, mediaResult] = await Promise.all([
      scriptAgent.execute('Generate script content', context),
      captionAgent.execute('Generate caption content', context),
      mediaAgent.execute('Generate media prompts', context)
    ]);
    
    return {
      script: scriptResult.data,
      caption: captionResult.data,
      media: mediaResult.data
    };
  }

  async getAgentStatus(): Promise<any> {
    // Get status of all agents
    const agentStatus = {};
    
    for (const [type, agent] of this.agents) {
      const memory = agent.getMemory();
      const config = agent.getConfig();
      
      agentStatus[type] = {
        type,
        name: config.name,
        initialized: memory.get('initialized') || false,
        lastActivity: memory.get('last-activity') || 'Never',
        currentTask: memory.get('current-task') || null,
        status: memory.get('status') || 'idle'
      };
    }
    
    return {
      orchestratorInitialized: this.isInitialized,
      agents: agentStatus,
      activeWorkflows: Array.from(this.workflows.values()).filter(w => 
        w.status === WorkflowStatus.RUNNING
      ).length,
      totalAgents: this.agents.size,
      memoryEntries: this.memory.size
    };
  }

  async getWorkflowStatus(workflowId?: string): Promise<any> {
    // Get workflow status
    if (workflowId) {
      const workflow = this.workflows.get(workflowId);
      return workflow || null;
    }
    
    return Array.from(this.workflows.values());
  }

  async shareMemoryBetweenAgents(sourceAgentType: AgentType, targetAgentType: AgentType, memoryKey: string): Promise<void> {
    // Share memory between agents for coordination
    const sourceAgent = this.agents.get(sourceAgentType);
    const targetAgent = this.agents.get(targetAgentType);
    
    if (!sourceAgent || !targetAgent) {
      throw new Error('Source or target agent not found');
    }
    
    const sourceMemory = sourceAgent.getMemory();
    const targetMemory = targetAgent.getMemory();
    const data = sourceMemory.get(memoryKey);
    
    if (data) {
      targetMemory.set(`${sourceAgentType}-${memoryKey}`, data);
      console.log(`Shared memory ${memoryKey} from ${sourceAgentType} to ${targetAgentType}`);
    }
  }

  async coordinateAgents(task: string, agentTypes: AgentType[]): Promise<any> {
    // Coordinate multiple agents for a task
    console.log(`Coordinating agents for task: ${task}`);
    
    const results = {};
    const context = {
      task,
      timestamp: new Date().toISOString(),
      coordinationId: 'coord-' + Date.now()
    };
    
    // Execute agents in sequence with memory sharing
    for (const agentType of agentTypes) {
      const agent = this.agents.get(agentType);
      if (!agent) {
        console.warn(`Agent ${agentType} not found, skipping...`);
        continue;
      }
      
      console.log(`Executing agent: ${agentType}`);
      
      // Share previous results with current agent
      const agentContext = { ...context, previousResults: results };
      
      try {
        const result = await agent.execute(task, agentContext);
        results[agentType] = result.data;
        
        // Store result in shared memory
        this.memory.set(`${context.coordinationId}-${agentType}`, result.data);
        
      } catch (error) {
        console.error(`Agent ${agentType} failed:`, error);
        results[agentType] = { error: error.message };
      }
    }
    
    return {
      coordinationId: context.coordinationId,
      task,
      results,
      summary: this.generateCoordinationSummary(results)
    };
  }

  private async initializeAgents(): Promise<void> {
    // Initialize all specialized agents
    console.log('Initializing AI agents...');
    
    const agentConfigs = this.createAgentConfigs();
    
    // Create and initialize each agent
    for (const [type, config] of agentConfigs) {
      let agent: Agent;
      
      switch (type) {
        case AgentType.RESEARCH:
          agent = new ResearchAgent(config);
          break;
        case AgentType.CURATION:
          agent = new CurationAgent(config);
          break;
        case AgentType.ANALYSIS:
          agent = new AnalysisAgent(config);
          break;
        case AgentType.SCRIPT_WRITER:
          agent = new ScriptWriterAgent(config);
          break;
        case AgentType.CAPTION_WRITER:
          agent = new CaptionWriterAgent(config);
          break;
        case AgentType.MEDIA_PROMPT:
          agent = new MediaPromptAgent(config);
          break;
        case AgentType.SCHEDULING:
          agent = new SchedulingAgent(config);
          break;
        case AgentType.COMPLIANCE:
          agent = new ComplianceAgent(config);
          break;
        default:
          throw new Error(`Unknown agent type: ${type}`);
      }
      
      await agent.initialize();
      this.agents.set(type, agent);
      console.log(`Agent ${type} initialized`);
    }
  }

  private createAgentConfigs(): Map<AgentType, AgentConfig> {
    // Create configuration for each agent type
    const configs = new Map<AgentType, AgentConfig>();
    
    configs.set(AgentType.RESEARCH, {
      id: 'research-001',
      name: 'Research Agent',
      type: AgentType.RESEARCH,
      capabilities: ['trend-analysis', 'source-gathering', 'brand-research'],
      priority: 1,
      maxConcurrency: 3,
      memorySize: 1000,
      timeout: 30000
    });
    
    configs.set(AgentType.CURATION, {
      id: 'curation-001',
      name: 'Curation Agent',
      type: AgentType.CURATION,
      capabilities: ['content-selection', 'brand-filtering', 'schedule-alignment'],
      priority: 2,
      maxConcurrency: 2,
      memorySize: 1500,
      timeout: 25000
    });
    
    configs.set(AgentType.ANALYSIS, {
      id: 'analysis-001',
      name: 'Analysis Agent',
      type: AgentType.ANALYSIS,
      capabilities: ['performance-analysis', 'trend-prediction', 'optimization'],
      priority: 3,
      maxConcurrency: 2,
      memorySize: 2000,
      timeout: 35000
    });
    
    configs.set(AgentType.SCRIPT_WRITER, {
      id: 'script-001',
      name: 'Script Writer Agent',
      type: AgentType.SCRIPT_WRITER,
      capabilities: ['script-generation', 'brand-voice', 'scene-creation'],
      priority: 4,
      maxConcurrency: 1,
      memorySize: 1200,
      timeout: 40000
    });
    
    configs.set(AgentType.CAPTION_WRITER, {
      id: 'caption-001',
      name: 'Caption Writer Agent',
      type: AgentType.CAPTION_WRITER,
      capabilities: ['caption-generation', 'hashtag-optimization', 'platform-adaptation'],
      priority: 4,
      maxConcurrency: 1,
      memorySize: 800,
      timeout: 20000
    });
    
    configs.set(AgentType.MEDIA_PROMPT, {
      id: 'media-001',
      name: 'Media Prompt Agent',
      type: AgentType.MEDIA_PROMPT,
      capabilities: ['ai-prompt-generation', 'visual-design', 'brand-aesthetics'],
      priority: 4,
      maxConcurrency: 1,
      memorySize: 1000,
      timeout: 30000
    });
    
    configs.set(AgentType.SCHEDULING, {
      id: 'scheduling-001',
      name: 'Scheduling Agent',
      type: AgentType.SCHEDULING,
      capabilities: ['content-scheduling', 'timing-optimization', 'platform-coordination'],
      priority: 5,
      maxConcurrency: 1,
      memorySize: 800,
      timeout: 20000
    });
    
    configs.set(AgentType.COMPLIANCE, {
      id: 'compliance-001',
      name: 'Compliance Agent',
      type: AgentType.COMPLIANCE,
      capabilities: ['health-claims-checking', 'legal-compliance', 'brand-compliance'],
      priority: 6,
      maxConcurrency: 1,
      memorySize: 1500,
      timeout: 25000
    });
    
    return configs;
  }

  private async loadWorkflows(): Promise<void> {
    // Load predefined workflows
    console.log('Loading workflows...');
    
    // Content Generation Workflow
    this.workflows.set('content-generation', {
      id: 'content-generation',
      name: 'Content Generation Workflow',
      steps: [
        {
          id: 'research',
          name: 'Research Phase',
          agentType: AgentType.RESEARCH,
          dependencies: [],
          timeout: 30000,
          retryCount: 2,
          required: true
        },
        {
          id: 'curation',
          name: 'Curation Phase',
          agentType: AgentType.CURATION,
          dependencies: ['research'],
          timeout: 25000,
          retryCount: 2,
          required: true
        },
        {
          id: 'script-writing',
          name: 'Script Writing',
          agentType: AgentType.SCRIPT_WRITER,
          dependencies: ['curation'],
          timeout: 40000,
          retryCount: 1,
          required: true
        },
        {
          id: 'caption-writing',
          name: 'Caption Writing',
          agentType: AgentType.CAPTION_WRITER,
          dependencies: ['curation'],
          timeout: 20000,
          retryCount: 1,
          required: true
        },
        {
          id: 'media-prompt',
          name: 'Media Prompt Generation',
          agentType: AgentType.MEDIA_PROMPT,
          dependencies: ['curation'],
          timeout: 30000,
          retryCount: 1,
          required: true
        },
        {
          id: 'analysis',
          name: 'Content Analysis',
          agentType: AgentType.ANALYSIS,
          dependencies: ['script-writing', 'caption-writing', 'media-prompt'],
          timeout: 35000,
          retryCount: 1,
          required: true
        },
        {
          id: 'compliance',
          name: 'Compliance Check',
          agentType: AgentType.COMPLIANCE,
          dependencies: ['analysis'],
          timeout: 25000,
          retryCount: 2,
          required: true
        },
        {
          id: 'scheduling',
          name: 'Content Scheduling',
          agentType: AgentType.SCHEDULING,
          dependencies: ['compliance'],
          timeout: 20000,
          retryCount: 1,
          required: true
        }
      ],
      status: WorkflowStatus.PENDING,
      priority: 1,
      createdAt: new Date().toISOString()
    });
    
    // Research Workflow
    this.workflows.set('research-only', {
      id: 'research-only',
      name: 'Research Only Workflow',
      steps: [
        {
          id: 'research',
          name: 'Research Phase',
          agentType: AgentType.RESEARCH,
          dependencies: [],
          timeout: 30000,
          retryCount: 2,
          required: true
        }
      ],
      status: WorkflowStatus.PENDING,
      priority: 2,
      createdAt: new Date().toISOString()
    });
  }

  private async executeWorkflowSteps(workflow: Workflow, context: any): Promise<any> {
    // Execute workflow steps according to dependencies
    const results = {};
    const completed = new Set<string>();
    
    while (completed.size < workflow.steps.length) {
      const readySteps = workflow.steps.filter(step => 
        !completed.has(step.id) && 
        step.dependencies.every(dep => completed.has(dep))
      );
      
      if (readySteps.length === 0) {
        throw new Error('Workflow deadlock detected - circular dependencies');
      }
      
      // Execute ready steps in parallel
      const stepPromises = readySteps.map(step => this.executeWorkflowStep(step, context, results));
      const stepResults = await Promise.all(stepPromises);
      
      // Process results
      readySteps.forEach((step, index) => {
        results[step.id] = stepResults[index];
        completed.add(step.id);
      });
    }
    
    return results;
  }

  private async executeWorkflowStep(step: any, context: any, previousResults: any): Promise<any> {
    // Execute a single workflow step
    const agent = this.agents.get(step.agentType);
    if (!agent) {
      throw new Error(`Agent for step ${step.id} not found: ${step.agentType}`);
    }
    
    const stepContext = {
      ...context,
      previousResults,
      stepId: step.id,
      stepName: step.name
    };
    
    console.log(`Executing step: ${step.name}`);
    
    try {
      const result = await agent.execute(`Execute ${step.name}`, stepContext);
      console.log(`Step ${step.name} completed successfully`);
      return result.data;
    } catch (error) {
      console.error(`Step ${step.name} failed:`, error);
      if (step.required) {
        throw error;
      }
      return { error: error.message, skipped: true };
    }
  }

  private async initializeSharedMemory(): Promise<void> {
    // Initialize shared memory for agent coordination
    this.memory.set('orchestrator-initialized', true);
    this.memory.set('initialization-time', new Date().toISOString());
    this.memory.set('agent-count', this.agents.size);
    this.memory.set('workflow-count', this.workflows.size);
  }

  private generateWorkflowSummary(context: any): any {
    // Generate workflow execution summary
    return {
      workflowId: context.workflowId,
      executionTime: new Date().toISOString(),
      agentsUsed: [
        'research', 'curation', 'script-writer', 
        'caption-writer', 'media-prompt', 'analysis', 
        'compliance', 'scheduling'
      ],
      contentGenerated: {
        hasScript: !!context.content?.script,
        hasCaption: !!context.content?.caption,
        hasMediaPrompt: !!context.content?.media,
        complianceApproved: context.compliance?.complianceCheck?.approved || false,
        schedulingComplete: !!context.scheduling?.schedule
      },
      brandAlignment: {
        research: context.research?.brandAlignment || 0,
        content: Math.round((
          (context.content?.script?.brandAlignment || 0) +
          (context.content?.caption?.brandAlignment || 0) +
          (context.content?.media?.brandAlignment || 0)
        ) / 3),
        compliance: context.compliance?.complianceCheck?.overallScore || 0
      }
    };
  }

  private generateCoordinationSummary(results: any): any {
    // Generate coordination summary
    const successful = Object.keys(results).filter(key => !results[key].error).length;
    const total = Object.keys(results).length;
    
    return {
      successRate: (successful / total) * 100,
      totalAgents: total,
      successfulAgents: successful,
      failedAgents: total - successful,
      timestamp: new Date().toISOString()
    };
  }

  // Public API methods
  getAgents(): Map<AgentType, Agent> {
    return this.agents;
  }

  getWorkflows(): Map<string, Workflow> {
    return this.workflows;
  }

  getSharedMemory(): Map<string, any> {
    return this.memory;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}