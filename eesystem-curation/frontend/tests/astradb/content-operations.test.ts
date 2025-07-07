// Content Operations Tests
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import ContentOperations from '../../src/lib/astradb/content-operations'
import { AstraDBClient } from '../../src/lib/astradb/client'
import { 
  ContentDocument, 
  UserDocument, 
  BrandDocument,
  AgentDocument 
} from '../../src/types/astradb'
import { createTestClient, createTestDocument, createTestUser, createTestBrand } from './client.test'

describe('ContentOperations', () => {
  let contentOps: ContentOperations
  let mockClient: AstraDBClient

  beforeEach(() => {
    mockClient = createTestClient()
    contentOps = new ContentOperations(mockClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Content CRUD Operations', () => {
    const testContent = createTestDocument({
      title: 'Test Article',
      type: 'article',
      content: 'This is a test article content',
      brandId: 'test-brand-id',
      status: 'draft',
      generatedBy: 'test-user-id',
      metadata: {
        wordCount: 100,
        readingTime: 1,
        seoScore: 85,
        keywords: ['test', 'article'],
        targetAudience: ['developers'],
        tone: 'professional',
        style: 'informative'
      },
      tags: ['test', 'development']
    })

    it('should create content successfully', async () => {
      const result = await contentOps.createContent(testContent)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?._id).toBeDefined()
      expect(result.data?.title).toBe(testContent.title)
      expect(result.data?.createdAt).toBeInstanceOf(Date)
      expect(result.data?.version).toBe(1)
    })

    it('should get content by ID', async () => {
      const content = await contentOps.getContent('test-content-id')
      
      expect(content).toBeDefined()
      expect(content?._id).toBe('1')
    })

    it('should get content by brand', async () => {
      const contents = await contentOps.getContentByBrand('test-brand-id', {
        status: 'published',
        type: 'article',
        limit: 10,
        offset: 0
      })
      
      expect(Array.isArray(contents)).toBe(true)
    })

    it('should update content', async () => {
      const updates: Partial<ContentDocument> = {
        title: 'Updated Title',
        status: 'published',
        publishedAt: new Date()
      }
      
      const result = await contentOps.updateContent('test-content-id', updates)
      
      expect(result.success).toBe(true)
      expect(result.data?.title).toBe('Updated')
    })

    it('should delete content', async () => {
      const result = await contentOps.deleteContent('test-content-id')
      
      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(1)
    })

    it('should publish content', async () => {
      const result = await contentOps.publishContent('test-content-id')
      
      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('published')
    })

    it('should schedule content', async () => {
      const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      const result = await contentOps.publishContent('test-content-id', scheduledDate)
      
      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('scheduled')
    })

    it('should archive content', async () => {
      const result = await contentOps.archiveContent('test-content-id')
      
      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('archived')
    })
  })

  describe('Vector Search Operations', () => {
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())

    it('should search content by similarity', async () => {
      const result = await contentOps.searchContentBySimilarity(
        'test query',
        mockEmbedding,
        {
          brandId: 'test-brand-id',
          type: 'article',
          limit: 5,
          threshold: 0.7
        }
      )
      
      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('took')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should search content by keywords', async () => {
      const keywords = ['javascript', 'react', 'development']
      const results = await contentOps.searchContentByKeywords(keywords, {
        brandId: 'test-brand-id',
        type: 'article',
        limit: 10
      })
      
      expect(Array.isArray(results)).toBe(true)
    })

    it('should get related content', async () => {
      const relatedContent = await contentOps.getRelatedContent('test-content-id', 5)
      
      expect(Array.isArray(relatedContent)).toBe(true)
      expect(relatedContent.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Content Analytics', () => {
    it('should get content performance', async () => {
      const performance = await contentOps.getContentPerformance('test-content-id')
      
      expect(performance).toHaveProperty('views')
      expect(performance).toHaveProperty('engagement')
      expect(performance).toHaveProperty('shares')
      expect(performance).toHaveProperty('clicks')
      expect(performance).toHaveProperty('conversions')
      expect(performance).toHaveProperty('events')
    })

    it('should get content metrics', async () => {
      const metrics = await contentOps.getContentMetrics('test-brand-id', '30d')
      
      expect(metrics).toHaveProperty('byType')
      expect(metrics).toHaveProperty('byStatus')
      expect(metrics).toHaveProperty('totalContent')
      expect(Array.isArray(metrics.byType)).toBe(true)
      expect(Array.isArray(metrics.byStatus)).toBe(true)
    })
  })

  describe('User Operations', () => {
    const testUser = createTestUser({
      name: 'Test User',
      email: 'test@example.com',
      role: 'editor',
      settings: {
        apiQuota: 1000,
        maxConcurrentGenerations: 5,
        preferredAgents: ['writer', 'seo'],
        qualityThreshold: 0.8,
        autoApprove: false,
        dataRetentionDays: 365
      }
    })

    it('should create user', async () => {
      const result = await contentOps.createUser(testUser)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.email).toBe(testUser.email)
      expect(result.data?.loginCount).toBe(0)
    })

    it('should get user by ID', async () => {
      const user = await contentOps.getUser('test-user-id')
      
      expect(user).toBeDefined()
    })

    it('should get user by email', async () => {
      const user = await contentOps.getUserByEmail('test@example.com')
      
      expect(user).toBeDefined()
    })

    it('should update user', async () => {
      const updates = {
        name: 'Updated Name',
        preferences: {
          ...testUser.preferences,
          theme: 'dark'
        }
      }
      
      const result = await contentOps.updateUser('test-user-id', updates)
      
      expect(result.success).toBe(true)
    })

    it('should update user last login', async () => {
      const result = await contentOps.updateUserLastLogin('test-user-id')
      
      expect(result.success).toBe(true)
    })
  })

  describe('Brand Operations', () => {
    const testBrand = createTestBrand({
      name: 'Test Brand',
      color: '#007bff',
      ownerId: 'test-user-id',
      collaborators: ['user1', 'user2']
    })

    it('should create brand', async () => {
      const result = await contentOps.createBrand(testBrand)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.name).toBe(testBrand.name)
      expect(result.data?.contentCount).toBe(0)
    })

    it('should get brand by ID', async () => {
      const brand = await contentOps.getBrand('test-brand-id')
      
      expect(brand).toBeDefined()
    })

    it('should get user brands', async () => {
      const brands = await contentOps.getUserBrands('test-user-id')
      
      expect(Array.isArray(brands)).toBe(true)
    })

    it('should update brand', async () => {
      const updates = {
        name: 'Updated Brand Name',
        color: '#28a745'
      }
      
      const result = await contentOps.updateBrand('test-brand-id', updates)
      
      expect(result.success).toBe(true)
    })

    it('should delete brand', async () => {
      const result = await contentOps.deleteBrand('test-brand-id')
      
      expect(result.success).toBe(true)
    })
  })

  describe('Agent Operations', () => {
    const testAgent: Omit<AgentDocument, '_id' | 'createdAt' | 'updatedAt' | 'totalTasks'> = {
      name: 'Test Writer Agent',
      type: 'content-writer',
      status: 'idle',
      capabilities: ['article-writing', 'blog-posts', 'social-media'],
      performance: {
        tasksCompleted: 0,
        averageQuality: 0,
        averageSpeed: 0,
        successRate: 0,
        lastActivity: new Date(),
        averageResponseTime: 0,
        errorRate: 0
      },
      config: {
        maxConcurrentTasks: 3,
        preferredContentTypes: ['article', 'blog-post'],
        qualityThreshold: 0.8,
        autoApprove: false,
        modelProvider: 'openai',
        modelName: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000
      }
    }

    it('should create agent', async () => {
      const result = await contentOps.createAgent(testAgent)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.name).toBe(testAgent.name)
      expect(result.data?.totalTasks).toBe(0)
    })

    it('should get agent by ID', async () => {
      const agent = await contentOps.getAgent('test-agent-id')
      
      expect(agent).toBeDefined()
    })

    it('should get all agents', async () => {
      const agents = await contentOps.getAllAgents()
      
      expect(Array.isArray(agents)).toBe(true)
    })

    it('should update agent', async () => {
      const updates = {
        status: 'working',
        currentTask: 'Writing article about AI'
      }
      
      const result = await contentOps.updateAgent('test-agent-id', updates)
      
      expect(result.success).toBe(true)
    })

    it('should update agent performance', async () => {
      await contentOps.updateAgentPerformance('test-agent-id', true, 0.9, 120)
      
      // This is a void function, so we just ensure it doesn't throw
      expect(true).toBe(true)
    })
  })

  describe('Analytics Operations', () => {
    it('should get analytics data', async () => {
      const analytics = await contentOps.getAnalytics('test-brand-id', '7d', 'content_viewed')
      
      expect(Array.isArray(analytics)).toBe(true)
    })
  })

  describe('Batch Operations', () => {
    it('should batch update content', async () => {
      const updates = [
        { id: 'content1', updates: { status: 'published' } },
        { id: 'content2', updates: { status: 'archived' } }
      ]
      
      await contentOps.batchUpdateContent(updates)
      
      // Batch operation is void, so we just ensure it doesn't throw
      expect(true).toBe(true)
    })

    it('should batch delete content', async () => {
      const ids = ['content1', 'content2', 'content3']
      
      await contentOps.batchDeleteContent(ids)
      
      // Batch operation is void, so we just ensure it doesn't throw
      expect(true).toBe(true)
    })
  })

  describe('Cleanup Operations', () => {
    it('should cleanup old content', async () => {
      const deletedCount = await contentOps.cleanupOldContent(365)
      
      expect(typeof deletedCount).toBe('number')
      expect(deletedCount).toBeGreaterThanOrEqual(0)
    })

    it('should cleanup old analytics', async () => {
      const deletedCount = await contentOps.cleanupOldAnalytics(90)
      
      expect(typeof deletedCount).toBe('number')
      expect(deletedCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing content gracefully', async () => {
      const content = await contentOps.getContent('non-existent-id')
      
      expect(content).toBeNull()
    })

    it('should handle empty search results', async () => {
      const results = await contentOps.searchContentByKeywords(['nonexistent'])
      
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle invalid vector dimensions', async () => {
      const invalidEmbedding = [0.1, 0.2] // Too short
      
      // Should not throw, but might return empty results
      const result = await contentOps.searchContentBySimilarity(
        'test',
        invalidEmbedding
      )
      
      expect(result).toHaveProperty('results')
    })
  })
})

