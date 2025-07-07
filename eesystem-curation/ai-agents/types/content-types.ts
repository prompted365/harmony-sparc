/**
 * Content Type Definitions for EESystem Platform
 */

export interface ContentResearch {
  keywords: string[];
  sources: string[];
  insights: string[];
  brandRelevance: number;
}

export interface TrendAnalysis {
  wellness_trends: string[];
  scalar_technology_trends: string[];
  content_performance_trends: string[];
  seasonal_patterns: string[];
  audience_interests: string[];
}

export interface ContentCuration {
  selectedContent: any[];
  contentTypes: string[];
  platforms: string[];
  themes: string[];
  brandCompliance: number;
}

export interface PublicationSchedule {
  date: string;
  platform: string;
  contentType: string;
  theme: string;
  hook: string;
  caption?: string;
  cta?: string;
  script?: string;
  mediaPrompt?: string;
  compliance?: string;
  notes?: string;
}

export interface ContentAnalysis {
  performance: PerformanceMetrics;
  engagement: EngagementMetrics;
  brandAlignment: number;
  recommendations: string[];
}

export interface PerformanceMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  clickThroughRate: number;
}

export interface EngagementMetrics {
  engagementRate: number;
  averageWatchTime: number;
  completionRate: number;
  interactionRate: number;
  sentimentScore: number;
}

export interface ScriptContent {
  title: string;
  hook: string;
  scenes: ScriptScene[];
  duration: number;
  callToAction: string;
  brandElements: string[];
}

export interface ScriptScene {
  timestamp: string;
  visual: string;
  audio: string;
  text: string;
  effects: string[];
}

export interface CaptionContent {
  mainCaption: string;
  hashtags: string[];
  callToAction: string;
  brandMentions: string[];
  characterCount: number;
}

export interface MediaPrompt {
  type: MediaType;
  prompt: string;
  style: string;
  dimensions: string;
  effects: string[];
  colorScheme: string[];
  brandElements: string[];
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  ANIMATION = 'animation'
}

export interface ContentScheduling {
  contentId: string;
  platform: Platform;
  publishDate: string;
  publishTime: string;
  timezone: string;
  status: SchedulingStatus;
}

export enum Platform {
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin'
}

export enum SchedulingStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  FAILED = 'failed'
}

export interface ComplianceCheck {
  contentId: string;
  healthClaims: HealthClaimsCheck;
  legalCompliance: LegalComplianceCheck;
  brandCompliance: BrandComplianceCheck;
  overallScore: number;
  approved: boolean;
  issues: string[];
  recommendations: string[];
}

export interface HealthClaimsCheck {
  score: number;
  flaggedClaims: string[];
  requiredDisclaimers: string[];
  approved: boolean;
}

export interface LegalComplianceCheck {
  score: number;
  issues: string[];
  requiredDisclosures: string[];
  approved: boolean;
}

export interface BrandComplianceCheck {
  score: number;
  visualCompliance: number;
  voiceCompliance: number;
  messageCompliance: number;
  approved: boolean;
}

export interface ContentTemplate {
  id: string;
  name: string;
  platform: Platform;
  contentType: string;
  template: string;
  variables: string[];
  brandElements: string[];
}

export interface ContentWorkflow {
  id: string;
  name: string;
  steps: ContentWorkflowStep[];
  dependencies: string[];
  estimatedTime: number;
  priority: number;
}

export interface ContentWorkflowStep {
  id: string;
  name: string;
  description: string;
  agentType: string;
  inputs: string[];
  outputs: string[];
  duration: number;
  required: boolean;
}