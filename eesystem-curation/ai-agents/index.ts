/**
 * EESystem AI Agent Orchestration Platform - Main Entry Point
 * Complete AI agent system for content curation and generation
 */

export { AgentOrchestrator } from './workflows/orchestrator';
export { ContentGenerationWorkflow } from './workflows/content-generation-workflow';
export { MemoryCoordinator } from './coordination/memory-coordinator';
export { PerformanceMonitor } from './monitoring/performance-monitor';

// Export all agent types
export { ResearchAgent } from './agents/research-agent';
export { CurationAgent } from './agents/curation-agent';
export { AnalysisAgent } from './agents/analysis-agent';
export { ScriptWriterAgent } from './agents/script-writer-agent';
export { CaptionWriterAgent } from './agents/caption-writer-agent';
export { MediaPromptAgent } from './agents/media-prompt-agent';
export { SchedulingAgent } from './agents/scheduling-agent';
export { ComplianceAgent } from './agents/compliance-agent';

// Export type definitions
export * from './types/agent-types';
export * from './types/brand-types';
export * from './types/content-types';

/**
 * EESystem AI Agent Platform
 * Main class that provides the complete AI agent orchestration platform
 */
import { AgentOrchestrator } from './workflows/orchestrator';
import { ContentGenerationWorkflow } from './workflows/content-generation-workflow';
import { MemoryCoordinator } from './coordination/memory-coordinator';
import { PerformanceMonitor } from './monitoring/performance-monitor';
import { Platform } from './types/content-types';

export class EESystemAIAgentPlatform {
  private orchestrator: AgentOrchestrator;
  private contentWorkflow: ContentGenerationWorkflow;
  private memoryCoordinator: MemoryCoordinator;
  private performanceMonitor: PerformanceMonitor;
  private isInitialized: boolean;

  constructor() {
    this.orchestrator = new AgentOrchestrator();
    this.memoryCoordinator = new MemoryCoordinator();
    this.performanceMonitor = new PerformanceMonitor();
    this.contentWorkflow = new ContentGenerationWorkflow(this.orchestrator);
    this.isInitialized = false;
  }

  /**
   * Initialize the complete AI agent platform
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing EESystem AI Agent Platform...');
    
    try {
      // Initialize orchestrator and all agents
      await this.orchestrator.initialize();
      
      // Start performance monitoring
      this.performanceMonitor.startMonitoring();
      
      // Set up coordination hooks
      await this.setupCoordinationHooks();
      
      this.isInitialized = true;
      console.log('✅ EESystem AI Agent Platform initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize platform:', error);
      throw error;
    }
  }

  /**
   * Generate content for Instagram Reel following EESystem publication schedule
   */
  async generateInstagramReel(theme: string, hook: string): Promise<any> {
    this.ensureInitialized();
    
    console.log(`📱 Generating Instagram Reel: ${theme}`);
    
    try {
      const result = await this.contentWorkflow.executeInstagramReelWorkflow(theme, hook);
      
      // Store result in memory
      this.memoryCoordinator.setShared('latest-instagram-reel', result);
      
      console.log('✅ Instagram Reel generated successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to generate Instagram Reel:', error);
      throw error;
    }
  }

  /**
   * Generate content for TikTok Short following EESystem publication schedule
   */
  async generateTikTokShort(theme: string, hook: string): Promise<any> {
    this.ensureInitialized();
    
    console.log(`🎵 Generating TikTok Short: ${theme}`);
    
    try {
      const result = await this.contentWorkflow.executeTikTokShortWorkflow(theme, hook);
      
      // Store result in memory
      this.memoryCoordinator.setShared('latest-tiktok-short', result);
      
      console.log('✅ TikTok Short generated successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to generate TikTok Short:', error);
      throw error;
    }
  }

  /**
   * Generate carousel content for Instagram/Facebook
   */
  async generateCarousel(theme: string, slides: string[]): Promise<any> {
    this.ensureInitialized();
    
    console.log(`🖼️ Generating Carousel: ${theme}`);
    
    try {
      const result = await this.contentWorkflow.executeCarouselWorkflow(theme, slides);
      
      // Store result in memory
      this.memoryCoordinator.setShared('latest-carousel', result);
      
      console.log('✅ Carousel generated successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to generate Carousel:', error);
      throw error;
    }
  }

