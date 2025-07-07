# AstraDB Data API Integration Strategy

## Overview
Comprehensive integration strategy for migrating from SQLite to AstraDB using the Data API, providing production-ready database capabilities with high availability, global distribution, and enterprise-grade security.

## 1. AstraDB Architecture Overview

### 1.1 Database Structure
```
EESystem Content Curation Database
├── Keyspace: eesystem_curation
├── Tables:
│   ├── users                    # User accounts and authentication
│   ├── user_sessions           # Session management
│   ├── user_permissions        # RBAC permissions
│   ├── brands                  # Brand configurations
│   ├── content                 # Content items
│   ├── content_generations     # AI generation history
│   ├── ai_agents              # AI agent configurations
│   ├── uploaded_files         # File metadata
│   ├── analytics              # Performance analytics
│   ├── audit_logs             # Audit trail
│   ├── application_settings   # System settings
│   ├── environment_variables  # Environment configuration
│   └── secret_keys            # Encrypted secrets
```

### 1.2 Data API Configuration
```typescript
interface AstraDBConfig {
  applicationToken: string
  databaseId: string
  keyspace: string
  region: string
  baseUrl: string
  timeout: number
  retryConfig: RetryConfig
  connectionPool: PoolConfig
}

interface RetryConfig {
  maxRetries: number
  backoffStrategy: 'exponential' | 'linear'
  baseDelay: number
  maxDelay: number
  retryableErrors: string[]
}

interface PoolConfig {
  maxConnections: number
  minConnections: number
  acquireTimeout: number
  idleTimeout: number
  reapInterval: number
}
```

## 2. AstraDB Client Implementation

