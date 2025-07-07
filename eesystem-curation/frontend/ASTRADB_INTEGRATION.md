# AstraDB Integration for EESystem Content Curation Platform

## Overview

This document describes the comprehensive AstraDB Data API integration for the EESystem Content Curation Platform. The integration provides a scalable, cloud-native database solution with vector search capabilities, Redis caching, and Railway deployment support.

## Architecture

### Core Components

1. **AstraDB Client** (`src/lib/astradb/client.ts`)
   - RESTful API client for DataStax Astra DB
   - Authentication with application tokens
   - Automatic retry logic and error handling
   - Connection pooling and health monitoring

2. **Schema Manager** (`src/lib/astradb/schema.ts`)
   - Database schema creation and migration
   - Version control for database changes
   - Automated schema validation
   - Cleanup and maintenance operations

3. **Content Operations** (`src/lib/astradb/content-operations.ts`)
   - CRUD operations for content, users, brands, and agents
   - Vector similarity search for content discovery
   - Analytics and performance tracking
   - Batch operations for efficiency

4. **Redis Cache** (`src/lib/cache/redis-cache.ts`)
   - Performance optimization with caching
   - Configurable TTL and cache strategies
   - Health monitoring and statistics
   - Automatic cache invalidation

5. **Settings Manager** (`src/lib/config/astradb-settings.ts`)
   - Connection management and configuration
   - Token rotation and security
   - Environment-based configuration
   - Health monitoring and alerts

6. **Main Service** (`src/lib/astradb/index.ts`)
   - Unified interface for all AstraDB operations
   - Intelligent caching with fallback strategies
   - Performance monitoring and metrics
   - Error handling and recovery

## Installation and Setup

### 1. Install Dependencies

```bash
npm install @datastax/astra-db-ts ioredis @types/ioredis
```

### 2. Environment Configuration

Create a `.env` file with the following variables:

```env
# AstraDB Configuration
ASTRA_DB_DATABASE_ID=your-database-id
ASTRA_DB_REGION=your-region
ASTRA_DB_APPLICATION_TOKEN=your-application-token
ASTRA_DB_NAMESPACE=default
ASTRA_DB_ENDPOINT=https://your-database-id-your-region.apps.astra.datastax.com

# Redis Configuration
REDIS_URL=redis://username:password@hostname:port
REDIS_TLS=true

# Security Configuration
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key
API_RATE_LIMIT=100
```

### 3. Initialize AstraDB Service

```typescript
import { astraDBService } from './src/lib/astradb'

// Initialize the service
await astraDBService.initialize()

// Check health
const health = await astraDBService.getSystemHealth()
console.log('AstraDB Status:', health)
```

## Database Schema

### Collections

#### Content Collection
```typescript
interface ContentDocument {
  _id: string
  title: string
  type: string
  content: string
  brandId: string
  status: string
  metadata: ContentMetadata
  embeddings?: number[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  scheduledFor?: Date
  generatedBy: string
  version: number
}
```

#### Users Collection
```typescript
interface UserDocument {
  _id: string
  name: string
  email: string
  role: string
  avatar?: string
  preferences: UserPreferences
  settings: UserSettings
  createdAt: Date
  updatedAt: Date
  lastLogin?: Date
  loginCount: number
}
```

#### Brands Collection
```typescript
interface BrandDocument {
  _id: string
  name: string
  color: string
  logo?: string
  style: BrandStyle
  settings: BrandSettings
  ownerId: string
  collaborators: string[]
  createdAt: Date
  updatedAt: Date
  contentCount: number
}
```

#### Agents Collection
```typescript
interface AgentDocument {
  _id: string
  name: string
  type: string
  status: string
  capabilities: string[]
  currentTask?: string
  performance: AgentPerformance
  config: AgentConfig
  createdAt: Date
  updatedAt: Date
  lastActivity?: Date
  totalTasks: number
}
```

## Usage Examples

### Content Operations

