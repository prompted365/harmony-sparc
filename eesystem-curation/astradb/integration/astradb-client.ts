/**
 * AstraDB Client for EESystem Content Curation Platform
 * Handles all database operations with vector search capabilities
 */

import { DataAPIClient } from '@datastax/astra-db-ts';
import { ContentPiece, ContentAnalytics, BrandKnowledge, COLLECTIONS } from '../schemas/content-schema';
import { EmbeddingService } from './embedding-service';
import { logger } from '../utils/logger';

export interface AstraDBConfig {
  token: string;
  apiEndpoint: string;
  namespace?: string;
  collection?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
  includeEmbeddings?: boolean;
}

export interface VectorSearchOptions extends SearchOptions {
  vector: number[];
  metric?: 'cosine' | 'dot_product' | 'euclidean';
  threshold?: number;
}

export class AstraDBClient {
  private client: DataAPIClient;
  private db: any;
  private embeddingService: EmbeddingService;
  private config: AstraDBConfig;
  private collections: Map<string, any> = new Map();

  constructor(config: AstraDBConfig) {
    this.config = config;
    this.client = new DataAPIClient(config.token);
    this.embeddingService = new EmbeddingService();
    this.initialize();
  }

  private async initialize() {
    try {
      this.db = this.client.db(this.config.apiEndpoint, {
        namespace: this.config.namespace
      });
      
      await this.ensureCollections();
      logger.info('AstraDB client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AstraDB client:', error);
      throw error;
    }
  }

  private async ensureCollections() {
    const collectionConfigs = [
      {
        name: COLLECTIONS.CONTENT_PIECES,
        options: {
          vector: {
            dimension: 1536,
            metric: 'cosine'
          }
        }
      },
      {
        name: COLLECTIONS.CONTENT_ANALYTICS,
        options: {}
      },
      {
        name: COLLECTIONS.BRAND_KNOWLEDGE,
        options: {
          vector: {
            dimension: 1536,
            metric: 'cosine'
          }
        }
      },
      {
        name: COLLECTIONS.CONTENT_RECOMMENDATIONS,
        options: {}
      },
      {
        name: COLLECTIONS.CONTENT_PREDICTIONS,
        options: {}
      }
    ];

    for (const config of collectionConfigs) {
      try {
        const collection = await this.db.collection(config.name);
        this.collections.set(config.name, collection);
        logger.info(`Collection ${config.name} ready`);
      } catch (error) {
        logger.error(`Failed to initialize collection ${config.name}:`, error);
        throw error;
      }
    }
  }