### 2.1 Core Client Class
```typescript
class AstraDBClient {
  private config: AstraDBConfig
  private httpClient: AxiosInstance
  private connectionPool: ConnectionPool
  private queryCache: QueryCache

  constructor(config: AstraDBConfig) {
    this.config = config
    this.setupHttpClient()
    this.connectionPool = new ConnectionPool(config.connectionPool)
    this.queryCache = new QueryCache()
  }

  private setupHttpClient(): void {
    this.httpClient = axios.create({
      baseURL: `${this.config.baseUrl}/api/rest/v2/keyspaces/${this.config.keyspace}`,
      timeout: this.config.timeout,
      headers: {
        'X-Cassandra-Token': this.config.applicationToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    // Request interceptor for connection pooling
    this.httpClient.interceptors.request.use(
      async (config) => {
        const connection = await this.connectionPool.acquire()
        config.metadata = { connectionId: connection.id }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling and retry logic
    this.httpClient.interceptors.response.use(
      (response) => {
        // Release connection back to pool
        const connectionId = response.config.metadata?.connectionId
        if (connectionId) {
          this.connectionPool.release(connectionId)
        }
        return response
      },
      async (error) => {
        const connectionId = error.config?.metadata?.connectionId
        if (connectionId) {
          this.connectionPool.release(connectionId)
        }

        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config)
        }
        
        return Promise.reject(this.enhanceError(error))
      }
    )
  }

  async createTable(tableName: string, schema: TableSchema): Promise<void> {
    const createTableQuery = this.buildCreateTableQuery(tableName, schema)
    
    try {
      await this.httpClient.post('/schema/tables', {
        name: tableName,
        columnDefinitions: schema.columns,
        primaryKey: schema.primaryKey,
        clusteringKey: schema.clusteringKey
      })
    } catch (error) {
      throw new AstraDBError(`Failed to create table ${tableName}`, error)
    }
  }

  async query<T>(tableName: string, query: QueryOptions): Promise<QueryResult<T>> {
    const cacheKey = this.getCacheKey(tableName, query)
    
    // Check cache first
    if (query.enableCache) {
      const cached = await this.queryCache.get<T>(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const response = await this.httpClient.get(`/${tableName}`, {
        params: this.buildQueryParams(query)
      })

      const result: QueryResult<T> = {
        data: response.data.data,
        count: response.data.count,
        pageState: response.data.pageState,
        metadata: {
          executionTime: response.headers['x-execution-time'],
          requestId: response.headers['x-request-id']
        }
      }

      // Cache successful results
      if (query.enableCache && result.data.length > 0) {
        await this.queryCache.set(cacheKey, result, query.cacheTtl || 300)
      }

      return result
    } catch (error) {
      throw new AstraDBError(`Query failed for table ${tableName}`, error)
    }
  }

  async insert<T>(tableName: string, data: T): Promise<InsertResult> {
    try {
      const response = await this.httpClient.post(`/${tableName}`, data)
      
      // Invalidate related cache entries
      await this.queryCache.invalidatePattern(`${tableName}:*`)
      
      return {
        success: true,
        insertedId: response.data.insertedId,
        timestamp: new Date()
      }
    } catch (error) {
      throw new AstraDBError(`Insert failed for table ${tableName}`, error)
    }
  }

  async update<T>(tableName: string, id: string, data: Partial<T>): Promise<UpdateResult> {
    try {
      const response = await this.httpClient.patch(`/${tableName}/${id}`, data)
      
      // Invalidate cache
      await this.queryCache.invalidatePattern(`${tableName}:*`)
      
      return {
        success: true,
        updatedId: id,
        modifiedCount: response.data.modifiedCount,
        timestamp: new Date()
      }
    } catch (error) {
      throw new AstraDBError(`Update failed for table ${tableName}`, error)
    }
  }

  async delete(tableName: string, id: string): Promise<DeleteResult> {
    try {
      const response = await this.httpClient.delete(`/${tableName}/${id}`)
      
      // Invalidate cache
      await this.queryCache.invalidatePattern(`${tableName}:*`)
      
      return {
        success: true,
        deletedId: id,
        deletedCount: response.data.deletedCount,
        timestamp: new Date()
      }
    } catch (error) {
      throw new AstraDBError(`Delete failed for table ${tableName}`, error)
    }
  }

  async batchOperation(operations: BatchOperation[]): Promise<BatchResult> {
    try {
      const response = await this.httpClient.post('/batch', {
        operations: operations.map(op => ({
          table: op.tableName,
          operation: op.type,
          data: op.data,
          where: op.where
        }))
      })

      // Invalidate cache for all affected tables
      const affectedTables = [...new Set(operations.map(op => op.tableName))]
      await Promise.all(
        affectedTables.map(table => 
          this.queryCache.invalidatePattern(`${table}:*`)
        )
      )

      return {
        success: true,
        results: response.data.results,
        timestamp: new Date()
      }
    } catch (error) {
      throw new AstraDBError('Batch operation failed', error)
    }
  }

  async testConnection(): Promise<ConnectionStatus> {
    try {
      const startTime = Date.now()
      await this.httpClient.get('/health')
      const endTime = Date.now()

      return {
        connected: true,
        latency: endTime - startTime,
        timestamp: new Date(),
        region: this.config.region,
        keyspace: this.config.keyspace
      }
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date(),
        region: this.config.region,
        keyspace: this.config.keyspace
      }
    }
  }

  private shouldRetry(error: any): boolean {
    const retryableErrors = this.config.retryConfig.retryableErrors
    const status = error.response?.status
    
    return (
      retryableErrors.includes(error.code) ||
      status === 429 || // Rate limit
      status === 503 || // Service unavailable
      status === 504    // Gateway timeout
    )
  }

  private async retryRequest(config: any): Promise<any> {
    const retryConfig = this.config.retryConfig
    let delay = retryConfig.baseDelay

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay))
        return await this.httpClient(config)
      } catch (error) {
        if (attempt === retryConfig.maxRetries) {
          throw error
        }

        if (retryConfig.backoffStrategy === 'exponential') {
          delay = Math.min(delay * 2, retryConfig.maxDelay)
        } else {
          delay = Math.min(delay + retryConfig.baseDelay, retryConfig.maxDelay)
        }
      }
    }
  }
}
```

