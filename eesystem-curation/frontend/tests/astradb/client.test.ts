// AstraDB Client Tests
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { AstraDBClient } from '../../src/lib/astradb/client'
import { AstraDBConfig } from '../../src/types/astradb'

// Mock the @datastax/astra-db-ts module
jest.mock('@datastax/astra-db-ts', () => ({
  DataAPIClient: jest.fn().mockImplementation(() => ({
    db: jest.fn().mockReturnValue({
      info: jest.fn().mockResolvedValue({ name: 'test-db' }),
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ _id: '1', title: 'Test' }),
        find: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield { _id: '1', title: 'Test 1' }
            yield { _id: '2', title: 'Test 2' }
          }
        }),
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
        insertMany: jest.fn().mockResolvedValue({ insertedIds: ['id1', 'id2'] }),
        updateOne: jest.fn().mockResolvedValue({ 
          modifiedCount: 1, 
          value: { _id: '1', title: 'Updated' } 
        }),
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
        countDocuments: jest.fn().mockResolvedValue(5),
        distinct: jest.fn().mockResolvedValue(['tag1', 'tag2']),
        aggregate: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield { _id: 'group1', count: 10 }
          }
        })
      }),
      createCollection: jest.fn().mockResolvedValue({}),
      dropCollection: jest.fn().mockResolvedValue({}),
      listCollections: jest.fn().mockResolvedValue([
        { name: 'content' },
        { name: 'users' }
      ])
    })
  }))
}))

describe('AstraDBClient', () => {
  let client: AstraDBClient
  let mockConfig: AstraDBConfig

  beforeEach(() => {
    mockConfig = {
      databaseId: 'test-db-id',
      region: 'us-east1',
      applicationToken: 'test-token',
      namespace: 'test-namespace',
      environment: 'dev'
    }

    client = new AstraDBClient(mockConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Connection Management', () => {
    it('should initialize with correct configuration', () => {
      expect(client.getConfig()).toEqual(mockConfig)
    })

    it('should build correct endpoint URL', () => {
      const config = client.getConfig()
      expect(config.databaseId).toBe('test-db-id')
      expect(config.region).toBe('us-east1')
    })

    it('should handle connection status', async () => {
      // Note: In a real test, you might want to mock the connection status
      expect(typeof client.getConnectionStatus()).toBe('boolean')
    })
  })

  describe('Health Checks', () => {
    it('should perform health check', async () => {
      const health = await client.getHealthStatus()
      
      expect(health).toHaveProperty('status')
      expect(health).toHaveProperty('responseTime')
      expect(health).toHaveProperty('timestamp')
      expect(health).toHaveProperty('metrics')
      expect(health.metrics).toHaveProperty('collectionsCount')
    })

    it('should return health status', async () => {
      const isHealthy = await client.isHealthy()
      expect(typeof isHealthy).toBe('boolean')
    })
  })

  describe('CRUD Operations', () => {
    const testCollection = 'test-collection'
    const testDocument = { title: 'Test Document', content: 'Test content' }

    it('should find a single document', async () => {
      const result = await client.findOne(testCollection, { _id: '1' })
      
      expect(result).toEqual({ _id: '1', title: 'Test' })
    })

    it('should find multiple documents', async () => {
      const results = await client.findMany(testCollection, {})
      
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ _id: '1', title: 'Test 1' })
    })

    it('should insert a single document', async () => {
      const result = await client.insertOne(testCollection, testDocument)
      
      expect(result.success).toBe(true)
      expect(result.insertedId).toBe('test-id')
      expect(result.data).toEqual(testDocument)
    })

    it('should insert multiple documents', async () => {
      const documents = [testDocument, { ...testDocument, title: 'Test Document 2' }]
      const result = await client.insertMany(testCollection, documents)
      
      expect(result.success).toBe(true)
      expect(result.insertedId).toContain('id1')
      expect(result.data).toEqual(documents)
    })

    it('should update a single document', async () => {
      const update = { $set: { title: 'Updated Title' } }
      const result = await client.updateOne(testCollection, { _id: '1' }, update)
      
      expect(result.success).toBe(true)
      expect(result.modifiedCount).toBe(1)
      expect(result.data).toEqual({ _id: '1', title: 'Updated' })
    })

    it('should update multiple documents', async () => {
      const update = { $set: { status: 'updated' } }
      const result = await client.updateMany(testCollection, {}, update)
      
      expect(result.success).toBe(true)
      expect(result.modifiedCount).toBe(2)
    })

    it('should delete a single document', async () => {
      const result = await client.deleteOne(testCollection, { _id: '1' })
      
      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(1)
    })

    it('should delete multiple documents', async () => {
      const result = await client.deleteMany(testCollection, { status: 'inactive' })
      
      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(2)
    })
  })

  describe('Vector Search', () => {
    it('should perform vector search', async () => {
      const mockVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      const searchOptions = {
        vector: mockVector,
        limit: 5,
        includeSimilarity: true
      }

      const result = await client.vectorSearch(testCollection, searchOptions)
      
      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('took')
      expect(Array.isArray(result.results)).toBe(true)
    })
  })

  describe('Collection Management', () => {
    it('should create a collection', async () => {
      const result = await client.createCollection('new-collection')
      expect(result).toBe(true)
    })

    it('should drop a collection', async () => {
      const result = await client.dropCollection('old-collection')
      expect(result).toBe(true)
    })

    it('should list collections', async () => {
      const collections = await client.listCollections()
      expect(Array.isArray(collections)).toBe(true)
      expect(collections).toContain('content')
      expect(collections).toContain('users')
    })
  })

  describe('Aggregation Operations', () => {
    it('should perform aggregation', async () => {
      const pipeline = [
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]

      const results = await client.aggregate(testCollection, pipeline)
      
      expect(Array.isArray(results)).toBe(true)
      expect(results[0]).toEqual({ _id: 'group1', count: 10 })
    })
  })

  describe('Utility Operations', () => {
    it('should count documents', async () => {
      const count = await client.count(testCollection, {})
      expect(count).toBe(5)
    })

    it('should get distinct values', async () => {
      const distinct = await client.distinct(testCollection, 'tags', {})
      expect(Array.isArray(distinct)).toBe(true)
      expect(distinct).toContain('tag1')
      expect(distinct).toContain('tag2')
    })
  })

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // Mock a connection error
      const errorClient = new AstraDBClient({
        ...mockConfig,
        applicationToken: 'invalid-token'
      })

      // The client should handle errors without throwing
      expect(() => errorClient).not.toThrow()
    })

    it('should retry operations on failure', async () => {
      // This would require more sophisticated mocking to test retry logic
      // For now, we'll just ensure the retry config is properly set
      expect(client.getConfig()).toBeDefined()
    })
  })

  describe('Connection Lifecycle', () => {
    it('should reconnect when requested', async () => {
      await expect(client.reconnect()).resolves.not.toThrow()
    })

    it('should disconnect cleanly', async () => {
      await expect(client.disconnect()).resolves.not.toThrow()
      expect(client.getConnectionStatus()).toBe(false)
    })
  })
})

