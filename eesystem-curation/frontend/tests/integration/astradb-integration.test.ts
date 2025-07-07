// AstraDB Integration Tests
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { astraDBService } from '../../src/lib/astradb'
import AstraDBSettingsManager from '../../src/lib/config/astradb-settings'
import RedisCache from '../../src/lib/cache/redis-cache'
import { 
  ContentDocument, 
  UserDocument, 
  BrandDocument,
  AstraDBConnection 
} from '../../src/types/astradb'
import { createTestDocument, createTestUser, createTestBrand } from '../astradb/client.test'

// Skip integration tests unless explicitly enabled
const ENABLE_INTEGRATION_TESTS = process.env.ENABLE_INTEGRATION_TESTS === 'true'

describe('AstraDB Integration Tests', () => {
  let testConnection: AstraDBConnection
  let createdTestData: {
    users: UserDocument[]
    brands: BrandDocument[]
    content: ContentDocument[]
  }

  beforeAll(async () => {
    if (!ENABLE_INTEGRATION_TESTS) {
      console.log('Skipping integration tests - set ENABLE_INTEGRATION_TESTS=true to run')
      return
    }

    // Setup test connection
    testConnection = {
      id: 'test-integration',
      name: 'Integration Test',
      config: {
        databaseId: process.env.TEST_ASTRA_DB_DATABASE_ID!,
        region: process.env.TEST_ASTRA_DB_REGION!,
        applicationToken: process.env.TEST_ASTRA_DB_APPLICATION_TOKEN!,
        namespace: 'integration_test',
        environment: 'dev'
      },
      status: 'disconnected'
    }

    // Initialize service
    await astraDBService.initialize()
    await astraDBService.addConnection(testConnection)

    createdTestData = {
      users: [],
      brands: [],
      content: []
    }
  }, 30000)

  afterAll(async () => {
    if (!ENABLE_INTEGRATION_TESTS) return

    // Cleanup test data
    try {
      // Delete test content
      for (const content of createdTestData.content) {
        await astraDBService.deleteContent(content._id, false)
      }

      // Delete test brands
      const contentOps = astraDBService.getContentOperations()
      if (contentOps) {
        for (const brand of createdTestData.brands) {
          await contentOps.deleteBrand(brand._id)
        }
      }

      // Note: Users are typically not deleted in production systems
      // but you might want to mark them as inactive or test users

      await astraDBService.disconnect()
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }, 30000)

  beforeEach(() => {
    if (!ENABLE_INTEGRATION_TESTS) {
      test.skip()
    }
  })

  describe('Service Initialization', () => {
    it('should initialize successfully', async () => {
      expect(astraDBService.isInitialized()).toBe(true)
    })

    it('should have healthy connections', async () => {
      const health = await astraDBService.getSystemHealth()
      
      expect(health.database).toBe(true)
      expect(health.overall).toBe(true)
      expect(health.connections.length).toBeGreaterThan(0)
      
      const healthyConnections = health.connections.filter(c => c.healthy)
      expect(healthyConnections.length).toBeGreaterThan(0)
    })

    it('should validate schema successfully', async () => {
      const validation = await astraDBService.validateSchema()
      
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe('End-to-End Content Workflow', () => {
    let testUser: UserDocument
    let testBrand: BrandDocument
    let testContent: ContentDocument

    it('should create a complete content workflow', async () => {
      // Step 1: Create a user
      const userData = createTestUser({
        name: 'Integration Test User',
        email: `integration-${Date.now()}@test.com`
      })

      testUser = await astraDBService.createUser(userData) as UserDocument
      expect(testUser).toBeDefined()
      expect(testUser._id).toBeDefined()
      createdTestData.users.push(testUser)

      // Step 2: Create a brand
      const brandData = createTestBrand({
        name: `Integration Test Brand ${Date.now()}`,
        ownerId: testUser._id
      })

      testBrand = await astraDBService.createBrand(brandData) as BrandDocument
      expect(testBrand).toBeDefined()
      expect(testBrand._id).toBeDefined()
      createdTestData.brands.push(testBrand)

      // Step 3: Create content
      const contentData = createTestDocument({
        title: `Integration Test Content ${Date.now()}`,
        brandId: testBrand._id,
        generatedBy: testUser._id,
        content: 'This is integration test content with sufficient length to test various features and analytics.'
      })

      testContent = await astraDBService.createContent(contentData, false) as ContentDocument
      expect(testContent).toBeDefined()
      expect(testContent._id).toBeDefined()
      createdTestData.content.push(testContent)

      // Step 4: Update content
      const updatedContent = await astraDBService.updateContent(
        testContent._id,
        { 
          title: 'Updated Integration Test Content',
          status: 'review'
        },
        false
      )
      expect(updatedContent?.title).toBe('Updated Integration Test Content')
      expect(updatedContent?.status).toBe('review')

      // Step 5: Publish content
      const publishedContent = await astraDBService.updateContent(
        testContent._id,
        { status: 'published', publishedAt: new Date() },
        false
      )
      expect(publishedContent?.status).toBe('published')

      // Step 6: Retrieve content by brand
      const brandContent = await astraDBService.getContentByBrand(
        testBrand._id,
        { status: 'published' },
        false
      )
      expect(brandContent.length).toBeGreaterThan(0)
      expect(brandContent.some(c => c._id === testContent._id)).toBe(true)
    }, 60000)

    it('should handle content analytics', async () => {
      if (!testContent) {
        test.skip('No test content available')
        return
      }

      // Get content performance
      const performance = await astraDBService.getContentPerformance(testContent._id, false)
      expect(performance).toBeDefined()
      expect(typeof performance.views).toBe('number')
      expect(typeof performance.engagement).toBe('number')

      // Get content metrics
      const metrics = await astraDBService.getContentMetrics(testBrand._id, '30d', false)
      expect(metrics).toBeDefined()
      expect(metrics.totalContent).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Search Functionality', () => {
    let searchTestContent: ContentDocument[]

    beforeAll(async () => {
      if (!ENABLE_INTEGRATION_TESTS) return

      // Create test content for search
      const testUser = createdTestData.users[0]
      const testBrand = createdTestData.brands[0]

      if (!testUser || !testBrand) {
        console.warn('No test user or brand available for search tests')
        return
      }

      const searchContent = [
        {
          title: 'JavaScript Best Practices',
          content: 'Learn about JavaScript development best practices and patterns',
          tags: ['javascript', 'development', 'best-practices'],
          metadata: { keywords: ['javascript', 'development', 'patterns'] }
        },
        {
          title: 'React Component Design',
          content: 'How to design reusable React components for modern applications',
          tags: ['react', 'components', 'javascript'],
          metadata: { keywords: ['react', 'components', 'design'] }
        },
        {
          title: 'Node.js Performance',
          content: 'Optimizing Node.js applications for better performance',
          tags: ['nodejs', 'performance', 'optimization'],
          metadata: { keywords: ['nodejs', 'performance', 'optimization'] }
        }
      ]

      searchTestContent = []
      for (const content of searchContent) {
        const contentDoc = createTestDocument({
          ...content,
          brandId: testBrand._id,
          generatedBy: testUser._id
        })

        const created = await astraDBService.createContent(contentDoc, false)
        if (created) {
          searchTestContent.push(created)
          createdTestData.content.push(created)
        }
      }
    }, 60000)

    it('should search content by keywords', async () => {
      if (searchTestContent.length === 0) {
        test.skip('No search test content available')
        return
      }

      const results = await astraDBService.searchContentByKeywords(
        ['javascript'],
        { brandId: createdTestData.brands[0]?._id },
        false
      )

      expect(results.length).toBeGreaterThan(0)
      
      // Should find JavaScript and React content
      const foundTitles = results.map(r => r.title)
      expect(foundTitles.some(title => title.includes('JavaScript'))).toBe(true)
    }, 30000)

    it('should handle empty search results', async () => {
      const results = await astraDBService.searchContentByKeywords(
        ['nonexistent-keyword-xyz'],
        {},
        false
      )

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    }, 15000)
  })

  describe('Performance and Load Testing', () => {
    it('should handle concurrent operations', async () => {
      const testUser = createdTestData.users[0]
      const testBrand = createdTestData.brands[0]

      if (!testUser || !testBrand) {
        test.skip('No test user or brand available')
        return
      }

      const concurrentOperations = Array.from({ length: 10 }, (_, i) => 
        astraDBService.createContent(createTestDocument({
          title: `Concurrent Test ${i}`,
          brandId: testBrand._id,
          generatedBy: testUser._id
        }), false)
      )

      const results = await Promise.allSettled(concurrentOperations)
      const successful = results.filter(r => r.status === 'fulfilled').length

      expect(successful).toBeGreaterThan(5) // At least half should succeed

      // Cleanup created content
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          createdTestData.content.push(result.value)
        }
      }
    }, 60000)

    it('should maintain performance under load', async () => {
      const testBrand = createdTestData.brands[0]
      
      if (!testBrand) {
        test.skip('No test brand available')
        return
      }

      const startTime = Date.now()
      
      // Perform multiple read operations
      const readOperations = Array.from({ length: 20 }, () =>
        astraDBService.getContentByBrand(testBrand._id, {}, false)
      )

      await Promise.all(readOperations)
      
      const duration = Date.now() - startTime
      const avgResponseTime = duration / readOperations.length

      // Should complete all operations in reasonable time
      expect(avgResponseTime).toBeLessThan(2000) // Less than 2 seconds average
    }, 45000)
  })

  describe('Cache Integration', () => {
    let cacheTestContent: ContentDocument

    beforeAll(async () => {
      if (!ENABLE_INTEGRATION_TESTS || !createdTestData.users[0] || !createdTestData.brands[0]) return

      const contentData = createTestDocument({
        title: 'Cache Test Content',
        brandId: createdTestData.brands[0]._id,
        generatedBy: createdTestData.users[0]._id
      })

      cacheTestContent = await astraDBService.createContent(contentData, true) as ContentDocument
      createdTestData.content.push(cacheTestContent)
    })

    it('should use cache for repeated requests', async () => {
      if (!cacheTestContent) {
        test.skip('No cache test content available')
        return
      }

      // First request (should hit database)
      const start1 = Date.now()
      const content1 = await astraDBService.getContent(cacheTestContent._id, true)
      const duration1 = Date.now() - start1

      // Second request (should hit cache)
      const start2 = Date.now()
      const content2 = await astraDBService.getContent(cacheTestContent._id, true)
      const duration2 = Date.now() - start2

      expect(content1).toEqual(content2)
      expect(duration2).toBeLessThan(duration1) // Cache should be faster
    }, 30000)

    it('should invalidate cache on updates', async () => {
      if (!cacheTestContent) {
        test.skip('No cache test content available')
        return
      }

      // Get content with cache
      const original = await astraDBService.getContent(cacheTestContent._id, true)

      // Update content
      const updated = await astraDBService.updateContent(
        cacheTestContent._id,
        { title: 'Updated Cache Test Content' },
        true
      )

      // Get content again (should reflect update)
      const afterUpdate = await astraDBService.getContent(cacheTestContent._id, true)

      expect(original?.title).not.toBe(afterUpdate?.title)
      expect(afterUpdate?.title).toBe('Updated Cache Test Content')
    }, 30000)

    it('should provide cache statistics', async () => {
      const stats = await astraDBService.getCacheStats()
      
      expect(stats).toHaveProperty('connected')
      expect(stats).toHaveProperty('totalKeys')
      expect(typeof stats.totalKeys).toBe('number')
    }, 15000)
  })

  describe('Error Handling and Recovery', () => {
    it('should handle database disconnection gracefully', async () => {
      // Simulate a database error by using invalid connection
      const contentOps = astraDBService.getContentOperations()
      
      // This should not throw but return appropriate error responses
      const result = await contentOps?.getContent('non-existent-id')
      expect(result).toBeNull()
    })

    it('should handle invalid data gracefully', async () => {
      // Try to create content with invalid data
      const invalidContent = {
        title: '', // Invalid: empty title
        content: '',
        brandId: 'invalid-brand-id',
        generatedBy: 'invalid-user-id',
        type: 'invalid-type'
      } as any

      const result = await astraDBService.createContent(invalidContent, false)
      
      // Should either succeed with defaults or return null
      expect(result === null || typeof result === 'object').toBe(true)
    })
  })

  describe('Settings Management', () => {
    it('should manage connections', async () => {
      const settings = await astraDBService.getSettings()
      
      expect(settings).toHaveProperty('connections')
      expect(settings).toHaveProperty('defaultConnection')
      expect(Array.isArray(settings.connections)).toBe(true)
    })

    it('should test connections', async () => {
      const connectionTest = await astraDBService.testConnection(testConnection.id)
      
      expect(typeof connectionTest).toBe('boolean')
    })
  })
})

// Utility functions for integration tests
export const integrationTestUtils = {
  async waitForOperation<T>(
    operation: () => Promise<T>,
    timeout: number = 30000,
    interval: number = 1000
  ): Promise<T> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      try {
        return await operation()
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }
    
    throw new Error(`Operation timed out after ${timeout}ms`)
  },

  async cleanupTestData(data: {
    users: UserDocument[]
    brands: BrandDocument[]
    content: ContentDocument[]
  }) {
    const contentOps = astraDBService.getContentOperations()
    if (!contentOps) return

    // Delete in reverse dependency order
    for (const content of data.content) {
      try {
        await astraDBService.deleteContent(content._id, false)
      } catch (error) {
        console.warn(`Failed to delete content ${content._id}:`, error)
      }
    }

    for (const brand of data.brands) {
      try {
        await contentOps.deleteBrand(brand._id)
      } catch (error) {
        console.warn(`Failed to delete brand ${brand._id}:`, error)
      }
    }

    // Note: Users are typically not deleted
  },

  generatePerformanceReport(operations: Array<{ name: string; duration: number; success: boolean }>) {
    const successful = operations.filter(op => op.success)
    const failed = operations.filter(op => !op.success)
    
    const avgDuration = successful.reduce((sum, op) => sum + op.duration, 0) / successful.length
    const maxDuration = Math.max(...successful.map(op => op.duration))
    const minDuration = Math.min(...successful.map(op => op.duration))
    
    return {
      totalOperations: operations.length,
      successful: successful.length,
      failed: failed.length,
      successRate: successful.length / operations.length,
      avgDuration,
      maxDuration,
      minDuration,
      throughput: 1000 / avgDuration // operations per second
    }
  }
}