### 2.2 Schema Management
```typescript
interface TableSchema {
  columns: ColumnDefinition[]
  primaryKey: PrimaryKeyDefinition
  clusteringKey?: ClusteringKeyDefinition[]
  indexes?: IndexDefinition[]
}

interface ColumnDefinition {
  name: string
  type: CassandraDataType
  nullable: boolean
  defaultValue?: any
}

enum CassandraDataType {
  TEXT = 'text',
  INT = 'int',
  BIGINT = 'bigint',
  FLOAT = 'float',
  DOUBLE = 'double',
  BOOLEAN = 'boolean',
  UUID = 'uuid',
  TIMEUUID = 'timeuuid',
  TIMESTAMP = 'timestamp',
  DATE = 'date',
  TIME = 'time',
  BLOB = 'blob',
  JSON = 'text', // JSON stored as text
  LIST = 'list',
  SET = 'set',
  MAP = 'map'
}

class SchemaManager {
  private client: AstraDBClient

  constructor(client: AstraDBClient) {
    this.client = client
  }

  async createUserTables(): Promise<void> {
    // Users table
    await this.client.createTable('users', {
      columns: [
        { name: 'id', type: CassandraDataType.UUID, nullable: false },
        { name: 'email', type: CassandraDataType.TEXT, nullable: false },
        { name: 'password_hash', type: CassandraDataType.TEXT, nullable: false },
        { name: 'name', type: CassandraDataType.TEXT, nullable: false },
        { name: 'role', type: CassandraDataType.TEXT, nullable: false },
        { name: 'avatar_url', type: CassandraDataType.TEXT, nullable: true },
        { name: 'is_active', type: CassandraDataType.BOOLEAN, nullable: false, defaultValue: true },
        { name: 'email_verified', type: CassandraDataType.BOOLEAN, nullable: false, defaultValue: false },
        { name: 'two_factor_enabled', type: CassandraDataType.BOOLEAN, nullable: false, defaultValue: false },
        { name: 'two_factor_secret', type: CassandraDataType.TEXT, nullable: true },
        { name: 'preferences', type: CassandraDataType.TEXT, nullable: true }, // JSON
        { name: 'created_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'updated_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'last_login', type: CassandraDataType.TIMESTAMP, nullable: true }
      ],
      primaryKey: { partitionKey: ['id'] },
      indexes: [
        { name: 'users_email_idx', column: 'email', unique: true },
        { name: 'users_role_idx', column: 'role' }
      ]
    })

    // User sessions table
    await this.client.createTable('user_sessions', {
      columns: [
        { name: 'id', type: CassandraDataType.UUID, nullable: false },
        { name: 'user_id', type: CassandraDataType.UUID, nullable: false },
        { name: 'token_hash', type: CassandraDataType.TEXT, nullable: false },
        { name: 'expires_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'created_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'ip_address', type: CassandraDataType.TEXT, nullable: true },
        { name: 'user_agent', type: CassandraDataType.TEXT, nullable: true },
        { name: 'is_active', type: CassandraDataType.BOOLEAN, nullable: false, defaultValue: true },
        { name: 'device_info', type: CassandraDataType.TEXT, nullable: true } // JSON
      ],
      primaryKey: { partitionKey: ['id'] },
      clusteringKey: [{ column: 'created_at', order: 'DESC' }],
      indexes: [
        { name: 'sessions_user_id_idx', column: 'user_id' },
        { name: 'sessions_token_hash_idx', column: 'token_hash' }
      ]
    })

    // Additional tables...
    await this.createContentTables()
    await this.createSystemTables()
  }

  async createContentTables(): Promise<void> {
    // Brands table
    await this.client.createTable('brands', {
      columns: [
        { name: 'id', type: CassandraDataType.UUID, nullable: false },
        { name: 'name', type: CassandraDataType.TEXT, nullable: false },
        { name: 'color', type: CassandraDataType.TEXT, nullable: false },
        { name: 'logo_url', type: CassandraDataType.TEXT, nullable: true },
        { name: 'style', type: CassandraDataType.TEXT, nullable: false }, // JSON
        { name: 'settings', type: CassandraDataType.TEXT, nullable: false }, // JSON
        { name: 'created_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'updated_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'created_by', type: CassandraDataType.UUID, nullable: false }
      ],
      primaryKey: { partitionKey: ['id'] },
      indexes: [
        { name: 'brands_name_idx', column: 'name' }
      ]
    })

    // Content table
    await this.client.createTable('content', {
      columns: [
        { name: 'id', type: CassandraDataType.UUID, nullable: false },
        { name: 'title', type: CassandraDataType.TEXT, nullable: false },
        { name: 'type', type: CassandraDataType.TEXT, nullable: false },
        { name: 'status', type: CassandraDataType.TEXT, nullable: false },
        { name: 'content', type: CassandraDataType.TEXT, nullable: false },
        { name: 'metadata', type: CassandraDataType.TEXT, nullable: false }, // JSON
        { name: 'generated_by', type: CassandraDataType.UUID, nullable: false },
        { name: 'brand_id', type: CassandraDataType.UUID, nullable: false },
        { name: 'tags', type: CassandraDataType.TEXT, nullable: true }, // JSON array
        { name: 'created_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'updated_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'published_at', type: CassandraDataType.TIMESTAMP, nullable: true },
        { name: 'scheduled_for', type: CassandraDataType.TIMESTAMP, nullable: true }
      ],
      primaryKey: { partitionKey: ['brand_id'], clusteringKey: ['created_at'] },
      clusteringKey: [{ column: 'created_at', order: 'DESC' }],
      indexes: [
        { name: 'content_type_idx', column: 'type' },
        { name: 'content_status_idx', column: 'status' },
        { name: 'content_generated_by_idx', column: 'generated_by' }
      ]
    })
  }

  async createSystemTables(): Promise<void> {
    // Application settings table
    await this.client.createTable('application_settings', {
      columns: [
        { name: 'id', type: CassandraDataType.UUID, nullable: false },
        { name: 'category', type: CassandraDataType.TEXT, nullable: false },
        { name: 'key', type: CassandraDataType.TEXT, nullable: false },
        { name: 'value', type: CassandraDataType.TEXT, nullable: false }, // JSON
        { name: 'encrypted', type: CassandraDataType.BOOLEAN, nullable: false, defaultValue: false },
        { name: 'description', type: CassandraDataType.TEXT, nullable: true },
        { name: 'created_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'updated_at', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'updated_by', type: CassandraDataType.UUID, nullable: false }
      ],
      primaryKey: { partitionKey: ['category'], clusteringKey: ['key'] },
      indexes: [
        { name: 'settings_updated_by_idx', column: 'updated_by' }
      ]
    })

    // Audit logs table
    await this.client.createTable('audit_logs', {
      columns: [
        { name: 'id', type: CassandraDataType.UUID, nullable: false },
        { name: 'user_id', type: CassandraDataType.UUID, nullable: true },
        { name: 'action', type: CassandraDataType.TEXT, nullable: false },
        { name: 'resource', type: CassandraDataType.TEXT, nullable: false },
        { name: 'resource_id', type: CassandraDataType.TEXT, nullable: true },
        { name: 'details', type: CassandraDataType.TEXT, nullable: true }, // JSON
        { name: 'ip_address', type: CassandraDataType.TEXT, nullable: true },
        { name: 'user_agent', type: CassandraDataType.TEXT, nullable: true },
        { name: 'timestamp', type: CassandraDataType.TIMESTAMP, nullable: false },
        { name: 'success', type: CassandraDataType.BOOLEAN, nullable: false, defaultValue: true },
        { name: 'error_message', type: CassandraDataType.TEXT, nullable: true }
      ],
      primaryKey: { partitionKey: ['timestamp'] },
      clusteringKey: [{ column: 'timestamp', order: 'DESC' }],
      indexes: [
        { name: 'audit_user_id_idx', column: 'user_id' },
        { name: 'audit_action_idx', column: 'action' },
        { name: 'audit_resource_idx', column: 'resource' }
      ]
    })
  }
}
```

