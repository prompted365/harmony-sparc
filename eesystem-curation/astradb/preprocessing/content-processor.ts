/**
 * Content Preprocessing and Chunking Pipeline for EESystem
 * Handles content ingestion, validation, chunking, and enhancement
 */

import { ContentPiece, ContentPieceSchema, ContentTypeSchema, ContentThemeSchema } from '../schemas/content-schema';
import { EmbeddingService } from '../integration/embedding-service';
import { logger } from '../utils/logger';

export interface ProcessingOptions {
  validateSchema?: boolean;
  generateEmbeddings?: boolean;
  extractMetadata?: boolean;
  enhanceContent?: boolean;
  chunkLongContent?: boolean;
  maxChunkSize?: number;
  overlapSize?: number;
}

export interface ContentChunk {
  id: string;
  parentId: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  startPosition: number;
  endPosition: number;
  type: 'script' | 'caption' | 'media_prompt' | 'full_content';
  embeddings?: number[];
  metadata?: Record<string, any>;
}

export interface ProcessingResult {
  success: boolean;
  processedContent?: ContentPiece;
  chunks?: ContentChunk[];
  errors?: string[];
  warnings?: string[];
  metadata?: {
    processingTime: number;
    embeddingTime?: number;
    validationResult?: any;
  };
}

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class ContentProcessor {
  private embeddingService: EmbeddingService;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  async processContent(
    rawContent: any,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting content processing');
      
      const {
        validateSchema = true,
        generateEmbeddings = true,
        extractMetadata = true,
        enhanceContent = true,
        chunkLongContent = true,
        maxChunkSize = 1000,
        overlapSize = 100
      } = options;

      const result: ProcessingResult = {
        success: false,
        errors: [],
        warnings: []
      };

      // Step 1: Schema validation
      if (validateSchema) {
        const validation = this.validateContent(rawContent);
        if (!validation.isValid) {
          result.errors = validation.errors;
          result.warnings = validation.warnings;
          return result;
        }
        result.warnings?.push(...validation.warnings);
      }

      // Step 2: Content enhancement
      let processedContent = rawContent;
      if (enhanceContent) {
        processedContent = await this.enhanceContent(processedContent);
      }

      // Step 3: Metadata extraction
      if (extractMetadata) {
        processedContent = await this.extractAndEnhanceMetadata(processedContent);
      }

      // Step 4: Generate embeddings
      let embeddingTime = 0;
      if (generateEmbeddings) {
        const embeddingStart = Date.now();
        try {
          processedContent.embeddings = await this.embeddingService.generateContentEmbeddings(processedContent);
          embeddingTime = Date.now() - embeddingStart;
        } catch (error) {
          logger.error('Failed to generate embeddings:', error);
          result.warnings?.push('Failed to generate embeddings');
        }
      }

      // Step 5: Content chunking
      let chunks: ContentChunk[] = [];
      if (chunkLongContent) {
        chunks = await this.chunkContent(processedContent, {
          maxChunkSize,
          overlapSize,
          generateEmbeddings
        });
      }

      const processingTime = Date.now() - startTime;
      
      result.success = true;
      result.processedContent = processedContent;
      result.chunks = chunks;
      result.metadata = {
        processingTime,
        embeddingTime,
        validationResult: validateSchema ? this.validateContent(processedContent) : undefined
      };

      logger.info(`Content processing completed in ${processingTime}ms`);
      return result;

    } catch (error) {
      logger.error('Content processing failed:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown processing error'],
        metadata: {
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private validateContent(content: any): ContentValidationResult {
    const result: ContentValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // Basic schema validation
      ContentPieceSchema.parse(content);
    } catch (error: any) {
      result.isValid = false;
      result.errors.push(`Schema validation failed: ${error.message}`);
      return result;
    }

    // Business rule validations
    this.validateBusinessRules(content, result);
    
    // Content quality checks
    this.validateContentQuality(content, result);
    
    // Brand compliance checks
    this.validateBrandCompliance(content, result);

    return result;
  }

  private validateBusinessRules(content: any, result: ContentValidationResult): void {
    // Platform-specific validations
    if (content.platform) {
      content.platform.forEach((platform: string) => {
        switch (platform) {
          case 'INSTAGRAM':
            this.validateInstagramContent(content, result);
            break;
          case 'TIKTOK':
            this.validateTikTokContent(content, result);
            break;
          case 'YOUTUBE':
            this.validateYouTubeContent(content, result);
            break;
          case 'TWITTER':
            this.validateTwitterContent(content, result);
            break;
        }
      });
    }

    // Series validation
    if (content.series_info?.is_series) {
      if (!content.series_info.series_name) {
        result.errors.push('Series name required for series content');
      }
      if (!content.series_info.part_number || !content.series_info.total_parts) {
        result.warnings.push('Series part information missing');
      }
    }

    // Compliance validation
    if (content.health_claims && content.health_claims.length > 0) {
      if (content.compliance_level === 'GENERAL_CLAIMS') {
        result.warnings.push('Health claims present with general compliance level');
      }
    }
  }

  private validateInstagramContent(content: any, result: ContentValidationResult): void {
    if (content.caption && content.caption.length > 2200) {
      result.errors.push('Instagram caption exceeds 2200 character limit');
    }
    
    if (content.hashtags && content.hashtags.length > 30) {
      result.warnings.push('Instagram hashtags exceed recommended 30 limit');
    }

    if (content.content_type === 'IG_REEL' && content.script) {
      const estimatedDuration = this.estimateVideoDuration(content.script);
      if (estimatedDuration > 90) {
        result.warnings.push('Instagram Reel content may exceed 90 second limit');
      }
    }
  }

  private validateTikTokContent(content: any, result: ContentValidationResult): void {
    if (content.script) {
      const estimatedDuration = this.estimateVideoDuration(content.script);
      if (estimatedDuration > 60) {
        result.warnings.push('TikTok content may exceed 60 second limit');
      }
    }
  }

  private validateYouTubeContent(content: any, result: ContentValidationResult): void {
    if (content.content_type === 'YOUTUBE_SHORT' && content.script) {
      const estimatedDuration = this.estimateVideoDuration(content.script);
      if (estimatedDuration > 60) {
        result.warnings.push('YouTube Short content may exceed 60 second limit');
      }
    }
  }

  private validateTwitterContent(content: any, result: ContentValidationResult): void {
    if (content.caption && content.caption.length > 280) {
      result.errors.push('Twitter content exceeds 280 character limit');
    }
  }

  private validateContentQuality(content: any, result: ContentValidationResult): void {
    // Check for engaging hooks
    if (content.hook_title && content.hook_title.length < 10) {
      result.warnings.push('Hook title may be too short for engagement');
    }

    // Check for clear CTAs
    if (!content.cta || content.cta.length < 5) {
      result.warnings.push('Call-to-action may be too weak or missing');
    }

    // Check for hashtag strategy
    if (!content.hashtags || content.hashtags.length < 3) {
      result.warnings.push('Consider adding more hashtags for discovery');
    }

    // Check for scalar field theme alignment
    if (content.theme && !this.isScalarFieldAligned(content)) {
      result.suggestions.push('Consider adding more scalar field wellness terminology');
    }
  }

  private validateBrandCompliance(content: any, result: ContentValidationResult): void {
    // Check brand color usage
    if (content.brand_colors && content.brand_colors.primary !== '#43FAFF') {
      result.warnings.push('Primary brand color should be #43FAFF for scalar field branding');
    }

    // Check for required wellness disclaimers
    if (content.health_claims && content.health_claims.length > 0) {
      const hasDisclaimer = content.script?.toLowerCase().includes('disclaimer') ||
                           content.caption?.toLowerCase().includes('disclaimer');
      if (!hasDisclaimer) {
        result.errors.push('Health claims require appropriate disclaimers');
      }
    }

    // Check visual guidelines alignment
    if (content.visual_guidelines) {
      if (!['WELLNESS', 'CLEAN', 'MINIMALIST'].includes(content.visual_guidelines.aesthetic)) {
        result.suggestions.push('Consider wellness-aligned visual aesthetic');
      }
    }
  }

  private isScalarFieldAligned(content: any): boolean {
    const scalarTerms = [
      'scalar', 'field', 'energy', 'wellness', 'coherence', 'clarity',
      'noise', 'mud', 'wash', 'clear', 'EE', 'biofield'
    ];
    
    const contentText = `${content.hook_title} ${content.caption} ${content.script}`.toLowerCase();
    
    return scalarTerms.some(term => contentText.includes(term));
  }

  private estimateVideoDuration(script: string): number {
    // Rough estimation: 150 words per minute for speaking
    const words = script.split(/\s+/).length;
    return Math.round((words / 150) * 60);
  }

  private async enhanceContent(content: any): Promise<ContentPiece> {
    // Auto-generate missing IDs
    if (!content.id) {
      content.id = crypto.randomUUID();
    }

    // Auto-set timestamps
    const now = new Date().toISOString();
    if (!content.created_at) {
      content.created_at = now;
    }
    content.updated_at = now;

    // Auto-detect themes if missing
    if (!content.theme) {
      content.theme = this.detectTheme(content);
    }

    // Enhance hashtags
    if (content.hashtags) {
      content.hashtags = this.enhanceHashtags(content.hashtags, content.theme);
    }

    // Auto-set brand colors if missing
    if (!content.brand_colors) {
      content.brand_colors = {
        primary: '#43FAFF',
        secondary: '#FFFFFF',
        accent: '#000000',
        background: '#F5F5F5'
      };
    }

    // Set default visual guidelines for scalar field content
    if (!content.visual_guidelines) {
      content.visual_guidelines = {
        aesthetic: 'WELLNESS',
        lighting: 'NATURAL',
        tone: 'CALM'
      };
    }

    return content;
  }

  private detectTheme(content: any): string {
    const text = `${content.hook_title} ${content.caption} ${content.script}`.toLowerCase();
    
    const themeKeywords = {
      'CLEAR_THE_NOISE': ['clear', 'noise', 'clutter', 'simplify', 'reduce'],
      'WASH_THE_MUD': ['wash', 'mud', 'cleanse', 'purify', 'clean'],
      'SCALAR_WELLNESS': ['scalar', 'wellness', 'health', 'energy'],
      'FIELD_EFFECT': ['field', 'effect', 'wave', 'frequency'],
      'EE_COHERENCE': ['coherence', 'EE', 'enhancement', 'alignment'],
      'BODY_ENERGY_COHERENCE': ['body', 'energy', 'coherence', 'alignment']
    };

    let bestTheme = 'SCALAR_WELLNESS';
    let maxMatches = 0;

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      const matches = keywords.filter(keyword => text.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestTheme = theme;
      }
    });

    return bestTheme;
  }

  private enhanceHashtags(hashtags: string[], theme: string): string[] {
    const themeHashtags = {
      'CLEAR_THE_NOISE': ['#ClearTheNoise', '#ScalarWellness', '#EnergyClearing'],
      'WASH_THE_MUD': ['#WashTheMud', '#ScalarField', '#EnergyHealing'],
      'SCALAR_WELLNESS': ['#ScalarWellness', '#EnergyMedicine', '#WellnessTech'],
      'FIELD_EFFECT': ['#FieldEffect', '#ScalarWaves', '#EnergyField'],
      'EE_COHERENCE': ['#EECoherence', '#EnergyEnhancement', '#Coherence'],
      'BODY_ENERGY_COHERENCE': ['#BodyEnergy', '#EnergyAlignment', '#WellnessJourney']
    };

    const recommendedTags = themeHashtags[theme] || ['#ScalarWellness'];
    
    // Add theme-specific hashtags that aren't already present
    const enhancedHashtags = [...hashtags];
    recommendedTags.forEach(tag => {
      if (!enhancedHashtags.some(existing => existing.toLowerCase() === tag.toLowerCase())) {
        enhancedHashtags.push(tag);
      }
    });

    return enhancedHashtags;
  }

  private async extractAndEnhanceMetadata(content: any): Promise<ContentPiece> {
    // Extract production requirements from script
    if (content.script) {
      content.production_notes = this.extractProductionNotes(content.script);
      content.b_roll_requirements = this.extractBRollRequirements(content.script);
      content.audio_requirements = this.extractAudioRequirements(content.script);
    }

    // Set target audience based on content type and theme
    if (!content.target_audience) {
      content.target_audience = this.inferTargetAudience(content);
    }

    // Auto-categorize content
    if (!content.category) {
      content.category = this.categorizeContent(content);
    }

    return content;
  }

  private extractProductionNotes(script: string): string {
    const notes: string[] = [];
    
    // Extract lighting requirements
    if (script.toLowerCase().includes('natural lighting')) {
      notes.push('Natural lighting required');
    }
    
    // Extract style requirements
    if (script.toLowerCase().includes('minimalist')) {
      notes.push('Minimalist aesthetic');
    }
    
    // Extract timing requirements
    const timeMatches = script.match(/(\d+)[–-](\d+)s:/g);
    if (timeMatches) {
      notes.push(`Timing segments: ${timeMatches.join(', ')}`);
    }

    return notes.join('; ');
  }

  private extractBRollRequirements(script: string): string[] {
    const requirements: string[] = [];
    
    // Look for B-roll mentions in script
    const brollMatches = script.match(/B-Roll[^:]*:([^.]+)/gi);
    if (brollMatches) {
      brollMatches.forEach(match => {
        const requirement = match.split(':')[1]?.trim();
        if (requirement) {
          requirements.push(requirement);
        }
      });
    }

    return requirements;
  }

  private extractAudioRequirements(script: string): any {
    const audioReq: any = {};
    
    // Extract BPM
    const bpmMatch = script.match(/(\d+)\s*BPM/i);
    if (bpmMatch) {
      audioReq.bpm = parseInt(bpmMatch[1]);
    }
    
    // Extract audio style
    const styleMatches = script.match(/(acoustic|electronic|ambient|upbeat|soft|lively)\s+track/gi);
    if (styleMatches) {
      audioReq.style = styleMatches[0].split(' ')[0];
    }
    
    // Extract effects
    const effects: string[] = [];
    if (script.includes('sound effect')) {
      effects.push('sound effects required');
    }
    if (script.includes('chime')) {
      effects.push('chime effect');
    }
    
    audioReq.effects = effects;
    
    return audioReq;
  }

  private inferTargetAudience(content: any): string {
    if (content.platform?.includes('TIKTOK')) {
      return 'Gen Z wellness enthusiasts';
    }
    if (content.platform?.includes('INSTAGRAM')) {
      return 'Millennials interested in wellness';
    }
    if (content.platform?.includes('FACEBOOK')) {
      return 'Gen X and Boomers seeking health solutions';
    }
    return 'Health and wellness community';
  }

  private categorizeContent(content: any): string {
    if (content.content_type?.includes('REEL') || content.content_type?.includes('SHORT')) {
      return 'Short-form video';
    }
    if (content.content_type?.includes('CAROUSEL')) {
      return 'Educational content';
    }
    if (content.content_type?.includes('QUOTE')) {
      return 'Inspirational content';
    }
    if (content.content_type?.includes('UGC')) {
      return 'User-generated content';
    }
    return 'General content';
  }

  async chunkContent(
    content: ContentPiece,
    options: {
      maxChunkSize: number;
      overlapSize: number;
      generateEmbeddings: boolean;
    }
  ): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    
    // Chunk script if it's long
    if (content.script && content.script.length > options.maxChunkSize) {
      const scriptChunks = this.createTextChunks(
        content.script,
        options.maxChunkSize,
        options.overlapSize
      );
      
      for (let i = 0; i < scriptChunks.length; i++) {
        const chunk: ContentChunk = {
          id: crypto.randomUUID(),
          parentId: content.id,
          content: scriptChunks[i].text,
          chunkIndex: i,
          totalChunks: scriptChunks.length,
          startPosition: scriptChunks[i].start,
          endPosition: scriptChunks[i].end,
          type: 'script'
        };
        
        if (options.generateEmbeddings) {
          try {
            chunk.embeddings = await this.embeddingService.generateTextEmbedding(chunk.content);
          } catch (error) {
            logger.error('Failed to generate chunk embeddings:', error);
          }
        }
        
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  private createTextChunks(
    text: string,
    maxSize: number,
    overlapSize: number
  ): Array<{ text: string; start: number; end: number }> {
    const chunks: Array<{ text: string; start: number; end: number }> = [];
    
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + maxSize, text.length);
      
      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastExclamation = text.lastIndexOf('!', end);
        const lastQuestion = text.lastIndexOf('?', end);
        
        const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
        if (lastSentenceEnd > start + maxSize * 0.5) {
          end = lastSentenceEnd + 1;
        }
      }
      
      chunks.push({
        text: text.substring(start, end).trim(),
        start,
        end
      });
      
      start = end - overlapSize;
    }
    
    return chunks;
  }

  async batchProcessContent(
    rawContents: any[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    logger.info(`Starting batch processing of ${rawContents.length} content pieces`);
    
    for (let i = 0; i < rawContents.length; i++) {
      try {
        const result = await this.processContent(rawContents[i], options);
        results.push(result);
        
        if ((i + 1) % 10 === 0) {
          logger.info(`Processed ${i + 1}/${rawContents.length} content pieces`);
        }
      } catch (error) {
        logger.error(`Failed to process content at index ${i}:`, error);
        results.push({
          success: false,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }
    
    logger.info(`Batch processing completed. ${results.filter(r => r.success).length}/${rawContents.length} successful`);
    
    return results;
  }
}

export default ContentProcessor;