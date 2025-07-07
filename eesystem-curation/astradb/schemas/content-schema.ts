/**
 * AstraDB Content Schema for EESystem Content Curation Platform
 * Designed for multi-platform content with scalar field wellness themes
 */

import { z } from 'zod';

// Platform-specific content types
export const ContentTypeSchema = z.enum([
  'IG_REEL',
  'IG_STORY',
  'IG_CAROUSEL',
  'IG_POST',
  'TIKTOK_SHORT',
  'YOUTUBE_SHORT',
  'FACEBOOK_POST',
  'TWITTER_POST',
  'TWITTER_THREAD',
  'UGC_CONTENT',
  'QUOTE_CARD',
  'POLL',
  'CLIP'
]);

// Content themes from CSV analysis
export const ContentThemeSchema = z.enum([
  'CLEAR_THE_NOISE',
  'WASH_THE_MUD',
  'SCALAR_WELLNESS',
  'FIELD_EFFECT',
  'EE_COHERENCE',
  'BODY_ENERGY_COHERENCE',
  'WEEKLY_RECAP'
]);

// Compliance levels for health claims
export const ComplianceLevelSchema = z.enum([
  'GENERAL_CLAIMS',
  'USER_BASED_CLAIMS',
  'SCIENTIFIC_CLAIMS',
  'TESTIMONIAL_CLAIMS'
]);

// Brand color scheme
export const BrandColorSchema = z.object({
  primary: z.string().default('#43FAFF'), // Scalar field cyan
  secondary: z.string().default('#FFFFFF'),
  accent: z.string().default('#000000'),
  background: z.string().default('#F5F5F5')
});

// Content piece schema
export const ContentPieceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content_type: ContentTypeSchema,
  platform: z.array(z.enum(['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'TWITTER'])),
  theme: ContentThemeSchema,
  
  // Content components
  hook_title: z.string().min(1).max(500),
  caption: z.string().min(1).max(2200), // Instagram max
  hashtags: z.array(z.string()).min(1).max(30),
  cta: z.string().min(1).max(200),
  
  // Production content
  script: z.string().min(1).max(5000),
  media_prompt: z.string().min(1).max(2000),
  
  // Brand guidelines
  brand_colors: BrandColorSchema,
  visual_guidelines: z.object({
    aesthetic: z.enum(['MODERN', 'MINIMALIST', 'WELLNESS', 'CLEAN', 'ELEGANT']),
    lighting: z.enum(['NATURAL', 'WARM', 'SOFT', 'BRIGHT', 'DRAMATIC']),
    tone: z.enum(['CALM', 'ENERGETIC', 'UPLIFTING', 'SOOTHING', 'MOTIVATIONAL'])
  }),
  
  // Compliance and safety
  compliance_level: ComplianceLevelSchema,
  health_claims: z.array(z.string()).default([]),
  safety_notes: z.string().optional(),
  
  // Metadata
  publication_date: z.string().datetime(),
  day_of_week: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  series_info: z.object({
    is_series: z.boolean(),
    series_name: z.string().optional(),
    part_number: z.number().optional(),
    total_parts: z.number().optional()
  }).optional(),
  
  // Performance tracking
  engagement_metrics: z.object({
    views: z.number().default(0),
    likes: z.number().default(0),
    comments: z.number().default(0),
    shares: z.number().default(0),
    saves: z.number().default(0),
    click_through_rate: z.number().default(0)
  }).optional(),
  
  // Vector embeddings for semantic search
  embeddings: z.object({
    content_embedding: z.array(z.number()).length(1536), // OpenAI ada-002 dimensions
    visual_embedding: z.array(z.number()).length(512).optional(), // CLIP embeddings
    theme_embedding: z.array(z.number()).length(768).optional() // Sentence transformers
  }).optional(),
  
  // Timestamps
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  published_at: z.string().datetime().optional(),
  
  // Additional metadata
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  target_audience: z.string().optional(),
  language: z.string().default('en'),
  
  // Production metadata
  production_notes: z.string().optional(),
  b_roll_requirements: z.array(z.string()).default([]),
  audio_requirements: z.object({
    bpm: z.number().optional(),
    style: z.string().optional(),
    effects: z.array(z.string()).default([])
  }).optional()
});

// Content analytics schema
export const ContentAnalyticsSchema = z.object({
  content_id: z.string().uuid(),
  platform: z.string(),
  date: z.string().datetime(),
  metrics: z.object({
    impressions: z.number().default(0),
    reach: z.number().default(0),
    engagement_rate: z.number().default(0),
    click_through_rate: z.number().default(0),
    conversion_rate: z.number().default(0),
    average_watch_time: z.number().default(0),
    completion_rate: z.number().default(0)
  }),
  audience_insights: z.object({
    age_demographics: z.record(z.number()).default({}),
    gender_split: z.record(z.number()).default({}),
    location_data: z.record(z.number()).default({}),
    device_usage: z.record(z.number()).default({})
  }).optional(),
  performance_score: z.number().min(0).max(100).default(0)
});

// Brand knowledge base schema
export const BrandKnowledgeSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['VISUAL_GUIDELINES', 'TONE_VOICE', 'COMPLIANCE_RULES', 'CONTENT_THEMES', 'TECHNICAL_SPECS']),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  
  // Brand-specific fields
  scalar_field_references: z.array(z.string()).default([]),
  wellness_claims: z.array(z.string()).default([]),
  color_palette: z.record(z.string()).default({}),
  
  // Guidelines and rules
  do_guidelines: z.array(z.string()).default([]),
  dont_guidelines: z.array(z.string()).default([]),
  compliance_requirements: z.array(z.string()).default([]),
  
  // Vector embeddings for retrieval
  embeddings: z.array(z.number()).length(1536).optional(),
  
  // Metadata
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  version: z.number().default(1),
  tags: z.array(z.string()).default([])
});

