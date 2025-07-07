/**
 * Hybrid Retrieval System for EESystem Content Curation
 * Combines semantic vector search with lexical search and reranking
 */

import { AstraDBClient, SearchOptions, VectorSearchOptions } from '../integration/astradb-client';
import { EmbeddingService } from '../integration/embedding-service';
import { ContentPiece, BrandKnowledge } from '../schemas/content-schema';
import { logger } from '../utils/logger';

export interface HybridSearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  semanticWeight?: number; // 0-1, weight for semantic search
  lexicalWeight?: number;  // 0-1, weight for lexical search
  filters?: Record<string, any>;
  reranking?: boolean;
  includeBrandContext?: boolean;
  contentTypes?: string[];
  themes?: string[];
  platforms?: string[];
}

export interface SearchResult {
  content: ContentPiece;
  score: number;
  rankingFactors: {
    semanticScore?: number;
    lexicalScore?: number;
    brandRelevance?: number;
    freshness?: number;
    engagement?: number;
  };
  explanation?: string;
}

export interface BrandContextResult {
  knowledge: BrandKnowledge;
  relevanceScore: number;
}

export class HybridSearchEngine {
  private astraDB: AstraDBClient;
  private embeddingService: EmbeddingService;

  constructor(astraDB: AstraDBClient, embeddingService: EmbeddingService) {
    this.astraDB = astraDB;
    this.embeddingService = embeddingService;
  }

  async search(options: HybridSearchOptions): Promise<SearchResult[]> {
    try {
      logger.info(`Performing hybrid search for: "${options.query}"`);
      
      const {
        query,
        limit = 10,
        semanticWeight = 0.7,
        lexicalWeight = 0.3,
        reranking = true,
        includeBrandContext = true
      } = options;

      // Validate weights
      if (semanticWeight + lexicalWeight !== 1) {
        throw new Error('Semantic and lexical weights must sum to 1');
      }

      // Step 1: Get brand context if requested
      let brandContext: BrandContextResult[] = [];
      if (includeBrandContext) {
        brandContext = await this.getBrandContext(query);
      }

      // Step 2: Perform semantic search
      const semanticResults = await this.performSemanticSearch(query, options);
      
      // Step 3: Perform lexical search
      const lexicalResults = await this.performLexicalSearch(query, options);
      
      // Step 4: Combine and score results
      const combinedResults = this.combineResults(
        semanticResults,
        lexicalResults,
        semanticWeight,
        lexicalWeight
      );

      // Step 5: Apply brand context scoring
      const brandContextResults = this.applyBrandContext(combinedResults, brandContext);

      // Step 6: Rerank if requested
      const finalResults = reranking 
        ? await this.rerankResults(brandContextResults, query, options)
        : brandContextResults;

      // Step 7: Apply final filters and limit
      return this.applyFinalFilters(finalResults, options).slice(0, limit);

    } catch (error) {
      logger.error('Hybrid search failed:', error);
      throw error;
    }
  }

  private async performSemanticSearch(
    query: string, 
    options: HybridSearchOptions
  ): Promise<Array<{ content: ContentPiece; score: number }>> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateTextEmbedding(query);
      
      // Build filters
      const filters = this.buildFilters(options);
      
      // Perform vector search
      const vectorOptions: VectorSearchOptions = {
        vector: queryEmbedding,
        limit: Math.min((options.limit || 10) * 3, 50), // Get more candidates
        filter: filters
      };

      const results = await this.astraDB.vectorSearchContent(vectorOptions);
      
