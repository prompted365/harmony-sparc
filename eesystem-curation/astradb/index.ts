/**
 * AstraDB Integration Module for EESystem Content Curation Platform
 * Complete integration with vector search, analytics, and content management
 */

// Core Integration
export { AstraDBClient } from './integration/astradb-client';
export { EmbeddingService } from './integration/embedding-service';

// Schemas
export * from './schemas/content-schema';

// Search and Retrieval
export { HybridSearchEngine } from './retrieval/hybrid-search';

// Content Processing
export { ContentProcessor } from './preprocessing/content-processor';

// Analytics and Monitoring
export { TrendDetector } from './analytics/trend-detector';
export { PerformanceMonitor } from './monitoring/performance-monitor';

// Utilities
export { logger } from './utils/logger';

// Configuration interfaces
export interface EESystemAstraDBConfig {
  astraDB: {
    token: string;
    apiEndpoint: string;
    namespace?: string;
    maxRetries?: number;
    timeout?: number;
  };
  openAI: {
    apiKey: string;
    model?: string;
    maxRetries?: number;
    timeout?: number;
  };
  monitoring: {
    enabled: boolean;
    intervalMs?: number;
    alertsEnabled?: boolean;
  };
  search: {
    defaultSemanticWeight?: number;
    defaultLexicalWeight?: number;
    maxResults?: number;
    cacheEnabled?: boolean;
  };
  content: {
    autoValidation?: boolean;
    autoEnhancement?: boolean;
    chunkingEnabled?: boolean;
    maxChunkSize?: number;
  };
}

/**
 * Main AstraDB Integration Class
 * Coordinates all components for the EESystem Content Curation Platform
 */
export class EESystemAstraDBIntegration {
  private astraDBClient: AstraDBClient;
  private embeddingService: EmbeddingService;
  private hybridSearch: HybridSearchEngine;
  private contentProcessor: ContentProcessor;
  private trendDetector: TrendDetector;
  private performanceMonitor: PerformanceMonitor;
  private config: EESystemAstraDBConfig;

  constructor(config: EESystemAstraDBConfig) {
    this.config = config;
    this.initializeComponents();
  }

  private initializeComponents(): void {
    // Initialize core services
    this.astraDBClient = new AstraDBClient(this.config.astraDB);
    this.embeddingService = new EmbeddingService(this.config.openAI);
    
    // Initialize search and processing
    this.hybridSearch = new HybridSearchEngine(this.astraDBClient, this.embeddingService);
    this.contentProcessor = new ContentProcessor(this.embeddingService);
    
    // Initialize analytics and monitoring
    this.trendDetector = new TrendDetector(this.astraDBClient, this.embeddingService);
    this.performanceMonitor = new PerformanceMonitor(this.astraDBClient);
    
    // Start monitoring if enabled
    if (this.config.monitoring.enabled) {
      this.performanceMonitor.startMonitoring(
        this.config.monitoring.intervalMs || 60000
      );
    }
  }

  // Content Management API
  async createContent(contentData: any) {
    const processingOptions = {
      validateSchema: this.config.content.autoValidation !== false,
      generateEmbeddings: true,
      enhanceContent: this.config.content.autoEnhancement !== false,
      chunkLongContent: this.config.content.chunkingEnabled !== false,
      maxChunkSize: this.config.content.maxChunkSize || 1000
    };

    const processingResult = await this.contentProcessor.processContent(
      contentData, 
      processingOptions
    );

    if (!processingResult.success || !processingResult.processedContent) {
      throw new Error(`Content processing failed: ${processingResult.errors?.join(', ')}`);
    }

    return this.astraDBClient.createContent(processingResult.processedContent);
  }

  async updateContent(id: string, updates: any) {
    return this.astraDBClient.updateContent(id, updates);
  }

  async getContent(id: string) {
    return this.astraDBClient.getContentById(id);
  }

  async deleteContent(id: string) {
    return this.astraDBClient.deleteContent(id);
  }

  // Search API
  async searchContent(query: string, options?: any) {
    const searchOptions = {
      query,
      limit: options?.limit || this.config.search.maxResults || 10,
      semanticWeight: options?.semanticWeight || this.config.search.defaultSemanticWeight || 0.7,
      lexicalWeight: options?.lexicalWeight || this.config.search.defaultLexicalWeight || 0.3,
      reranking: options?.reranking !== false,
      includeBrandContext: options?.includeBrandContext !== false,
      ...options
    };

    return this.hybridSearch.search(searchOptions);
  }

  async getRecommendations(contentId: string, limit: number = 5) {
    return this.hybridSearch.getRecommendations(contentId, limit);
  }

