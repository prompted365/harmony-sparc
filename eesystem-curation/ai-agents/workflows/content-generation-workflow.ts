/**
 * Content Generation Workflow - EESystem Content Curation Platform
 * Specialized workflow for generating content following the EESystem publication schedule
 */

import { AgentOrchestrator } from './orchestrator';
import { AgentType } from '../types/agent-types';
import { Platform } from '../types/content-types';

export class ContentGenerationWorkflow {
  private orchestrator: AgentOrchestrator;
  private workflowId: string;
  private isRunning: boolean;

  constructor(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
    this.workflowId = '';
    this.isRunning = false;
  }

  async executeContentCreation(request: ContentCreationRequest): Promise<ContentCreationResult> {
    // Execute content creation workflow based on publication schedule
    if (this.isRunning) {
      throw new Error('Workflow is already running');
    }

    this.isRunning = true;
    this.workflowId = `content-${Date.now()}`;
    
    console.log(`Starting content creation workflow: ${this.workflowId}`);
    
    try {
      const result = await this.executePhases(request);
      
      console.log(`Content creation workflow completed: ${this.workflowId}`);
      return result;
      
    } catch (error) {
      console.error(`Content creation workflow failed: ${this.workflowId}`, error);
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }

  async executeInstagramReelWorkflow(theme: string, hook: string): Promise<any> {
    // Specialized workflow for Instagram Reel creation
    const request: ContentCreationRequest = {
      platform: Platform.INSTAGRAM,
      contentType: 'IG Reel',
      theme: theme,
      hook: hook,
      duration: 15,
      brandRequirements: {
        primaryColor: '#43FAFF',
        includeScalarElements: true,
        voiceTone: 'wellness-focused, accessible',
        visualStyle: 'clean, modern, minimalist'
      }
    };
    
    return await this.executeContentCreation(request);
  }

  async executeTikTokShortWorkflow(theme: string, hook: string): Promise<any> {
    // Specialized workflow for TikTok Short creation
    const request: ContentCreationRequest = {
      platform: Platform.TIKTOK,
      contentType: 'Daily Short',
      theme: theme,
      hook: hook,
      duration: 15,
      brandRequirements: {
        primaryColor: '#43FAFF',
        includeScalarElements: true,
        voiceTone: 'energetic, accessible',
        visualStyle: 'vibrant, dynamic'
      }
    };
    
    return await this.executeContentCreation(request);
  }

  async executeCarouselWorkflow(theme: string, slides: string[]): Promise<any> {
    // Specialized workflow for Carousel content creation
    const request: ContentCreationRequest = {
      platform: Platform.INSTAGRAM,
      contentType: 'Carousel',
      theme: theme,
      slides: slides,
      brandRequirements: {
        primaryColor: '#43FAFF',
        includeScalarElements: true,
        voiceTone: 'educational, scientific',
        visualStyle: 'infographic, clean'
      }
    };
    
    return await this.executeContentCreation(request);
  }

  async executeQuotePostWorkflow(theme: string, quote: string): Promise<any> {
    // Specialized workflow for Quote post creation
    const request: ContentCreationRequest = {
      platform: Platform.INSTAGRAM,
      contentType: 'Quote',
      theme: theme,
      quote: quote,
      brandRequirements: {
        primaryColor: '#43FAFF',
        includeScalarElements: false,
        voiceTone: 'inspirational, accessible',
        visualStyle: 'elegant, minimalist'
      }
    };
    
    return await this.executeContentCreation(request);
  }

  async executeBatchContentCreation(requests: ContentCreationRequest[]): Promise<ContentCreationResult[]> {
    // Execute multiple content creation requests in parallel
    console.log(`Starting batch content creation for ${requests.length} items`);
    
    const batchPromises = requests.map(request => 
      this.executeContentCreation(request).catch(error => ({
        error: error.message,
        request: request
      }))
    );
    
    const results = await Promise.all(batchPromises);
    
    console.log(`Batch content creation completed: ${results.length} items processed`);
    return results;
  }

  private async executePhases(request: ContentCreationRequest): Promise<ContentCreationResult> {
    // Execute the content creation phases
    const context = {
      request,
      workflowId: this.workflowId,
      timestamp: new Date().toISOString()
    };

    // Phase 1: Research and Analysis
    const researchPhase = await this.executeResearchPhase(context);
    context.research = researchPhase;

    // Phase 2: Content Strategy
    const strategyPhase = await this.executeStrategyPhase(context);
    context.strategy = strategyPhase;

    // Phase 3: Content Generation
    const generationPhase = await this.executeGenerationPhase(context);
    context.generation = generationPhase;

    // Phase 4: Quality Assurance
    const qaPhase = await this.executeQualityAssurancePhase(context);
    context.qa = qaPhase;

    // Phase 5: Publishing Preparation
    const publishingPhase = await this.executePublishingPhase(context);
    context.publishing = publishingPhase;

    return this.compileResults(context);
  }

  private async executeResearchPhase(context: any): Promise<any> {
    // Execute research phase
    console.log('Phase 1: Research and Analysis');
    
    const researchTasks = [
      'Analyze current trends in wellness and scalar technology',
      'Research audience engagement patterns for the platform',
      'Identify optimal content themes and messaging',
      'Analyze competitor content and performance'
    ];
    
    const researchResults = await this.orchestrator.coordinateAgents(
      researchTasks.join('; '),
      [AgentType.RESEARCH, AgentType.ANALYSIS]
    );
    
    return {
      trends: researchResults.results[AgentType.RESEARCH]?.trends || [],
      insights: researchResults.results[AgentType.ANALYSIS]?.insights || [],
      recommendations: researchResults.results[AgentType.RESEARCH]?.recommendations || []
    };
  }

  private async executeStrategyPhase(context: any): Promise<any> {
    // Execute content strategy phase
    console.log('Phase 2: Content Strategy');
    
    const curationAgent = this.orchestrator.getAgents().get(AgentType.CURATION);
    const curationResult = await curationAgent.execute(
      'Develop content strategy based on research and brand guidelines',
      context
    );
    
    return {
      contentStrategy: curationResult.data,
      themeAlignment: curationResult.data?.brandAlignment || 0,
      platformOptimization: curationResult.data?.platformOptimization || {}
    };
  }

  private async executeGenerationPhase(context: any): Promise<any> {
    // Execute content generation phase
    console.log('Phase 3: Content Generation');
    
    // Generate content in parallel
    const contentAgents = [
      AgentType.SCRIPT_WRITER,
      AgentType.CAPTION_WRITER,
      AgentType.MEDIA_PROMPT
    ];
    
    const generationResults = await this.orchestrator.coordinateAgents(
      'Generate content based on strategy and brand guidelines',
      contentAgents
    );
    
    return {
      script: generationResults.results[AgentType.SCRIPT_WRITER] || null,
      caption: generationResults.results[AgentType.CAPTION_WRITER] || null,
      mediaPrompt: generationResults.results[AgentType.MEDIA_PROMPT] || null,
      generationSummary: generationResults.summary
    };
  }

  private async executeQualityAssurancePhase(context: any): Promise<any> {
    // Execute quality assurance phase
    console.log('Phase 4: Quality Assurance');
    
    const qaAgents = [
      AgentType.COMPLIANCE,
      AgentType.ANALYSIS
    ];
    
    const qaResults = await this.orchestrator.coordinateAgents(
      'Perform quality assurance and compliance checks',
      qaAgents
    );
    
    return {
      complianceCheck: qaResults.results[AgentType.COMPLIANCE] || null,
      qualityAnalysis: qaResults.results[AgentType.ANALYSIS] || null,
      approved: qaResults.results[AgentType.COMPLIANCE]?.complianceCheck?.approved || false,
      issues: this.compileQAIssues(qaResults.results)
    };
  }

  private async executePublishingPhase(context: any): Promise<any> {
    // Execute publishing preparation phase
    console.log('Phase 5: Publishing Preparation');
    
    const schedulingAgent = this.orchestrator.getAgents().get(AgentType.SCHEDULING);
    const schedulingResult = await schedulingAgent.execute(
      'Prepare content for publishing based on schedule',
      context
    );
    
    return {
      schedule: schedulingResult.data?.schedule || null,
      publishingPlan: schedulingResult.data?.recommendations || [],
      platformDistribution: schedulingResult.data?.platformDistribution || {},
      timeline: this.generatePublishingTimeline(schedulingResult.data)
    };
  }

  private compileResults(context: any): ContentCreationResult {
    // Compile final results
    const result: ContentCreationResult = {
      workflowId: context.workflowId,
      request: context.request,
      timestamp: context.timestamp,
      success: context.qa?.approved || false,
      
      content: {
        script: context.generation?.script,
        caption: context.generation?.caption,
        mediaPrompt: context.generation?.mediaPrompt
      },
      
      analysis: {
        brandAlignment: this.calculateOverallBrandAlignment(context),
        complianceScore: context.qa?.complianceCheck?.overallScore || 0,
        qualityScore: this.calculateQualityScore(context),
        recommendations: this.compileRecommendations(context)
      },
      
      publishing: {
        schedule: context.publishing?.schedule,
        platform: context.request.platform,
        contentType: context.request.contentType,
        approved: context.qa?.approved || false
      },
      
      metadata: {
        executionTime: Date.now() - new Date(context.timestamp).getTime(),
        agentsUsed: this.getAgentsUsed(),
        phaseResults: {
          research: !!context.research,
          strategy: !!context.strategy,
          generation: !!context.generation,
          qa: !!context.qa,
          publishing: !!context.publishing
        }
      }
    };
    
    return result;
  }

  private compileQAIssues(qaResults: any): string[] {
    // Compile QA issues from results
    const issues = [];
    
    if (qaResults[AgentType.COMPLIANCE]?.issues) {
      issues.push(...qaResults[AgentType.COMPLIANCE].issues);
    }
    
    if (qaResults[AgentType.ANALYSIS]?.recommendations) {
      issues.push(...qaResults[AgentType.ANALYSIS].recommendations);
    }
    
    return issues;
  }

  private generatePublishingTimeline(schedulingData: any): any {
    // Generate publishing timeline
    if (!schedulingData?.schedule) {
      return null;
    }
    
    return {
      phases: [
        { name: 'Content Review', duration: '1 hour', status: 'pending' },
        { name: 'Final Approval', duration: '30 minutes', status: 'pending' },
        { name: 'Platform Upload', duration: '15 minutes', status: 'pending' },
        { name: 'Publication', duration: 'instant', status: 'scheduled' }
      ],
      estimatedCompletion: new Date(Date.now() + 105 * 60 * 1000).toISOString(), // 1h 45m from now
      publishTime: schedulingData.schedule?.publishDate + ' ' + schedulingData.schedule?.publishTime
    };
  }

  private calculateOverallBrandAlignment(context: any): number {
    // Calculate overall brand alignment score
    const scores = [];
    
    if (context.generation?.script?.brandAlignment) {
      scores.push(context.generation.script.brandAlignment);
    }
    
    if (context.generation?.caption?.brandAlignment) {
      scores.push(context.generation.caption.brandAlignment);
    }
    
    if (context.generation?.mediaPrompt?.brandAlignment) {
      scores.push(context.generation.mediaPrompt.brandAlignment);
    }
    
    if (context.qa?.complianceCheck?.brandCompliance?.score) {
      scores.push(context.qa.complianceCheck.brandCompliance.score);
    }
    
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  private calculateQualityScore(context: any): number {
    // Calculate overall quality score
    const factors = {
      brandAlignment: this.calculateOverallBrandAlignment(context) * 0.3,
      complianceScore: (context.qa?.complianceCheck?.overallScore || 0) * 0.4,
      contentQuality: (context.generation?.generationSummary?.successRate || 0) * 0.3
    };
    
    return Object.values(factors).reduce((sum, score) => sum + score, 0);
  }

  private compileRecommendations(context: any): string[] {
    // Compile recommendations from all phases
    const recommendations = [];
    
    if (context.research?.recommendations) {
      recommendations.push(...context.research.recommendations);
    }
    
    if (context.qa?.complianceCheck?.recommendations) {
      recommendations.push(...context.qa.complianceCheck.recommendations);
    }
    
    if (context.publishing?.publishingPlan) {
      recommendations.push(...context.publishing.publishingPlan);
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private getAgentsUsed(): string[] {
    // Get list of agents used in workflow
    return [
      'research',
      'curation',
      'script-writer',
      'caption-writer',
      'media-prompt',
      'analysis',
      'compliance',
      'scheduling'
    ];
  }

  // Getters
  getWorkflowId(): string {
    return this.workflowId;
  }

  isWorkflowRunning(): boolean {
    return this.isRunning;
  }
}

// Type definitions
export interface ContentCreationRequest {
  platform: Platform;
  contentType: string;
  theme: string;
  hook?: string;
  quote?: string;
  slides?: string[];
  duration?: number;
  brandRequirements: {
    primaryColor: string;
    includeScalarElements: boolean;
    voiceTone: string;
    visualStyle: string;
  };
}

export interface ContentCreationResult {
  workflowId: string;
  request: ContentCreationRequest;
  timestamp: string;
  success: boolean;
  content: {
    script?: any;
    caption?: any;
    mediaPrompt?: any;
  };
  analysis: {
    brandAlignment: number;
    complianceScore: number;
    qualityScore: number;
    recommendations: string[];
  };
  publishing: {
    schedule?: any;
    platform: Platform;
    contentType: string;
    approved: boolean;
  };
  metadata: {
    executionTime: number;
    agentsUsed: string[];
    phaseResults: {
      research: boolean;
      strategy: boolean;
      generation: boolean;
      qa: boolean;
      publishing: boolean;
    };
  };
}