  // Content Operations
  async createContent(content: Omit<ContentPiece, 'id' | 'created_at' | 'updated_at'>): Promise<ContentPiece> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_PIECES);
      
      // Generate embeddings for the content
      const embeddings = await this.embeddingService.generateContentEmbeddings(content);
      
      const contentPiece: ContentPiece = {
        ...content,
        id: crypto.randomUUID(),
        embeddings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await collection.insertOne(contentPiece);
      logger.info(`Content piece created: ${contentPiece.id}`);
      
      return contentPiece;
    } catch (error) {
      logger.error('Failed to create content:', error);
      throw error;
    }
  }

  async updateContent(id: string, updates: Partial<ContentPiece>): Promise<ContentPiece> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_PIECES);
      
      // Regenerate embeddings if content changed
      if (updates.script || updates.caption || updates.media_prompt) {
        const existingContent = await this.getContentById(id);
        if (existingContent) {
          const updatedContent = { ...existingContent, ...updates };
          updates.embeddings = await this.embeddingService.generateContentEmbeddings(updatedContent);
        }
      }
      
      const updateDoc = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      await collection.updateOne(
        { id },
        { $set: updateDoc }
      );

      const updatedContent = await this.getContentById(id);
      logger.info(`Content piece updated: ${id}`);
      
      return updatedContent!;
    } catch (error) {
      logger.error(`Failed to update content ${id}:`, error);
      throw error;
    }
  }

  async getContentById(id: string): Promise<ContentPiece | null> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_PIECES);
      const result = await collection.findOne({ id });
      return result;
    } catch (error) {
      logger.error(`Failed to get content ${id}:`, error);
      throw error;
    }
  }

  async searchContent(options: SearchOptions): Promise<ContentPiece[]> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_PIECES);
      
      let query = collection.find(options.filter || {});
      
      if (options.sort) {
        query = query.sort(options.sort);
      }
      
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.skip(options.offset);
      }

      const results = await query.toArray();
      return results;
    } catch (error) {
      logger.error('Failed to search content:', error);
      throw error;
    }
  }

  // Vector Search Operations
  async vectorSearchContent(options: VectorSearchOptions): Promise<ContentPiece[]> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_PIECES);
      
      const searchOptions: any = {
        vector: options.vector,
        limit: options.limit || 10
      };

      if (options.filter) {
        searchOptions.filter = options.filter;
      }

      const results = await collection.find(null, searchOptions);
      return results.toArray();
    } catch (error) {
      logger.error('Failed to perform vector search:', error);
      throw error;
    }
  }

  async semanticSearch(query: string, options: Omit<VectorSearchOptions, 'vector'>): Promise<ContentPiece[]> {
    try {
      const queryEmbedding = await this.embeddingService.generateTextEmbedding(query);
      
      return this.vectorSearchContent({
        ...options,
        vector: queryEmbedding
      });
    } catch (error) {
      logger.error('Failed to perform semantic search:', error);
      throw error;
    }
  }

  // Hybrid Search (Semantic + Lexical)
  async hybridSearch(query: string, options: SearchOptions & { semanticWeight?: number }): Promise<ContentPiece[]> {
    try {
      const semanticWeight = options.semanticWeight || 0.7;
      const lexicalWeight = 1 - semanticWeight;
      
      // Perform semantic search
      const semanticResults = await this.semanticSearch(query, options);
      
      // Perform lexical search
      const lexicalFilter = {
        ...options.filter,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { caption: { $regex: query, $options: 'i' } },
          { script: { $regex: query, $options: 'i' } },
          { hashtags: { $in: [query] } }
        ]
      };
      
      const lexicalResults = await this.searchContent({
        ...options,
        filter: lexicalFilter
      });
      
      // Combine and rerank results
      const combinedResults = this.combineAndRerankResults(
        semanticResults,
        lexicalResults,
        semanticWeight,
        lexicalWeight
      );
      
      return combinedResults.slice(0, options.limit || 10);
    } catch (error) {
      logger.error('Failed to perform hybrid search:', error);
      throw error;
    }
  }

  private combineAndRerankResults(
    semanticResults: ContentPiece[],
    lexicalResults: ContentPiece[],
    semanticWeight: number,
    lexicalWeight: number
  ): ContentPiece[] {
    const resultMap = new Map<string, { content: ContentPiece; score: number }>();
    
    // Add semantic results with their scores
    semanticResults.forEach((content, index) => {
      const score = (semanticResults.length - index) / semanticResults.length * semanticWeight;
      resultMap.set(content.id, { content, score });
    });
    
    // Add lexical results with their scores
    lexicalResults.forEach((content, index) => {
      const score = (lexicalResults.length - index) / lexicalResults.length * lexicalWeight;
      const existing = resultMap.get(content.id);
      
      if (existing) {
        existing.score += score;
      } else {
        resultMap.set(content.id, { content, score });
      }
    });
    
    // Sort by combined score and return
    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => item.content);
  }

  // Brand Knowledge Operations
  async createBrandKnowledge(knowledge: Omit<BrandKnowledge, 'id' | 'created_at' | 'updated_at'>): Promise<BrandKnowledge> {
    try {
      const collection = this.collections.get(COLLECTIONS.BRAND_KNOWLEDGE);
      
      const embeddings = await this.embeddingService.generateTextEmbedding(knowledge.content);
      
      const brandKnowledge: BrandKnowledge = {
        ...knowledge,
        id: crypto.randomUUID(),
        embeddings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await collection.insertOne(brandKnowledge);
      logger.info(`Brand knowledge created: ${brandKnowledge.id}`);
      
      return brandKnowledge;
    } catch (error) {
      logger.error('Failed to create brand knowledge:', error);
      throw error;
    }
  }

  async searchBrandKnowledge(query: string, category?: string): Promise<BrandKnowledge[]> {
    try {
      const queryEmbedding = await this.embeddingService.generateTextEmbedding(query);
      const collection = this.collections.get(COLLECTIONS.BRAND_KNOWLEDGE);
      
      const filter = category ? { category } : {};
      const searchOptions = {
        vector: queryEmbedding,
        limit: 5,
        filter
      };

      const results = await collection.find(null, searchOptions);
      return results.toArray();
    } catch (error) {
      logger.error('Failed to search brand knowledge:', error);
      throw error;
    }
  }

  // Analytics Operations
  async storeContentAnalytics(analytics: ContentAnalytics): Promise<void> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_ANALYTICS);
      await collection.insertOne(analytics);
      logger.info(`Analytics stored for content: ${analytics.content_id}`);
    } catch (error) {
      logger.error('Failed to store analytics:', error);
      throw error;
    }
  }

  async getContentAnalytics(contentId: string, platform?: string): Promise<ContentAnalytics[]> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_ANALYTICS);
      const filter: any = { content_id: contentId };
      
      if (platform) {
        filter.platform = platform;
      }
      
      const results = await collection.find(filter).toArray();
      return results;
    } catch (error) {
      logger.error(`Failed to get analytics for content ${contentId}:`, error);
      throw error;
    }
  }

  // Batch Operations
  async batchInsertContent(contents: Omit<ContentPiece, 'id' | 'created_at' | 'updated_at'>[]): Promise<ContentPiece[]> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_PIECES);
      
      const processedContents = await Promise.all(
        contents.map(async (content) => {
          const embeddings = await this.embeddingService.generateContentEmbeddings(content);
          return {
            ...content,
            id: crypto.randomUUID(),
            embeddings,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        })
      );

      await collection.insertMany(processedContents);
      logger.info(`Batch inserted ${processedContents.length} content pieces`);
      
      return processedContents;
    } catch (error) {
      logger.error('Failed to batch insert content:', error);
      throw error;
    }
  }

  // Utility Methods
  async getCollectionStats(collectionName: string): Promise<any> {
    try {
      const collection = this.collections.get(collectionName);
      const stats = await collection.countDocuments();
      return { count: stats };
    } catch (error) {
      logger.error(`Failed to get stats for collection ${collectionName}:`, error);
      throw error;
    }
  }

  async deleteContent(id: string): Promise<boolean> {
    try {
      const collection = this.collections.get(COLLECTIONS.CONTENT_PIECES);
      const result = await collection.deleteOne({ id });
      logger.info(`Content piece deleted: ${id}`);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Failed to delete content ${id}:`, error);
      throw error;
    }
  }
}

export default AstraDBClient;