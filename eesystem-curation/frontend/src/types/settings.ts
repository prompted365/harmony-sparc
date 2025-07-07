// EESystem Settings Types
export interface SettingsConfig {
  general: GeneralSettings
  database: DatabaseSettings
  apiKeys: ApiKeySettings
  deployment: DeploymentSettings
}

export interface GeneralSettings {
  appName: string
  appDescription: string
  environment: 'development' | 'production' | 'staging'
  debugMode: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  maxUploadSize: number
  allowedFileTypes: string[]
  theme: 'light' | 'dark' | 'system'
  timezone: string
  dateFormat: string
  language: string
}

export interface DatabaseSettings {
  provider: 'astradb' | 'postgresql' | 'mongodb'
  astraDb: AstraDbConfig
  postgresql: PostgresqlConfig
  mongodb: MongoDbConfig
  connectionPoolSize: number
  connectionTimeout: number
  queryTimeout: number
  enableQueryLogging: boolean
  enableMetrics: boolean
}

export interface AstraDbConfig {
  endpoint: string
  applicationToken: string
  keyspace: string
  region: string
  cloudProvider: 'aws' | 'gcp' | 'azure'
  connectionStatus: 'connected' | 'disconnected' | 'testing' | 'error'
  lastConnectionTest?: Date
  errorMessage?: string
  performanceMetrics?: {
    avgResponseTime: number
    requestsPerSecond: number
    errorRate: number
  }
}

export interface PostgresqlConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
  connectionStatus: 'connected' | 'disconnected' | 'testing' | 'error'
  lastConnectionTest?: Date
  errorMessage?: string
}

export interface MongoDbConfig {
  connectionString: string
  database: string
  username: string
  password: string
  ssl: boolean
  connectionStatus: 'connected' | 'disconnected' | 'testing' | 'error'
  lastConnectionTest?: Date
  errorMessage?: string
}

export interface ApiKeySettings {
  llmRouter: LlmRouterConfig
  openai: OpenAiConfig
  anthropic: AnthropicConfig
  elevenlabs: ElevenLabsConfig
  stability: StabilityConfig
  vercel: VercelConfig
  rateLimiting: RateLimitingConfig
}

export interface LlmRouterConfig {
  provider: 'requesty' | 'openrouter' | 'together'
  requestyConfig: RequestyConfig
  openRouterConfig: OpenRouterConfig
  togetherConfig: TogetherConfig
}

export interface RequestyConfig {
  apiKey: string
  baseUrl: string
  defaultModel: string
  enableCaching: boolean
  cacheTimeout: number
  enableMetrics: boolean
  requestTimeout: number
  retryAttempts: number
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
  usage?: {
    requestsToday: number
    tokensToday: number
    costToday: number
    billingCycle: 'monthly' | 'yearly'
    remainingCredits: number
  }
}

export interface OpenRouterConfig {
  apiKey: string
  baseUrl: string
  defaultModel: string
  enableCaching: boolean
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
}

export interface TogetherConfig {
  apiKey: string
  baseUrl: string
  defaultModel: string
  enableCaching: boolean
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
}

export interface OpenAiConfig {
  apiKey: string
  organization?: string
  baseUrl: string
  defaultModel: string
  enableFunctionCalling: boolean
  maxTokens: number
  temperature: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
  usage?: {
    requestsToday: number
    tokensToday: number
    costToday: number
    billingCycle: 'monthly' | 'yearly'
    remainingCredits: number
  }
}

export interface AnthropicConfig {
  apiKey: string
  baseUrl: string
  defaultModel: string
  maxTokens: number
  temperature: number
  topP: number
  topK: number
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
  usage?: {
    requestsToday: number
    tokensToday: number
    costToday: number
    billingCycle: 'monthly' | 'yearly'
    remainingCredits: number
  }
}

export interface ElevenLabsConfig {
  apiKey: string
  baseUrl: string
  defaultVoice: string
  stability: number
  similarityBoost: number
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
}

export interface StabilityConfig {
  apiKey: string
  baseUrl: string
  defaultEngine: string
  steps: number
  cfgScale: number
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
}

export interface VercelConfig {
  apiKey: string
  teamId?: string
  projectId?: string
  deploymentUrl?: string
  status: 'active' | 'inactive' | 'error'
  lastTest?: Date
  errorMessage?: string
}