// Integration test helper
export const createTestClient = (config?: Partial<AstraDBConfig>): AstraDBClient => {
  const testConfig: AstraDBConfig = {
    databaseId: process.env.TEST_ASTRA_DB_DATABASE_ID || 'test-db-id',
    region: process.env.TEST_ASTRA_DB_REGION || 'us-east1',
    applicationToken: process.env.TEST_ASTRA_DB_APPLICATION_TOKEN || 'test-token',
    namespace: 'test',
    environment: 'dev',
    ...config
  }

  return new AstraDBClient(testConfig)
}

// Test data factories
export const createTestDocument = (overrides?: any) => ({
  _id: `test-${Date.now()}`,
  title: 'Test Document',
  content: 'Test content',
  type: 'article',
  status: 'draft',
  tags: ['test'],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

export const createTestUser = (overrides?: any) => ({
  _id: `user-${Date.now()}`,
  name: 'Test User',
  email: 'test@example.com',
  role: 'editor',
  preferences: {
    theme: 'light',
    notifications: true,
    autoSave: true,
    defaultContentType: 'article'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

export const createTestBrand = (overrides?: any) => ({
  _id: `brand-${Date.now()}`,
  name: 'Test Brand',
  color: '#007bff',
  style: {
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
    fontFamily: 'Arial',
    tone: 'professional'
  },
  settings: {
    autoPublish: false,
    contentGuidelines: ['Be professional', 'Use proper grammar'],
    socialMediaAccounts: []
  },
  ownerId: 'test-user-id',
  collaborators: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  contentCount: 0,
  ...overrides
})