## 3. Data Migration Strategy

### 3.1 Migration Controller
```typescript
class MigrationController {
  private sqliteClient: SQLiteClient
  private astraClient: AstraDBClient
  private schemaManager: SchemaManager

  constructor(sqliteClient: SQLiteClient, astraClient: AstraDBClient) {
    this.sqliteClient = sqliteClient
    this.astraClient = astraClient
    this.schemaManager = new SchemaManager(astraClient)
  }

  async executeMigration(): Promise<MigrationResult> {
    const migrationId = `migration_${Date.now()}`
    const startTime = Date.now()

    try {
      // Phase 1: Setup AstraDB schema
      await this.setupAstraDBSchema()

      // Phase 2: Migrate data
      const migrationStats = await this.migrateData()

      // Phase 3: Validate migration
      await this.validateMigration()

      // Phase 4: Update application configuration
      await this.updateApplicationConfig()

      const endTime = Date.now()
      const duration = endTime - startTime

      return {
        id: migrationId,
        success: true,
        duration,
        statistics: migrationStats,
        timestamp: new Date()
      }

    } catch (error) {
      await this.rollbackMigration(migrationId)
      throw new MigrationError(`Migration failed: ${error.message}`, error)
    }
  }

  private async setupAstraDBSchema(): Promise<void> {
    console.log('Setting up AstraDB schema...')
    
    // Create all tables
    await this.schemaManager.createUserTables()
    await this.schemaManager.createContentTables()
    await this.schemaManager.createSystemTables()
    
    console.log('AstraDB schema setup completed')
  }

  private async migrateData(): Promise<MigrationStatistics> {
    const stats: MigrationStatistics = {
      tablesProcessed: 0,
      recordsMigrated: 0,
      errors: [],
      warnings: []
    }

    const tables = await this.sqliteClient.getTables()
    
    for (const table of tables) {
      try {
        console.log(`Migrating table: ${table.name}`)
        
        const tableStats = await this.migrateTable(table)
        stats.tablesProcessed++
        stats.recordsMigrated += tableStats.recordCount
        
        console.log(`Migrated ${tableStats.recordCount} records from ${table.name}`)
        
      } catch (error) {
        stats.errors.push({
          table: table.name,
          error: error.message,
          timestamp: new Date()
        })
        console.error(`Failed to migrate table ${table.name}:`, error)
      }
    }

    return stats
  }

  private async migrateTable(table: SQLiteTable): Promise<TableMigrationResult> {
    const batchSize = 1000
    let offset = 0
    let totalRecords = 0

    while (true) {
      const records = await this.sqliteClient.getRecords(table.name, {
        limit: batchSize,
        offset
      })

      if (records.length === 0) break

      // Transform records for AstraDB
      const transformedRecords = records.map(record => 
        this.transformRecord(table.name, record)
      )

      // Batch insert to AstraDB
      await this.astraClient.batchInsert(table.name, transformedRecords)

      totalRecords += records.length
      offset += batchSize

      // Progress logging
      if (totalRecords % 10000 === 0) {
        console.log(`Migrated ${totalRecords} records from ${table.name}...`)
      }
    }

    return {
      tableName: table.name,
      recordCount: totalRecords,
      timestamp: new Date()
    }
  }

  private transformRecord(tableName: string, record: any): any {
    // Transform SQLite record to AstraDB format
    const transformed = { ...record }

    // Handle ID transformation
    if (transformed.id && typeof transformed.id === 'number') {
      transformed.id = this.generateUUID()
      transformed.original_id = record.id
    }

    // Handle date transformations
    const dateFields = this.getDateFields(tableName)
    dateFields.forEach(field => {
      if (transformed[field]) {
        transformed[field] = new Date(transformed[field])
      }
    })

    // Handle JSON fields
    const jsonFields = this.getJSONFields(tableName)
    jsonFields.forEach(field => {
      if (transformed[field] && typeof transformed[field] === 'string') {
        try {
          JSON.parse(transformed[field]) // Validate JSON
        } catch {
          transformed[field] = JSON.stringify(transformed[field])
        }
      }
    })

    return transformed
  }

  private async validateMigration(): Promise<void> {
    console.log('Validating migration...')

    const tables = await this.sqliteClient.getTables()
    
    for (const table of tables) {
      const sqliteCount = await this.sqliteClient.getRecordCount(table.name)
      const astraCount = await this.astraClient.getRecordCount(table.name)
      
      if (sqliteCount !== astraCount) {
        throw new Error(
          `Record count mismatch for table ${table.name}: ` +
          `SQLite=${sqliteCount}, AstraDB=${astraCount}`
        )
      }
    }

    console.log('Migration validation completed')
  }

  private async updateApplicationConfig(): Promise<void> {
    // Update environment variables to use AstraDB
    const envService = new EnvironmentService()
    
    await envService.updateVariable('DATABASE_TYPE', 'astradb')
    await envService.updateVariable('DATABASE_URL', process.env.ASTRADB_DATABASE_URL!)
    
    // Disable SQLite database URL
    await envService.removeVariable('SQLITE_DATABASE_URL')
    
    console.log('Application configuration updated')
  }

  private async rollbackMigration(migrationId: string): Promise<void> {
    console.log(`Rolling back migration ${migrationId}...`)
    
    try {
      // Drop all AstraDB tables
      const tables = await this.astraClient.getTables()
      await Promise.all(tables.map(table => this.astraClient.dropTable(table.name)))
      
      // Restore original configuration
      const envService = new EnvironmentService()
      await envService.updateVariable('DATABASE_TYPE', 'sqlite')
      
      console.log('Migration rollback completed')
    } catch (error) {
      console.error('Rollback failed:', error)
      throw error
    }
  }
}
```

