/**
 * Embedding Service for EESystem Content Curation
 * Handles automatic embedding generation for content pieces
 */

import OpenAI from 'openai';
import { ContentPiece } from '../schemas/content-schema';
import { logger } from '../utils/logger';

export interface EmbeddingConfig {
  openaiApiKey: string;
  openaiModel?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface ContentEmbeddings {
  content_embedding: number[];
  visual_embedding?: number[];
  theme_embedding?: number[];
}

export class EmbeddingService {
  private openai: OpenAI;
  private config: EmbeddingConfig;

  constructor(config?: EmbeddingConfig) {
    this.config = config || {
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      openaiModel: 'text-embedding-ada-002',
      maxRetries: 3,
      timeout: 30000
    };

    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });
  }

  async generateContentEmbeddings(content: Partial<ContentPiece>): Promise<ContentEmbeddings> {
    try {
      // Combine all text content for embedding
      const textContent = this.combineTextContent(content);
      
      // Generate main content embedding
      const contentEmbedding = await this.generateTextEmbedding(textContent);
      
      // Generate theme-specific embedding if theme is provided
      let themeEmbedding: number[] | undefined;
      if (content.theme) {
        const themeText = this.generateThemeContext(content.theme);
        themeEmbedding = await this.generateTextEmbedding(themeText);
      }
      
      // Generate visual embedding from media prompt if available
      let visualEmbedding: number[] | undefined;
      if (content.media_prompt) {
        visualEmbedding = await this.generateVisualEmbedding(content.media_prompt);
      }

      return {
        content_embedding: contentEmbedding,
        visual_embedding: visualEmbedding,
        theme_embedding: themeEmbedding
      };
    } catch (error) {
      logger.error('Failed to generate content embeddings:', error);
      throw error;
    }
  }

  async generateTextEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.openaiModel!,
        input: text,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate text embedding:', error);
      throw error;
    }
  }

  async generateVisualEmbedding(visualPrompt: string): Promise<number[]> {
    try {
      // For now, use text embedding for visual prompts
      // In production, this could be replaced with CLIP embeddings
      return this.generateTextEmbedding(visualPrompt);
    } catch (error) {
      logger.error('Failed to generate visual embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.openaiModel!,
        input: texts,
        encoding_format: 'float'
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Failed to generate batch embeddings:', error);
      throw error;
    }
  }

  private combineTextContent(content: Partial<ContentPiece>): string {
    const textParts: string[] = [];
    
    if (content.hook_title) textParts.push(content.hook_title);
    if (content.caption) textParts.push(content.caption);
    if (content.script) textParts.push(content.script);
    if (content.cta) textParts.push(content.cta);
    if (content.hashtags) textParts.push(content.hashtags.join(' '));
    if (content.media_prompt) textParts.push(content.media_prompt);
    
    // Add theme context
    if (content.theme) {
      textParts.push(this.generateThemeContext(content.theme));
    }
    
    // Add brand context
    if (content.visual_guidelines) {
      textParts.push(
        `Visual style: ${content.visual_guidelines.aesthetic} ${content.visual_guidelines.lighting} ${content.visual_guidelines.tone}`
      );
    }

    return textParts.join(' ');
  }

  private generateThemeContext(theme: string): string {
    const themeContexts: Record<string, string> = {
      'CLEAR_THE_NOISE': 'clearing noise, reducing clutter, simplifying life, removing distractions, scalar field energy, wellness optimization, body coherence',
      'WASH_THE_MUD': 'washing away negativity, cleansing energy, purification, transformation, clarity, removing obstacles, scalar field healing',
      'SCALAR_WELLNESS': 'scalar field technology, energy wellness, holistic health, frequency healing, biofield optimization, energy medicine',
      'FIELD_EFFECT': 'energy field effects, scalar waves, biofield interactions, electromagnetic wellness, frequency therapy',
      'EE_COHERENCE': 'energy enhancement, coherence therapy, wellness technology, scalar field benefits, health optimization',
      'BODY_ENERGY_COHERENCE': 'body energy alignment, coherence healing, wellness integration, scalar field body effects, energy medicine',
      'WEEKLY_RECAP': 'weekly summary, progress tracking, wellness journey, scalar field updates, content highlights'
    };

    return themeContexts[theme] || theme;
  }

  // Semantic similarity calculation
  async calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    try {
      if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same dimension');
      }

      return this.cosineSimilarity(embedding1, embedding2);
    } catch (error) {
      logger.error('Failed to calculate similarity:', error);
      throw error;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Content clustering for theme detection
  async clusterContent(embeddings: number[][], numClusters: number = 5): Promise<number[]> {
    try {
      // Simple k-means clustering implementation
      // In production, consider using a more sophisticated clustering library
      return this.kMeansClustering(embeddings, numClusters);
    } catch (error) {
      logger.error('Failed to cluster content:', error);
      throw error;
    }
  }

  private kMeansClustering(embeddings: number[][], k: number): number[] {
    const n = embeddings.length;
    const dimensions = embeddings[0].length;
    
    // Initialize centroids randomly
    const centroids: number[][] = [];
    for (let i = 0; i < k; i++) {
      centroids.push(embeddings[Math.floor(Math.random() * n)]);
    }
    
    let assignments: number[] = new Array(n).fill(0);
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (changed && iterations < maxIterations) {
      changed = false;
      
      // Assign each point to nearest centroid
      for (let i = 0; i < n; i++) {
        let minDistance = Infinity;
        let closestCentroid = 0;
        
        for (let j = 0; j < k; j++) {
          const distance = this.euclideanDistance(embeddings[i], centroids[j]);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = j;
          }
        }
        
        if (assignments[i] !== closestCentroid) {
          assignments[i] = closestCentroid;
          changed = true;
        }
      }
      
      // Update centroids
      for (let j = 0; j < k; j++) {
        const clusterPoints = embeddings.filter((_, i) => assignments[i] === j);
        if (clusterPoints.length > 0) {
          for (let d = 0; d < dimensions; d++) {
            centroids[j][d] = clusterPoints.reduce((sum, point) => sum + point[d], 0) / clusterPoints.length;
          }
        }
      }
      
      iterations++;
    }
    
    return assignments;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
  }

  // Content recommendation based on embeddings
  async findSimilarContent(
    queryEmbedding: number[],
    candidateEmbeddings: number[][],
    topK: number = 5
  ): Promise<Array<{ index: number; similarity: number }>> {
    try {
      const similarities = await Promise.all(
        candidateEmbeddings.map(async (embedding, index) => ({
          index,
          similarity: await this.calculateSimilarity(queryEmbedding, embedding)
        }))
      );

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      logger.error('Failed to find similar content:', error);
      throw error;
    }
  }

  // Trend detection in embeddings
  async detectTrends(embeddings: number[][], timeWindows: Date[]): Promise<Array<{ trend: string; confidence: number }>> {
    try {
      // Group embeddings by time windows
      const timeGroups = this.groupEmbeddingsByTime(embeddings, timeWindows);
      
      // Calculate centroid for each time window
      const centroids = timeGroups.map(group => this.calculateCentroid(group));
      
      // Detect movement patterns between centroids
      const trends = this.analyzeTrendMovement(centroids);
      
      return trends;
    } catch (error) {
      logger.error('Failed to detect trends:', error);
      throw error;
    }
  }

  private groupEmbeddingsByTime(embeddings: number[][], timeWindows: Date[]): number[][][] {
    // Implementation for grouping embeddings by time windows
    // This is a simplified version - in production, implement proper time-based grouping
    const groups: number[][][] = [];
    const groupSize = Math.ceil(embeddings.length / timeWindows.length);
    
    for (let i = 0; i < timeWindows.length; i++) {
      const start = i * groupSize;
      const end = Math.min(start + groupSize, embeddings.length);
      groups.push(embeddings.slice(start, end));
    }
    
    return groups;
  }

  private calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= embeddings.length;
    }
    
    return centroid;
  }

  private analyzeTrendMovement(centroids: number[][]): Array<{ trend: string; confidence: number }> {
    const trends: Array<{ trend: string; confidence: number }> = [];
    
    for (let i = 1; i < centroids.length; i++) {
      const movement = this.euclideanDistance(centroids[i-1], centroids[i]);
      const direction = this.calculateDirection(centroids[i-1], centroids[i]);
      
      trends.push({
        trend: `Movement ${i}: ${direction}`,
        confidence: Math.min(movement, 1)
      });
    }
    
    return trends;
  }

  private calculateDirection(from: number[], to: number[]): string {
    const diff = to.map((val, i) => val - from[i]);
    const magnitude = Math.sqrt(diff.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude < 0.1) return 'stable';
    if (magnitude > 0.5) return 'significant_shift';
    return 'gradual_change';
  }
}

export default EmbeddingService;