// Content recommendation schema
export const ContentRecommendationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().optional(),
  content_id: z.string().uuid(),
  recommendation_type: z.enum(['SIMILAR_CONTENT', 'TRENDING', 'PERSONALIZED', 'THEME_BASED']),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime()
});

// Content performance prediction schema
export const ContentPerformancePredictionSchema = z.object({
  content_id: z.string().uuid(),
  predicted_metrics: z.object({
    estimated_reach: z.number(),
    estimated_engagement: z.number(),
    virality_score: z.number().min(0).max(1),
    optimal_posting_time: z.string().datetime(),
    audience_match_score: z.number().min(0).max(1)
  }),
  confidence_interval: z.object({
    lower_bound: z.number(),
    upper_bound: z.number()
  }),
  factors_considered: z.array(z.string()).default([]),
  model_version: z.string(),
  created_at: z.string().datetime()
});

// Export all schemas
export type ContentPiece = z.infer<typeof ContentPieceSchema>;
export type ContentAnalytics = z.infer<typeof ContentAnalyticsSchema>;
export type BrandKnowledge = z.infer<typeof BrandKnowledgeSchema>;
export type ContentRecommendation = z.infer<typeof ContentRecommendationSchema>;
export type ContentPerformancePrediction = z.infer<typeof ContentPerformancePredictionSchema>;

// AstraDB collection names
export const COLLECTIONS = {
  CONTENT_PIECES: 'content_pieces',
  CONTENT_ANALYTICS: 'content_analytics',
  BRAND_KNOWLEDGE: 'brand_knowledge',
  CONTENT_RECOMMENDATIONS: 'content_recommendations',
  CONTENT_PREDICTIONS: 'content_predictions',
  USER_INTERACTIONS: 'user_interactions',
  CONTENT_VERSIONS: 'content_versions'
} as const;

// Vector dimensions for different embedding models
export const EMBEDDING_DIMENSIONS = {
  OPENAI_ADA_002: 1536,
  CLIP_VISUAL: 512,
  SENTENCE_TRANSFORMERS: 768,
  CUSTOM_BRAND: 256
} as const;