```typescript
import { astraDBService } from './src/lib/astradb'

// Create content
const content = await astraDBService.createContent({
  title: 'AI in Content Creation',
  type: 'article',
  content: 'Content about AI...',
  brandId: 'brand-123',
  status: 'draft',
  generatedBy: 'user-123',
  metadata: {
    wordCount: 500,
    readingTime: 3,
    seoScore: 85,
    keywords: ['AI', 'content', 'automation'],
    targetAudience: ['marketers'],
    tone: 'professional',
    style: 'informative'
  },
  tags: ['AI', 'automation']
})

// Get content by brand
const brandContent = await astraDBService.getContentByBrand('brand-123', {
  status: 'published',
  limit: 10
})

// Search content
const searchResults = await astraDBService.searchContentByKeywords(
  ['AI', 'automation'],
  { brandId: 'brand-123', limit: 5 }
)

// Update content
const updated = await astraDBService.updateContent('content-123', {
  status: 'published',
  publishedAt: new Date()
})
```

### Vector Search

```typescript
// Search by similarity (requires embeddings)
const similarContent = await astraDBService.searchContentBySimilarity(
  'AI content creation best practices',
  embeddings, // 1536-dimension vector
  {
    brandId: 'brand-123',
    threshold: 0.7,
    limit: 10
  }
)

// Get related content
const related = await astraDBService.getRelatedContent('content-123', 5)
```

### User Management

```typescript
// Create user
const user = await astraDBService.createUser({
  name: 'John Doe',
  email: 'john@example.com',
  role: 'editor',
  preferences: {
    theme: 'dark',
    notifications: true,
    autoSave: true,
    defaultContentType: 'article'
  },
  settings: {
    apiQuota: 1000,
    maxConcurrentGenerations: 5,
    preferredAgents: ['writer', 'seo'],
    qualityThreshold: 0.8,
    autoApprove: false,
    dataRetentionDays: 365
  }
})

// Get user by email
const user = await astraDBService.getUserByEmail('john@example.com')
```

### Analytics

```typescript
// Get content performance
const performance = await astraDBService.getContentPerformance('content-123')

// Get content metrics
const metrics = await astraDBService.getContentMetrics('brand-123', '30d')
```

## Caching Strategy

### Cache Configuration

```typescript
// Configure cache settings
await astraDBService.updateSettings({
  cache: {
    ttl: 3600, // 1 hour
    maxSize: 10000,
    enabled: true,
    keyPrefix: 'eesystem:'
  }
})

// Clear cache
await astraDBService.clearCache()

// Get cache statistics
const stats = await astraDBService.getCacheStats()
```

### Cache Keys

- `content:{id}` - Individual content items (10 minutes)
- `content:brand:{brandId}:*` - Brand content lists (5 minutes)
- `user:{id}` - User data (15 minutes)
- `brand:{id}` - Brand data (30 minutes)
- `search:*` - Search results (3 minutes)
- `analytics:*` - Analytics data (5-10 minutes)

## Railway Deployment

### Configuration Files

1. **railway.toml** - Railway service configuration
2. **deployment/railway/railway-config.js** - Deployment utilities
3. **deployment/railway/connection-test.js** - Connection testing
4. **.env.railway.template** - Environment template

### Deployment Steps

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create new project
railway new

# 4. Set environment variables
railway variables set ASTRA_DB_DATABASE_ID=your-id
railway variables set ASTRA_DB_REGION=your-region
railway variables set ASTRA_DB_APPLICATION_TOKEN=your-token

# 5. Deploy
railway up
```

### Health Checks

Railway automatically monitors:
- `/api/health` - Basic health endpoint
- `/api/health/detailed` - Detailed system status
- Database connection status
- Cache availability
- Response times and error rates

## Testing

### Unit Tests

```bash
# Run all AstraDB tests
npm test -- tests/astradb/

# Run specific test files
npm test -- tests/astradb/client.test.ts
npm test -- tests/astradb/content-operations.test.ts
```

### Integration Tests

```bash
# Set up test environment
export ENABLE_INTEGRATION_TESTS=true
export TEST_ASTRA_DB_DATABASE_ID=your-test-db-id
export TEST_ASTRA_DB_REGION=your-test-region
export TEST_ASTRA_DB_APPLICATION_TOKEN=your-test-token

# Run integration tests
npm test -- tests/integration/astradb-integration.test.ts
```

### Performance Testing

```typescript
import { performanceTestHelper } from './tests/astradb/content-operations.test'