  /**
   * Generate quote post for social media
   */
  async generateQuotePost(theme: string, quote: string): Promise<any> {
    this.ensureInitialized();
    
    console.log(`💬 Generating Quote Post: ${theme}`);
    
    try {
      const result = await this.contentWorkflow.executeQuotePostWorkflow(theme, quote);
      
      // Store result in memory
      this.memoryCoordinator.setShared('latest-quote-post', result);
      
      console.log('✅ Quote Post generated successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to generate Quote Post:', error);
      throw error;
    }
  }

  /**
   * Execute the publication schedule for a specific date
   */
  async executePublicationSchedule(date: string): Promise<any> {
    this.ensureInitialized();
    
    console.log(`📅 Executing publication schedule for: ${date}`);
    
    try {
      // Load publication schedule for the date
      const scheduleItems = await this.loadScheduleForDate(date);
      
      // Generate content for each scheduled item
      const results = [];
      for (const item of scheduleItems) {
        const result = await this.generateContentForScheduleItem(item);
        results.push(result);
      }
      
      // Store consolidated results
      this.memoryCoordinator.setShared(`schedule-results-${date}`, results);
      
      console.log(`✅ Publication schedule executed for ${date}: ${results.length} items`);
      return results;
      
    } catch (error) {
      console.error(`❌ Failed to execute publication schedule for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Get agent performance status
   */
  async getAgentStatus(): Promise<any> {
    this.ensureInitialized();
    
    const orchestratorStatus = await this.orchestrator.getAgentStatus();
    const performanceReport = this.performanceMonitor.getSystemPerformance();
    const memoryStats = this.memoryCoordinator.getMemoryStats();
    
    return {
      platform: {
        initialized: this.isInitialized,
        timestamp: new Date().toISOString()
      },
      orchestrator: orchestratorStatus,
      performance: performanceReport,
      memory: memoryStats,
      coordination: {
        activeWorkflows: this.contentWorkflow.isWorkflowRunning() ? 1 : 0,
        memoryEntries: memoryStats.totalMemorySize
      }
    };
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(): Promise<any> {
    this.ensureInitialized();
    
    const systemReport = this.performanceMonitor.getSystemPerformance();
    const optimizationPlan = this.performanceMonitor.generateOptimizationPlan();
    
    return {
      systemPerformance: systemReport,
      optimizationPlan,
      recommendations: systemReport.recommendations,
      healthScore: systemReport.overview.overallHealth
    };
  }

  /**
   * Get brand compliance report
   */
  async getBrandComplianceReport(): Promise<any> {
    this.ensureInitialized();
    
    // Get recent content compliance scores
    const recentReel = this.memoryCoordinator.getShared('latest-instagram-reel');
    const recentShort = this.memoryCoordinator.getShared('latest-tiktok-short');
    const recentCarousel = this.memoryCoordinator.getShared('latest-carousel');
    
    const complianceScores = [];
    
    if (recentReel?.analysis?.complianceScore) {
      complianceScores.push({
        type: 'Instagram Reel',
        score: recentReel.analysis.complianceScore,
        brandAlignment: recentReel.analysis.brandAlignment
      });
    }
    
    if (recentShort?.analysis?.complianceScore) {
      complianceScores.push({
        type: 'TikTok Short',
        score: recentShort.analysis.complianceScore,
        brandAlignment: recentShort.analysis.brandAlignment
      });
    }
    
    if (recentCarousel?.analysis?.complianceScore) {
      complianceScores.push({
        type: 'Carousel',
        score: recentCarousel.analysis.complianceScore,
        brandAlignment: recentCarousel.analysis.brandAlignment
      });
    }
    
    const averageCompliance = complianceScores.length > 0 ?
      complianceScores.reduce((sum, item) => sum + item.score, 0) / complianceScores.length : 0;
      
    const averageBrandAlignment = complianceScores.length > 0 ?
      complianceScores.reduce((sum, item) => sum + item.brandAlignment, 0) / complianceScores.length : 0;
    
    return {
      timestamp: new Date().toISOString(),
      overallCompliance: averageCompliance,
      overallBrandAlignment: averageBrandAlignment,
      contentScores: complianceScores,
      status: averageCompliance >= 80 ? 'COMPLIANT' : 'NEEDS_REVIEW',
      recommendations: this.generateComplianceRecommendations(averageCompliance, averageBrandAlignment)
    };
  }

  /**
   * Export platform data for backup or analysis
   */
  async exportPlatformData(): Promise<any> {
    this.ensureInitialized();
    
    return {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      agentStatus: await this.orchestrator.getAgentStatus(),
      performanceData: this.performanceMonitor.exportPerformanceData(),
      memorySnapshot: this.memoryCoordinator.exportMemorySnapshot(),
      recentContent: {
        instagramReel: this.memoryCoordinator.getShared('latest-instagram-reel'),
        tiktokShort: this.memoryCoordinator.getShared('latest-tiktok-short'),
        carousel: this.memoryCoordinator.getShared('latest-carousel'),
        quotePost: this.memoryCoordinator.getShared('latest-quote-post')
      }
    };
  }

  /**
   * Cleanup old data and optimize performance
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<any> {
    this.ensureInitialized();
    
    console.log('🧹 Starting platform cleanup...');
    
    const performanceCleanup = this.performanceMonitor.cleanupOldData(maxAge);
    const memoryCleanup = this.memoryCoordinator.cleanupOldMemory(maxAge);
    
    console.log(`✅ Cleanup completed: ${performanceCleanup + memoryCleanup} entries removed`);
    
    return {
      timestamp: new Date().toISOString(),
      performanceEntriesRemoved: performanceCleanup,
      memoryEntriesRemoved: memoryCleanup,
      totalRemoved: performanceCleanup + memoryCleanup
    };
  }

  // Private methods
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Platform not initialized. Call initialize() first.');
    }
  }

  private async setupCoordinationHooks(): Promise<void> {
    // Set up coordination hooks between agents
    console.log('🔗 Setting up coordination hooks...');
    
    // Pre-task hook: Store task context in memory
    this.memoryCoordinator.setShared('coordination-hooks-enabled', true);
    
    // Post-edit hook: Track file operations
    this.memoryCoordinator.setShared('post-edit-tracking', true);
    
    // Notification hook: Enable agent communication
    this.memoryCoordinator.setShared('notification-system', true);
  }

  private async loadScheduleForDate(date: string): Promise<any[]> {
    // Load publication schedule for specific date
    // This would integrate with the actual CSV schedule
    return [
      {
        platform: Platform.INSTAGRAM,
        contentType: 'IG Reel',
        theme: 'Clear the Deck—Your Body's First',
        hook: 'Noise starts in the body—tension, fatigue, clutter.'
      },
      {
        platform: Platform.TIKTOK,
        contentType: 'Daily Short',
        theme: 'Clear the Deck in 15 Seconds',
        hook: 'Reset your body, reset your energy.'
      }
    ];
  }

  private async generateContentForScheduleItem(item: any): Promise<any> {
    // Generate content based on schedule item
    switch (item.contentType) {
      case 'IG Reel':
        return await this.generateInstagramReel(item.theme, item.hook);
      case 'Daily Short':
        return await this.generateTikTokShort(item.theme, item.hook);
      case 'Carousel':
        return await this.generateCarousel(item.theme, item.slides || []);
      case 'Quote':
        return await this.generateQuotePost(item.theme, item.quote || item.hook);
      default:
        throw new Error(`Unknown content type: ${item.contentType}`);
    }
  }

  private generateComplianceRecommendations(compliance: number, brandAlignment: number): string[] {
    const recommendations = [];
    
    if (compliance < 80) {
      recommendations.push('Improve health claims compliance');
      recommendations.push('Add required disclaimers');
    }
    
    if (brandAlignment < 75) {
      recommendations.push('Increase use of EESystem brand elements');
      recommendations.push('Include #43FAFF color more prominently');
      recommendations.push('Use more scalar field terminology');
    }
    
    if (compliance >= 80 && brandAlignment >= 75) {
      recommendations.push('Compliance and brand alignment are excellent');
    }
    
    return recommendations;
  }
}