### 3.2 Data Transformation
```typescript
class DataTransformer {
  private fieldMappings: Map<string, FieldMapping[]> = new Map()

  constructor() {
    this.setupFieldMappings()
  }

  private setupFieldMappings(): void {
    // User table mappings
    this.fieldMappings.set('users', [
      { source: 'id', target: 'id', transform: 'uuid' },
      { source: 'email', target: 'email', transform: 'lowercase' },
      { source: 'password_hash', target: 'password_hash', transform: 'none' },
      { source: 'name', target: 'name', transform: 'trim' },
      { source: 'role', target: 'role', transform: 'lowercase' },
      { source: 'avatar', target: 'avatar_url', transform: 'url' },
      { source: 'active', target: 'is_active', transform: 'boolean' },
      { source: 'preferences', target: 'preferences', transform: 'json' },
      { source: 'created_at', target: 'created_at', transform: 'timestamp' },
      { source: 'updated_at', target: 'updated_at', transform: 'timestamp' }
    ])

    // Content table mappings
    this.fieldMappings.set('content', [
      { source: 'id', target: 'id', transform: 'uuid' },
      { source: 'title', target: 'title', transform: 'trim' },
      { source: 'type', target: 'type', transform: 'lowercase' },
      { source: 'status', target: 'status', transform: 'lowercase' },
      { source: 'content', target: 'content', transform: 'text' },
      { source: 'metadata', target: 'metadata', transform: 'json' },
      { source: 'brand_id', target: 'brand_id', transform: 'uuid' },
      { source: 'tags', target: 'tags', transform: 'json_array' },
      { source: 'created_at', target: 'created_at', transform: 'timestamp' },
      { source: 'updated_at', target: 'updated_at', transform: 'timestamp' }
    ])
  }

  transformRecord(tableName: string, record: any): any {
    const mappings = this.fieldMappings.get(tableName)
    if (!mappings) return record

    const transformed: any = {}

    mappings.forEach(mapping => {
      const sourceValue = record[mapping.source]
      transformed[mapping.target] = this.applyTransform(sourceValue, mapping.transform)
    })

    return transformed
  }

  private applyTransform(value: any, transform: string): any {
    if (value === null || value === undefined) return value

    switch (transform) {
      case 'uuid':
        return typeof value === 'number' ? this.generateUUIDFromNumber(value) : value
      
      case 'timestamp':
        return new Date(value)
      
      case 'boolean':
        return Boolean(value)
      
      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value)
      
      case 'json_array':
        return Array.isArray(value) ? JSON.stringify(value) : value
      
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value
      
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value
      
      case 'trim':
        return typeof value === 'string' ? value.trim() : value
      
      case 'url':
        return this.validateUrl(value) ? value : null
      
      case 'text':
        return String(value)
      
      default:
        return value
    }
  }

  private generateUUIDFromNumber(num: number): string {
    // Generate deterministic UUID from number for consistency
    const hex = num.toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(1, 4)}-${hex.slice(0, 12)}`
  }

  private validateUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}