export interface RateLimitingConfig {
  enableRateLimiting: boolean
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  burstLimit: number
  enableIpWhitelist: boolean
  ipWhitelist: string[]
  enableUserLimits: boolean
  userLimits: {
    [userId: string]: {
      requestsPerMinute: number
      requestsPerHour: number
      requestsPerDay: number
    }
  }
}

export interface DeploymentSettings {
  provider: 'railway' | 'vercel' | 'netlify' | 'aws' | 'gcp' | 'azure'
  railway: RailwayConfig
  vercel: VercelDeploymentConfig
  netlify: NetlifyConfig
  aws: AwsConfig
  gcp: GcpConfig
  azure: AzureConfig
  buildSettings: BuildSettings
  environmentVariables: EnvironmentVariable[]
}

export interface RailwayConfig {
  apiKey: string
  projectId: string
  serviceId: string
  environmentId: string
  deploymentStatus: 'deployed' | 'building' | 'failed' | 'pending'
  lastDeployment?: Date
  buildLogs?: string[]
  deploymentUrl?: string
  customDomain?: string
  healthCheckUrl?: string
  status: 'active' | 'inactive' | 'error'
  errorMessage?: string
  metrics?: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    networkIn: number
    networkOut: number
    uptime: number
  }
}

export interface VercelDeploymentConfig {
  apiKey: string
  teamId?: string
  projectId: string
  deploymentStatus: 'deployed' | 'building' | 'failed' | 'pending'
  lastDeployment?: Date
  deploymentUrl?: string
  customDomain?: string
  status: 'active' | 'inactive' | 'error'
  errorMessage?: string
}

export interface NetlifyConfig {
  apiKey: string
  siteId: string
  deploymentStatus: 'deployed' | 'building' | 'failed' | 'pending'
  lastDeployment?: Date
  deploymentUrl?: string
  customDomain?: string
  status: 'active' | 'inactive' | 'error'
  errorMessage?: string
}

export interface AwsConfig {
  accessKeyId: string
  secretAccessKey: string
  region: string
  s3Bucket?: string
  cloudFrontDistribution?: string
  lambdaFunction?: string
  status: 'active' | 'inactive' | 'error'
  errorMessage?: string
}

export interface GcpConfig {
  projectId: string
  serviceAccountKey: string
  region: string
  cloudStorageBucket?: string
  cloudRunService?: string
  status: 'active' | 'inactive' | 'error'
  errorMessage?: string
}

export interface AzureConfig {
  subscriptionId: string
  resourceGroup: string
  appService: string
  region: string
  storageAccount?: string
  status: 'active' | 'inactive' | 'error'
  errorMessage?: string
}

export interface BuildSettings {
  buildCommand: string
  outputDirectory: string
  nodeVersion: string
  environmentVariables: EnvironmentVariable[]
  enableCache: boolean
  cacheDirectory: string
  buildTimeout: number
  enableOptimizations: boolean
  enableSourceMaps: boolean
  enableMinification: boolean
}

export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  description?: string
  isRequired: boolean
  isSecret: boolean
  environment: 'development' | 'production' | 'staging' | 'all'
  category: 'database' | 'api' | 'deployment' | 'feature' | 'other'
  validation?: {
    type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'json'
    pattern?: string
    minLength?: number
    maxLength?: number
    required?: boolean
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
  severity: 'error' | 'warning' | 'info'
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
  severity: 'warning' | 'info'
}

export interface SettingsFormData {
  [key: string]: any
}

export interface SettingsFormErrors {
  [key: string]: string[]
}

export interface SettingsFormState {
  data: SettingsFormData
  errors: SettingsFormErrors
  isSubmitting: boolean
  isDirty: boolean
  isValid: boolean
  touchedFields: Set<string>
}

// Connection test results
export interface ConnectionTestResult {
  success: boolean
  message: string
  responseTime?: number
  details?: any
  timestamp: Date
}

// Import/Export types
export interface SettingsExport {
  version: string
  timestamp: Date
  settings: Partial<SettingsConfig>
  metadata: {
    appVersion: string
    exportedBy: string
    environment: string
  }
}

export interface ImportResult {
  success: boolean
  message: string
  importedSettings: string[]
  skippedSettings: string[]
  errors: string[]
}

// Settings tabs
export type SettingsTab = 'general' | 'database' | 'api-keys' | 'deployment'

// Settings actions
export type SettingsAction = 
  | 'save'
  | 'reset'
  | 'test-connection'
  | 'export'
  | 'import'
  | 'validate'
  | 'restore-defaults'