      // Calculate semantic scores based on cosine similarity
      return results.map((content, index) => ({
        content,
        score: (results.length - index) / results.length // Normalize score 0-1
      }));

    } catch (error) {
      logger.error('Semantic search failed:', error);
      throw error;
    }
  }

  private async performLexicalSearch(
    query: string,
    options: HybridSearchOptions
  ): Promise<Array<{ content: ContentPiece; score: number }>> {
    try {
      const filters = this.buildFilters(options);
      
      // Build text search filters
      const textFilters = {
        ...filters,
        $or: [
          { hook_title: { $regex: query, $options: 'i' } },
          { caption: { $regex: query, $options: 'i' } },
          { script: { $regex: query, $options: 'i' } },
          { hashtags: { $elemMatch: { $regex: query, $options: 'i' } } },
          { tags: { $elemMatch: { $regex: query, $options: 'i' } } }
        ]
      };

      const searchOptions: SearchOptions = {
        filter: textFilters,
        limit: Math.min((options.limit || 10) * 3, 50),
        sort: { created_at: -1 }
      };

      const results = await this.astraDB.searchContent(searchOptions);
      
      // Calculate lexical scores based on text match relevance
      return results.map((content, index) => ({
        content,
        score: this.calculateLexicalScore(content, query) * ((results.length - index) / results.length)
      }));

    } catch (error) {
      logger.error('Lexical search failed:', error);
      throw error;
    }
  }

  private calculateLexicalScore(content: ContentPiece, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;
    let totalFields = 0;

    // Check title match (highest weight)
    if (content.hook_title && content.hook_title.toLowerCase().includes(queryLower)) {
      score += 0.4;
    }
    totalFields += 0.4;

    // Check caption match
    if (content.caption && content.caption.toLowerCase().includes(queryLower)) {
      score += 0.3;
    }
    totalFields += 0.3;

    // Check hashtags match
    if (content.hashtags && content.hashtags.some(tag => tag.toLowerCase().includes(queryLower))) {
      score += 0.2;
    }
    totalFields += 0.2;

    // Check script match
    if (content.script && content.script.toLowerCase().includes(queryLower)) {
      score += 0.1;
    }
    totalFields += 0.1;

    return totalFields > 0 ? score / totalFields : 0;
  }

  private combineResults(
    semanticResults: Array<{ content: ContentPiece; score: number }>,
    lexicalResults: Array<{ content: ContentPiece; score: number }>,
    semanticWeight: number,
    lexicalWeight: number
  ): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    // Add semantic results
    semanticResults.forEach(({ content, score }) => {
      resultMap.set(content.id, {
        content,
        score: score * semanticWeight,
        rankingFactors: {
          semanticScore: score
        }
      });
    });

    // Add lexical results and combine scores
    lexicalResults.forEach(({ content, score }) => {
      const existing = resultMap.get(content.id);
      
      if (existing) {
        existing.score += score * lexicalWeight;
        existing.rankingFactors.lexicalScore = score;
      } else {
        resultMap.set(content.id, {
          content,
          score: score * lexicalWeight,
          rankingFactors: {
            lexicalScore: score
          }
        });
      }
    });

    return Array.from(resultMap.values());
  }

  private async getBrandContext(query: string): Promise<BrandContextResult[]> {
    try {
      const brandKnowledge = await this.astraDB.searchBrandKnowledge(query);
      
      return brandKnowledge.map(knowledge => ({
        knowledge,
        relevanceScore: 0.8 // Default relevance, could be improved with embedding similarity
      }));

    } catch (error) {
      logger.error('Failed to get brand context:', error);
      return [];
    }
  }

  private applyBrandContext(
    results: SearchResult[],
    brandContext: BrandContextResult[]
  ): SearchResult[] {
    if (brandContext.length === 0) return results;

    return results.map(result => {
      // Calculate brand relevance based on content matching brand guidelines
      const brandRelevance = this.calculateBrandRelevance(result.content, brandContext);
      
      // Boost score based on brand relevance
      const brandBoost = brandRelevance * 0.1; // 10% max boost
      
      return {
        ...result,
        score: result.score + brandBoost,
        rankingFactors: {
          ...result.rankingFactors,
          brandRelevance
        }
      };
    });
  }

  private calculateBrandRelevance(
    content: ContentPiece,
    brandContext: BrandContextResult[]
  ): number {
    let relevance = 0;
    let factors = 0;

    brandContext.forEach(({ knowledge, relevanceScore }) => {
      // Check theme alignment
      if (knowledge.category === 'CONTENT_THEMES' && 
          knowledge.scalar_field_references.some(ref => 
            content.caption.toLowerCase().includes(ref.toLowerCase()) ||
            content.script.toLowerCase().includes(ref.toLowerCase())
          )) {
        relevance += relevanceScore * 0.3;
        factors += 0.3;
      }

      // Check compliance alignment
      if (knowledge.category === 'COMPLIANCE_RULES' &&
          knowledge.compliance_requirements.every(req =>
            this.checkComplianceAlignment(content, req)
          )) {
        relevance += relevanceScore * 0.4;
        factors += 0.4;
      }

      // Check visual guidelines alignment
      if (knowledge.category === 'VISUAL_GUIDELINES' &&
          content.visual_guidelines &&
          this.checkVisualAlignment(content, knowledge)) {
        relevance += relevanceScore * 0.3;
        factors += 0.3;
      }
    });

    return factors > 0 ? relevance / factors : 0;
  }

  private checkComplianceAlignment(content: ContentPiece, requirement: string): boolean {
    // Simple compliance check - in production, this would be more sophisticated
    const complianceKeywords = requirement.toLowerCase().split(' ');
    const contentText = `${content.caption} ${content.script}`.toLowerCase();
    
    return complianceKeywords.some(keyword => contentText.includes(keyword));
  }

  private checkVisualAlignment(content: ContentPiece, knowledge: BrandKnowledge): boolean {
    if (!content.visual_guidelines) return false;
    
    // Check if visual guidelines match brand requirements
    const brandColors = knowledge.color_palette || {};
    const contentColors = content.brand_colors;
    
    return contentColors.primary === brandColors.primary ||
           contentColors.primary === '#43FAFF'; // Default brand color
  }

  private async rerankResults(
    results: SearchResult[],
    query: string,
    options: HybridSearchOptions
  ): Promise<SearchResult[]> {
    try {
      // Apply additional ranking factors
      const rerankedResults = results.map(result => {
        let adjustedScore = result.score;
        
        // Freshness factor
        const freshnessScore = this.calculateFreshnessScore(result.content);
        adjustedScore += freshnessScore * 0.1;
        result.rankingFactors.freshness = freshnessScore;
        
        // Engagement factor
        const engagementScore = this.calculateEngagementScore(result.content);
        adjustedScore += engagementScore * 0.15;
        result.rankingFactors.engagement = engagementScore;
        
        // Theme relevance for scalar field content
        const themeScore = this.calculateThemeRelevance(result.content, query);
        adjustedScore += themeScore * 0.1;
        
        return {
          ...result,
          score: adjustedScore,
          explanation: this.generateExplanation(result)
        };
      });

      // Sort by final score
      return rerankedResults.sort((a, b) => b.score - a.score);

    } catch (error) {
      logger.error('Reranking failed:', error);
      return results;
    }
  }

  private calculateFreshnessScore(content: ContentPiece): number {
    const now = new Date().getTime();
    const contentDate = new Date(content.created_at).getTime();
    const daysSinceCreation = (now - contentDate) / (1000 * 60 * 60 * 24);
    
    // Fresher content gets higher score (decay over 30 days)
    return Math.max(0, 1 - (daysSinceCreation / 30));
  }

  private calculateEngagementScore(content: ContentPiece): number {
    if (!content.engagement_metrics) return 0;
    
    const metrics = content.engagement_metrics;
    const totalEngagement = metrics.likes + metrics.comments + metrics.shares + metrics.saves;
    const views = metrics.views || 1;
    
    // Normalize engagement rate (0-1)
    const engagementRate = Math.min(totalEngagement / views, 1);
    
    return engagementRate;
  }

  private calculateThemeRelevance(content: ContentPiece, query: string): number {
    const scalarTerms = [
      'scalar', 'field', 'energy', 'wellness', 'coherence', 'clarity',
      'noise', 'mud', 'wash', 'clear', 'EE', 'biofield'
    ];
    
    const queryLower = query.toLowerCase();
    const contentText = `${content.caption} ${content.script} ${content.hook_title}`.toLowerCase();
    
    const matchedTerms = scalarTerms.filter(term => 
      queryLower.includes(term) && contentText.includes(term)
    );
    
    return matchedTerms.length / scalarTerms.length;
  }

  private generateExplanation(result: SearchResult): string {
    const factors = result.rankingFactors;
    const explanations: string[] = [];
    
    if (factors.semanticScore && factors.semanticScore > 0.7) {
      explanations.push('High semantic relevance');
    }
    
    if (factors.lexicalScore && factors.lexicalScore > 0.5) {
      explanations.push('Strong keyword match');
    }
    
    if (factors.brandRelevance && factors.brandRelevance > 0.6) {
      explanations.push('Aligned with brand guidelines');
    }
    
    if (factors.freshness && factors.freshness > 0.8) {
      explanations.push('Recent content');
    }
    
    if (factors.engagement && factors.engagement > 0.1) {
      explanations.push('High engagement history');
    }
    
    return explanations.join(', ') || 'Standard relevance match';
  }

  private buildFilters(options: HybridSearchOptions): Record<string, any> {
    const filters: Record<string, any> = { ...options.filters };
    
    if (options.contentTypes && options.contentTypes.length > 0) {
      filters.content_type = { $in: options.contentTypes };
    }
    
    if (options.themes && options.themes.length > 0) {
      filters.theme = { $in: options.themes };
    }
    
    if (options.platforms && options.platforms.length > 0) {
      filters.platform = { $elemMatch: { $in: options.platforms } };
    }
    
    return filters;
  }

  private applyFinalFilters(results: SearchResult[], options: HybridSearchOptions): SearchResult[] {
    let filtered = results;
    
    // Apply any additional business logic filters here
    // For example, filter out content that doesn't meet compliance requirements
    
    return filtered;
  }

  // Utility method for content recommendations
  async getRecommendations(
    contentId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    try {
      const baseContent = await this.astraDB.getContentById(contentId);
      if (!baseContent) {
        throw new Error(`Content ${contentId} not found`);
      }

      // Use content attributes to build a recommendation query
      const query = `${baseContent.theme} ${baseContent.content_type} ${baseContent.hashtags.join(' ')}`;
      
      const options: HybridSearchOptions = {
        query,
        limit: limit + 1, // +1 to account for the base content itself
        semanticWeight: 0.8,
        lexicalWeight: 0.2,
        themes: [baseContent.theme],
        contentTypes: [baseContent.content_type]
      };
      
      const results = await this.search(options);
      
      // Filter out the original content
      return results.filter(result => result.content.id !== contentId);

    } catch (error) {
      logger.error(`Failed to get recommendations for content ${contentId}:`, error);
      throw error;
    }
  }
}

export default HybridSearchEngine;