```

## 4. Query Optimization

### 4.1 Query Builder
```typescript
class AstraDBQueryBuilder {
  private tableName: string
  private whereConditions: WhereCondition[] = []
  private selectFields: string[] = []
  private orderBy: OrderByClause[] = []
  private limitValue?: number
  private pageState?: string

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(fields: string[]): this {
    this.selectFields = fields
    return this
  }

  where(field: string, operator: string, value: any): this {
    this.whereConditions.push({ field, operator, value })
    return this
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderBy.push({ field, direction })
    return this
  }

  limit(count: number): this {
    this.limitValue = count
    return this
  }

  page(pageState: string): this {
    this.pageState = pageState
    return this
  }

  build(): QueryOptions {
    return {
      select: this.selectFields.length > 0 ? this.selectFields : undefined,
      where: this.whereConditions.length > 0 ? this.whereConditions : undefined,
      orderBy: this.orderBy.length > 0 ? this.orderBy : undefined,
      limit: this.limitValue,
      pageState: this.pageState
    }
  }

  async execute<T>(client: AstraDBClient): Promise<QueryResult<T>> {
    return await client.query<T>(this.tableName, this.build())
  }
}

// Usage examples
const users = await new AstraDBQueryBuilder('users')
  .select(['id', 'name', 'email', 'role'])
  .where('is_active', '=', true)
  .where('role', 'IN', ['admin', 'editor'])
  .orderBy('created_at', 'DESC')
  .limit(50)
  .execute<User>(astraClient)