// Performance test helpers
export const performanceTestHelper = {
  async measureOperation<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now()
    const result = await operation()
    const duration = Date.now() - start
    
    return { result, duration }
  },

  async testBulkOperations(contentOps: ContentOperations, count: number = 100) {
    const documents = Array.from({ length: count }, (_, i) => 
      createTestDocument({ title: `Bulk Test ${i}` })
    )

    const { duration: insertDuration } = await this.measureOperation(async () => {
      const promises = documents.map(doc => contentOps.createContent(doc))
      return Promise.all(promises)
    })

    const { duration: readDuration } = await this.measureOperation(async () => {
      return contentOps.getContentByBrand('test-brand-id', { limit: count })
    })

    return {
      insertDuration,
      readDuration,
      documentsCount: count,
      insertThroughput: count / (insertDuration / 1000),
      readThroughput: count / (readDuration / 1000)
    }
  }
}

// Load test data generator
export const generateTestData = {
  content: (count: number) => Array.from({ length: count }, (_, i) => 
    createTestDocument({
      title: `Test Content ${i}`,
      type: ['article', 'blog-post', 'social-post'][i % 3],
      status: ['draft', 'published', 'archived'][i % 3]
    })
  ),

  users: (count: number) => Array.from({ length: count }, (_, i) => 
    createTestUser({
      name: `Test User ${i}`,
      email: `user${i}@example.com`,
      role: ['admin', 'editor', 'viewer'][i % 3]
    })
  ),

  brands: (count: number) => Array.from({ length: count }, (_, i) => 
    createTestBrand({
      name: `Test Brand ${i}`,
      ownerId: `user-${i}`
    })
  )
}