  // Analytics API
  async analyzeTrends(timeframe: string = '30d', platforms?: string[], contentTypes?: string[]) {
    return this.trendDetector.analyzeTrends(timeframe, platforms, contentTypes);
  }

  async getPerformanceMetrics(contentId: string, timeframe: string = '30d') {
    return this.trendDetector.getPerformanceMetrics(contentId, timeframe);
  }

  async storeAnalytics(analytics: any) {
    return this.astraDBClient.storeContentAnalytics(analytics);
  }

  // Brand Knowledge API
  async createBrandKnowledge(knowledge: any) {
    return this.astraDBClient.createBrandKnowledge(knowledge);
  }

  async searchBrandKnowledge(query: string, category?: string) {
    return this.astraDBClient.searchBrandKnowledge(query, category);
  }

  // Batch Operations
  async batchCreateContent(contents: any[]) {
    const processedContents = await this.contentProcessor.batchProcessContent(contents);
    const validContents = processedContents
      .filter(result => result.success && result.processedContent)
      .map(result => result.processedContent!);

    if (validContents.length === 0) {
      throw new Error('No valid content to create');
    }

    return this.astraDBClient.batchInsertContent(validContents);
  }

  // Monitoring API
  getHealthStatus() {
    return this.performanceMonitor.getHealthStatus();
  }

  getPerformanceMetrics() {
    return this.performanceMonitor.getLatestMetrics();
  }

  getActiveAlerts() {
    return this.performanceMonitor.getActiveAlerts();
  }

  async getOptimizationRecommendations() {
    return this.performanceMonitor.generateOptimizationRecommendations();
  }

  // CSV Import Utility for EESystem Publication Schedule
  async importFromCSV(csvData: string) {
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    const contents = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;

      const contentData = {
        publication_date: this.parseDate(values[0]),
        day_of_week: values[1]?.toUpperCase(),
        platform: this.parsePlatforms(values[2]),
        content_type: this.parseContentType(values[3]),
        hook_title: values[4],
        caption: values[5],
        cta: values[6],
        script: values[7],
        media_prompt: values[8],
        compliance_level: values[9] === 'Claims are general' ? 'GENERAL_CLAIMS' : 'GENERAL_CLAIMS',
        production_notes: values[10],
        theme: this.detectThemeFromContent(values[4], values[5], values[7]),
        hashtags: this.extractHashtags(values[5]),
        brand_colors: {
          primary: '#43FAFF',
          secondary: '#FFFFFF',
          accent: '#000000',
          background: '#F5F5F5'
        }
      };

      contents.push(contentData);
    }

    return this.batchCreateContent(contents);
  }

  private parseDate(dateStr: string): string {
    // Parse date from MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}T12:00:00.000Z`;
    }
    return new Date().toISOString();
  }

  private parsePlatforms(platformStr: string): string[] {
    const platformMap: Record<string, string> = {
      'Instagram': 'INSTAGRAM',
      'TikTok': 'TIKTOK',
      'YouTube': 'YOUTUBE',
      'Facebook': 'FACEBOOK',
      'Twitter': 'TWITTER'
    };

    return platformStr.split('&').map(p => 
      platformMap[p.trim()] || p.trim().toUpperCase()
    );
  }

  private parseContentType(typeStr: string): string {
    const typeMap: Record<string, string> = {
      'IG Reel': 'IG_REEL',
      'IG Story': 'IG_STORY',
      'Carousel': 'IG_CAROUSEL',
      'Daily Short': 'TIKTOK_SHORT',
      'Quote': 'QUOTE_CARD',
      'Poll': 'POLL',
      'UGC': 'UGC_CONTENT',
      'Thread': 'TWITTER_THREAD'
    };

    return typeMap[typeStr] || 'IG_POST';
  }

  private detectThemeFromContent(title: string, caption: string, script: string): string {
    const content = `${title} ${caption} ${script}`.toLowerCase();
    
    if (content.includes('clear') && content.includes('noise')) {
      return 'CLEAR_THE_NOISE';
    }
    if (content.includes('wash') && content.includes('mud')) {
      return 'WASH_THE_MUD';
    }
    if (content.includes('coherence')) {
      return 'EE_COHERENCE';
    }
    if (content.includes('field') && content.includes('effect')) {
      return 'FIELD_EFFECT';
    }
    
    return 'SCALAR_WELLNESS';
  }

  private extractHashtags(caption: string): string[] {
    const hashtagRegex = /#\w+/g;
    const matches = caption.match(hashtagRegex);
    return matches || [];
  }

  // Cleanup
  async shutdown() {
    this.performanceMonitor.stopMonitoring();
  }
}

// Default export for easy integration
export default EESystemAstraDBIntegration;