const content = await new AstraDBQueryBuilder('content')
  .where('brand_id', '=', brandId)
  .where('status', '=', 'published')
  .where('created_at', '>', new Date('2024-01-01'))
  .orderBy('created_at', 'DESC')
  .limit(20)
  .execute<Content>(astraClient)
```

### 4.2 Performance Monitoring
```typescript
class PerformanceMonitor {
  private metrics: QueryMetrics[] = []
  private slowQueryThreshold: number = 1000 // 1 second

  recordQuery(tableName: string, query: QueryOptions, executionTime: number): void {
    const metric: QueryMetrics = {
      tableName,
      query,
      executionTime,
      timestamp: new Date(),
      slow: executionTime > this.slowQueryThreshold
    }

    this.metrics.push(metric)

    if (metric.slow) {
      console.warn(`Slow query detected: ${tableName} (${executionTime}ms)`, query)
    }

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  getSlowQueries(): QueryMetrics[] {
    return this.metrics.filter(m => m.slow)
  }

  getAverageExecutionTime(tableName?: string): number {
    const filteredMetrics = tableName 
      ? this.metrics.filter(m => m.tableName === tableName)
      : this.metrics

    if (filteredMetrics.length === 0) return 0

    const totalTime = filteredMetrics.reduce((sum, m) => sum + m.executionTime, 0)
    return totalTime / filteredMetrics.length
  }

  getQueryStats(): PerformanceStats {
    return {
      totalQueries: this.metrics.length,
      averageExecutionTime: this.getAverageExecutionTime(),
      slowQueries: this.getSlowQueries().length,
      tableStats: this.getTableStats()
    }
  }

  private getTableStats(): Record<string, TableStats> {
    const stats: Record<string, TableStats> = {}

    this.metrics.forEach(metric => {
      if (!stats[metric.tableName]) {
        stats[metric.tableName] = {
          queryCount: 0,
          totalExecutionTime: 0,
          slowQueries: 0
        }
      }

      stats[metric.tableName].queryCount++
      stats[metric.tableName].totalExecutionTime += metric.executionTime
      if (metric.slow) {
        stats[metric.tableName].slowQueries++
      }
    })

    // Calculate averages
    Object.keys(stats).forEach(tableName => {
      const tableStats = stats[tableName]
      tableStats.averageExecutionTime = tableStats.totalExecutionTime / tableStats.queryCount
    })

    return stats
  }
}
```

## 5. Caching Strategy

### 5.1 Query Cache Implementation
```typescript
class QueryCache {
  private cache: Map<string, CacheEntry> = new Map()
  private maxSize: number = 10000
  private defaultTtl: number = 300 // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      return null
    }

