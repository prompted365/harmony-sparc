/**
 * Shared types for EESystem Content Curation Platform
 */

// User types
export interface User {
  id: string
  email: string
  username: string
  firstName?: string
  lastName?: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export enum UserRole {
  ADMIN = 'admin',
  CURATOR = 'curator',
  CONTRIBUTOR = 'contributor',
  VIEWER = 'viewer'
}

// Content types
export interface Content {
  id: string
  title: string
  description?: string
  type: ContentType
  category: ContentCategory
  tags: string[]
  url?: string
  filePath?: string
  metadata: ContentMetadata
  status: ContentStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export enum ContentType {
  ARTICLE = 'article',
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  DOCUMENT = 'document',
  RESEARCH = 'research',
  TESTIMONIAL = 'testimonial',
  CASE_STUDY = 'case_study'
}

export enum ContentCategory {
  TECHNOLOGY = 'technology',
  HEALTH = 'health',
  WELLNESS = 'wellness',
  RESEARCH = 'research',
  EDUCATION = 'education',
  TESTIMONIALS = 'testimonials',
  CASE_STUDIES = 'case_studies',
  NEWS = 'news',
  EVENTS = 'events'
}

export enum ContentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  REJECTED = 'rejected'
}

export interface ContentMetadata {
  fileSize?: number
  duration?: number
  resolution?: string
  format?: string
  source?: string
  author?: string
  publishedDate?: string
  aiGenerated?: boolean
  qualityScore?: number
  engagementMetrics?: EngagementMetrics
}

export interface EngagementMetrics {
  views: number
  likes: number
  shares: number
  comments: number
  downloads: number
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  errors?: string[]
}

export interface PaginatedResponse<T = any> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Authentication types
export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  username: string
  firstName?: string
  lastName?: string
}

// Filter and search types
export interface ContentFilter {
  type?: ContentType[]
  category?: ContentCategory[]
  status?: ContentStatus[]
  tags?: string[]
  createdBy?: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface SearchOptions {
  query?: string
  filter?: ContentFilter
  sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
  page?: number
  pageSize?: number
}

// File upload types
export interface FileUpload {
  file: File
  type: ContentType
  category: ContentCategory
  title: string
  description?: string
  tags?: string[]
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

// Curation workflow types
export interface CurationWorkflow {
  id: string
  name: string
  description: string
  steps: CurationStep[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CurationStep {
  id: string
  name: string
  description: string
  type: CurationStepType
  config: CurationStepConfig
  order: number
  isRequired: boolean
}

export enum CurationStepType {
  REVIEW = 'review',
  CATEGORIZATION = 'categorization',
  TAGGING = 'tagging',
  QUALITY_CHECK = 'quality_check',
  APPROVAL = 'approval'
}

export interface CurationStepConfig {
  assignedTo?: string[]
  requiredFields?: string[]
  validationRules?: ValidationRule[]
  automationRules?: AutomationRule[]
}

export interface ValidationRule {
  field: string
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  value?: any
  message: string
}

export interface AutomationRule {
  condition: string
  action: string
  parameters?: Record<string, any>
}

// Dashboard and analytics types
export interface DashboardStats {
  totalContent: number
  pendingReview: number
  publishedToday: number
  totalUsers: number
  storageUsed: number
  engagementScore: number
}

export interface ContentAnalytics {
  viewTrends: TimeSeries[]
  categoryDistribution: CategoryStats[]
  topPerformingContent: Content[]
  userActivity: UserActivity[]
}

export interface TimeSeries {
  date: string
  value: number
}

export interface CategoryStats {
  category: ContentCategory
  count: number
  percentage: number
}

export interface UserActivity {
  userId: string
  username: string
  actionsCount: number
  lastActivity: string
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: string
}

export interface ValidationError {
  field: string
  message: string
  value?: any
}