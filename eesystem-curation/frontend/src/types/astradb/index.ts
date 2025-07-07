// AstraDB Types for EESystem Content Curation Platform

export interface AstraDBConfig {
  databaseId: string
  region: string
  applicationToken: string
  namespace?: string
  collection?: string
  endpoint?: string
  environment?: 'prod' | 'dev'
}

export interface AstraDBConnection {
  id: string
  name: string
  config: AstraDBConfig
  status: 'connected' | 'disconnected' | 'error'
  lastConnected?: Date
  healthStatus?: AstraDBHealthStatus
}

export interface AstraDBHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  timestamp: Date
  metrics: {
    documentsCount: number
    collectionsCount: number
    indexesCount: number
    storageUsed: number
  }
}

// Content Storage Schema
export interface ContentDocument {
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

export interface ContentMetadata {
  wordCount: number
  readingTime: number
  seoScore: number
  keywords: string[]
  targetAudience: string[]
  tone: string
  style: string
  extractedEntities?: string[]
  sentiment?: number
  readabilityScore?: number
}

// User Data Schema
export interface UserDocument {
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

export interface UserPreferences {
  theme: string
  notifications: boolean
  autoSave: boolean
  defaultContentType: string
  language: string
  timezone: string
}

export interface UserSettings {
  apiQuota: number
  maxConcurrentGenerations: number
  preferredAgents: string[]
  qualityThreshold: number
  autoApprove: boolean
  dataRetentionDays: number
}

// Brand Data Schema
export interface BrandDocument {
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

export interface BrandStyle {
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  tone: string
  logoUrl?: string
  brandGuidelines?: string[]
}

export interface BrandSettings {
  autoPublish: boolean
  contentGuidelines: string[]
  socialMediaAccounts: SocialMediaAccount[]
  approvalWorkflow: boolean
  schedulingEnabled: boolean
}

export interface SocialMediaAccount {
  platform: string
  handle: string
  accessToken?: string
  connected: boolean
  lastSync?: Date
}

// Analytics Data Schema
export interface AnalyticsDocument {
  _id: string
  contentId: string
  brandId: string
  userId: string
  eventType: string
  eventData: Record<string, any>
  timestamp: Date
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  location?: GeolocationData
}

export interface GeolocationData {
  country: string
  region: string
  city: string
  latitude?: number
  longitude?: number
}

// AI Agent Data Schema
export interface AgentDocument {
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

export interface AgentPerformance {
  tasksCompleted: number
  averageQuality: number
  averageSpeed: number
  successRate: number
  lastActivity: Date
  averageResponseTime: number
  errorRate: number
}

export interface AgentConfig {
  maxConcurrentTasks: number
  preferredContentTypes: string[]
  qualityThreshold: number
  autoApprove: boolean
  modelProvider: string
  modelName: string
  temperature: number
  maxTokens: number
}

// Vector Search Types
export interface VectorSearchOptions {
  vector: number[]
  limit?: number
  includeSimilarity?: boolean
  filter?: Record<string, any>
  sort?: Record<string, any>
}

export interface VectorSearchResult<T = any> {
  document: T
  similarity: number
  distance: number
}

export interface VectorSearchResponse<T = any> {
  results: VectorSearchResult<T>[]
  total: number
  took: number
}

// Database Operations
export interface AstraDBOperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  insertedId?: string
  modifiedCount?: number
  deletedCount?: number
  upsertedId?: string
}

export interface AstraDBBatchResult {
  insertedIds: string[]
  modifiedCount: number
  deletedCount: number
  errors: string[]
}

// Query Options
export interface AstraDBQueryOptions {
  limit?: number
  skip?: number
  sort?: Record<string, 1 | -1>
  projection?: Record<string, 1 | 0>
  includeSimilarity?: boolean
}

export interface AstraDBUpdateOptions {
  upsert?: boolean
  multi?: boolean
  returnDocument?: 'before' | 'after'
}

// Cache Types
export interface CacheConfig {
  ttl: number
  maxSize: number
  enabled: boolean
  keyPrefix: string
}

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: Date
  ttl: number
  hits: number
}

// Error Types
export interface AstraDBError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: Date
  operation: string
}

// Migration Types
export interface MigrationScript {
  version: string
  description: string
  up: () => Promise<void>
  down: () => Promise<void>
}

export interface MigrationStatus {
  version: string
  appliedAt: Date
  executionTime: number
  status: 'success' | 'failed' | 'pending'
}

// Backup Types
export interface BackupConfig {
  enabled: boolean
  schedule: string
  retention: number
  destination: string
  encryption: boolean
}

export interface BackupStatus {
  id: string
  status: 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  size: number
  recordCount: number
  error?: string
}

// Monitoring Types
export interface PerformanceMetrics {
  operationType: string
  duration: number
  timestamp: Date
  success: boolean
  error?: string
}

export interface ConnectionMetrics {
  activeConnections: number
  totalConnections: number
  failedConnections: number
  averageResponseTime: number
  uptime: number
}

// Settings Types
export interface DatabaseSettings {
  connections: AstraDBConnection[]
  defaultConnection: string
  cache: CacheConfig
  backup: BackupConfig
  monitoring: {
    enabled: boolean
    sampleRate: number
    alertThresholds: {
      responseTime: number
      errorRate: number
      connectionFailures: number
    }
  }
}