    entry.hits++
    entry.lastAccessed = Date.now()
    return entry.value as T
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTtl): Promise<void> {
    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed()
    }

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
      hits: 0,
      lastAccessed: Date.now()
    }

    this.cache.set(key, entry)
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = Array.from(this.cache.keys())
    const regex = new RegExp(pattern.replace('*', '.*'))

    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    })
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values())
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0)
    const expiredEntries = entries.filter(entry => this.isExpired(entry))

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalHits > 0 ? totalHits / this.cache.size : 0,
      expiredEntries: expiredEntries.length,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    this.cache.forEach((entry, key) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    })

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0
    this.cache.forEach((entry, key) => {
      size += key.length * 2 // String characters are 2 bytes
      size += JSON.stringify(entry.value).length * 2
      size += 64 // Overhead for entry object
    })
    return size
  }
}
```

## 6. Error Handling and Resilience

### 6.1 Error Classes
```typescript
class AstraDBError extends Error {
  public code: string
  public details: any
  public timestamp: Date

  constructor(message: string, originalError?: any) {
    super(message)
    this.name = 'AstraDBError'
    this.code = originalError?.code || 'UNKNOWN_ERROR'
    this.details = originalError
    this.timestamp = new Date()
  }
}

class ConnectionError extends AstraDBError {
  constructor(message: string, originalError?: any) {
    super(message, originalError)
    this.name = 'ConnectionError'
    this.code = 'CONNECTION_ERROR'
  }
}

class QueryError extends AstraDBError {
  public query: string

  constructor(message: string, query: string, originalError?: any) {
    super(message, originalError)
    this.name = 'QueryError'
    this.code = 'QUERY_ERROR'
    this.query = query
  }
}

class ValidationError extends AstraDBError {
  public validationErrors: ValidationResult[]

  constructor(message: string, validationErrors: ValidationResult[]) {
    super(message)
    this.name = 'ValidationError'
    this.code = 'VALIDATION_ERROR'
    this.validationErrors = validationErrors
  }
}
```

### 6.2 Circuit Breaker
```typescript
class CircuitBreaker {
  private failures: number = 0
  private lastFailureTime: number = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private monitoringPeriod: number = 10000 // 10 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  getState(): string {
    return this.state
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null
    }
  }
}
```

## 7. Configuration and Environment

### 7.1 Environment Configuration
```typescript
interface AstraDBEnvironmentConfig {
  development: AstraDBConfig
  staging: AstraDBConfig
  production: AstraDBConfig
}

const astraConfig: AstraDBEnvironmentConfig = {
  development: {
    applicationToken: process.env.ASTRADB_DEV_TOKEN!,
    databaseId: process.env.ASTRADB_DEV_DATABASE_ID!,
    keyspace: 'eesystem_curation_dev',
    region: 'us-east-1',
    baseUrl: 'https://api.astra.datastax.com',
    timeout: 30000,
    retryConfig: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 10000,
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
    },
    connectionPool: {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeout: 30000,
      idleTimeout: 300000,
      reapInterval: 1000
    }
  },
  staging: {
    applicationToken: process.env.ASTRADB_STAGING_TOKEN!,
    databaseId: process.env.ASTRADB_STAGING_DATABASE_ID!,
    keyspace: 'eesystem_curation_staging',
    region: 'us-east-1',
    baseUrl: 'https://api.astra.datastax.com',
    timeout: 30000,
    retryConfig: {
      maxRetries: 5,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 30000,
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
    },
    connectionPool: {
      maxConnections: 20,
      minConnections: 5,
      acquireTimeout: 30000,
      idleTimeout: 300000,
      reapInterval: 1000
    }
  },
  production: {
    applicationToken: process.env.ASTRADB_PROD_TOKEN!,
    databaseId: process.env.ASTRADB_PROD_DATABASE_ID!,
    keyspace: 'eesystem_curation',
    region: 'us-east-1',
    baseUrl: 'https://api.astra.datastax.com',
    timeout: 60000,
    retryConfig: {
      maxRetries: 10,
      backoffStrategy: 'exponential',
      baseDelay: 2000,
      maxDelay: 60000,
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
    },
    connectionPool: {
      maxConnections: 50,
      minConnections: 10,
      acquireTimeout: 60000,
      idleTimeout: 600000,
      reapInterval: 5000
    }
  }
}
```

This comprehensive AstraDB integration strategy provides:
- Production-ready Data API client with connection pooling
- Complete schema management and migration tools
- Query optimization with caching and performance monitoring
- Robust error handling with circuit breaker pattern
- Comprehensive testing and validation capabilities
- Environment-specific configuration management
- Data transformation and mapping utilities
- Performance monitoring and optimization tools