export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  avatar?: string
  preferences: UserPreferences
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  notifications: boolean
  autoSave: boolean
  defaultContentType: ContentType
}

export interface Brand {
  id: string
  name: string
  color: string
  logo?: string
  style: BrandStyle
  settings: BrandSettings
}

export interface BrandStyle {
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative'
}

export interface BrandSettings {
  autoPublish: boolean
  contentGuidelines: string[]
  socialMediaAccounts: SocialMediaAccount[]
}

export interface SocialMediaAccount {
  platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube'
  handle: string
  accessToken?: string
  connected: boolean
}

export type ContentType = 'article' | 'social-post' | 'newsletter' | 'press-release' | 'blog-post' | 'product-description'

export interface Content {
  id: string
  title: string
  type: ContentType
  status: ContentStatus
  content: string
  metadata: ContentMetadata
  generatedBy: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  scheduledFor?: Date
  tags: string[]
  brandId: string
}

export type ContentStatus = 'draft' | 'generating' | 'review' | 'approved' | 'scheduled' | 'published' | 'archived'

export interface ContentMetadata {
  wordCount: number
  readingTime: number
  seoScore: number
  keywords: string[]
  targetAudience: string[]
  tone: string
  style: string
}

export interface AIAgent {
  id: string
  name: string
  type: AgentType
  status: AgentStatus
  capabilities: string[]
  currentTask?: string
  performance: AgentPerformance
  config: AgentConfig
}

export type AgentType = 'content-writer' | 'seo-optimizer' | 'social-media' | 'researcher' | 'editor' | 'scheduler'

export type AgentStatus = 'idle' | 'working' | 'paused' | 'error' | 'offline'

export interface AgentPerformance {
  tasksCompleted: number
  averageQuality: number
  averageSpeed: number
  successRate: number
  lastActivity: Date
}

export interface AgentConfig {
  maxConcurrentTasks: number
  preferredContentTypes: ContentType[]
  qualityThreshold: number
  autoApprove: boolean
}

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploadedAt: Date
  processedAt?: Date
  extractedContent?: string
  metadata?: Record<string, any>
}

export interface ContentGeneration {
  id: string
  type: ContentType
  prompt: string
  parameters: GenerationParameters
  status: 'pending' | 'generating' | 'completed' | 'failed'
  result?: string
  error?: string
  agentId: string
  createdAt: Date
  completedAt?: Date
  brandId: string
}

export interface GenerationParameters {
  length: 'short' | 'medium' | 'long'
  tone: string
  style: string
  keywords: string[]
  targetAudience: string[]
  includeImages: boolean
  includeSeo: boolean
}

export interface Analytics {
  contentPerformance: ContentPerformance[]
  agentMetrics: AgentMetrics[]
  brandAnalytics: BrandAnalytics
  timeRange: string
}

export interface ContentPerformance {
  contentId: string
  title: string
  type: ContentType
  views: number
  engagement: number
  shares: number
  clicks: number
  conversions: number
  publishedAt: Date
}

export interface AgentMetrics {
  agentId: string
  agentName: string
  type: AgentType
  tasksCompleted: number
  averageQuality: number
  efficiency: number
  uptime: number
}

export interface BrandAnalytics {
  totalContent: number
  contentByType: Record<ContentType, number>
  publishingSchedule: ScheduleData[]
  performanceMetrics: PerformanceMetrics
  totalReach: number
}

export interface ScheduleData {
  date: string
  count: number
  types: ContentType[]
}

export interface PerformanceMetrics {
  avgEngagement: number
  avgViews: number
  avgShares: number
  totalReach: number
  growthRate: number
}

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: Date
}

export interface NotificationMessage {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: Date
  read: boolean
  actionUrl?: string
}

// Re-export settings types
export * from './settings'