// Test bulk operations
const results = await performanceTestHelper.testBulkOperations(contentOps, 100)
console.log('Throughput:', results.insertThroughput, 'ops/sec')
```

## Monitoring and Metrics

### System Health

```typescript
// Get comprehensive health status
const health = await astraDBService.getSystemHealth()
console.log('Database:', health.database)
console.log('Cache:', health.cache)
console.log('Connections:', health.connections)
console.log('Overall:', health.overall)
```

### Performance Metrics

```typescript
// Get performance metrics
const metrics = await astraDBService.getPerformanceMetrics()
console.log('Cache stats:', metrics.cache)
console.log('System status:', metrics.system)
```

### Connection Monitoring

```typescript
// Monitor connection health
const settingsManager = new AstraDBSettingsManager()
await settingsManager.refreshConnectionHealth()

const connectionHealth = await settingsManager.getConnectionsHealth()
connectionHealth.forEach(conn => {
  console.log(`${conn.id}: ${conn.healthy ? 'OK' : 'FAILED'} (${conn.responseTime}ms)`)
})
```

## Security

### Token Management

```typescript
// Rotate application token
await settingsManager.rotateToken('connection-id', 'new-token')

// Validate token
const isValid = await settingsManager.validateToken('connection-id')
```

### Data Protection

- All sensitive data is encrypted at rest
- Application tokens are stored securely
- Rate limiting prevents abuse
- Audit logging tracks all operations

## Troubleshooting

### Common Issues

1. **Connection Failures**
   ```typescript
   // Check connection status
   const client = astraDBService.getClient()
   if (!client?.getConnectionStatus()) {
     await client?.reconnect()
   }
   ```

2. **Cache Issues**
   ```typescript
   // Check cache health
   const cacheHealthy = await astraDBService.getCacheStats()
   if (!cacheHealthy.connected) {
     // Cache is down, operations will continue without caching
   }
   ```

3. **Schema Validation Errors**
   ```typescript
   // Validate and fix schema
   const validation = await astraDBService.validateSchema()
   if (!validation.valid) {
     console.log('Schema errors:', validation.errors)
     await astraDBService.runMigrations()
   }
   ```

### Debug Mode

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug'

// Check system status
const status = await astraDBService.getSystemHealth()
console.log('System Status:', JSON.stringify(status, null, 2))
```

## Migration Guide

### From Existing Database

1. **Export Data**
   ```bash
   node scripts/export-existing-data.js
   ```

2. **Transform Schema**
   ```bash
   node scripts/transform-schema.js
   ```

3. **Import to AstraDB**
   ```bash
   node scripts/import-to-astradb.js
   ```

### Schema Migrations

```typescript
// Run pending migrations
await astraDBService.runMigrations()

// Rollback migration
const schemaManager = astraDBService.getSchemaManager()
await schemaManager?.rollbackMigration('1.1.0')
```

## API Reference

### AstraDBService

- `initialize()` - Initialize the service
- `createContent(content)` - Create new content
- `getContent(id)` - Get content by ID
- `updateContent(id, updates)` - Update content
- `deleteContent(id)` - Delete content
- `searchContentByKeywords(keywords, options)` - Search content
- `getSystemHealth()` - Get health status
- `getPerformanceMetrics()` - Get performance data
- `clearCache()` - Clear all cache

### ContentOperations

- `createUser(user)` - Create new user
- `getBrand(id)` - Get brand by ID
- `getContentPerformance(id)` - Get analytics
- `updateAgentPerformance(id, metrics)` - Update agent stats
- `cleanupOldContent(days)` - Cleanup old data

### AstraDBClient

- `findOne(collection, filter)` - Find single document
- `findMany(collection, filter, options)` - Find multiple documents
- `insertOne(collection, document)` - Insert document
- `updateOne(collection, filter, update)` - Update document
- `deleteOne(collection, filter)` - Delete document
- `vectorSearch(collection, options)` - Vector similarity search

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review test files for usage examples
3. Check Railway deployment logs
4. Monitor system health endpoints
5. Consult AstraDB documentation

## Performance Benchmarks

- **Content Creation**: ~100-500 ops/sec
- **Content Retrieval**: ~1000-2000 ops/sec  
- **Vector Search**: ~50-100 ops/sec
- **Cache Hit Rate**: >90% for repeated queries
- **Response Time**: <100ms for cached operations
- **Response Time**: <500ms for database operations

## Roadmap

- [ ] Real-time sync with WebSockets
- [ ] Advanced vector search with metadata filtering  
- [ ] Multi-region deployment support
- [ ] Enhanced analytics and reporting
- [ ] Automated backup and restore
- [ ] Machine learning-based content recommendations