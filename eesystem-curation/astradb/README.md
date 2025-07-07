# AstraDB Integration for EESystem Content Curation Platform

A comprehensive AstraDB integration system designed specifically for the EESystem Content Curation Platform, providing advanced content management, vector search, analytics, and performance monitoring capabilities.

## Features

### 🔍 Hybrid Search System
- **Semantic Search**: Vector-based content discovery using OpenAI embeddings
- **Lexical Search**: Traditional keyword-based search with advanced filtering
- **Hybrid Ranking**: Combines semantic and lexical results with intelligent reranking
- **Brand Context**: Integrates brand knowledge for content relevance scoring

### 📊 Content Analytics & Trends
- **Performance Tracking**: Comprehensive metrics across all platforms
- **Trend Detection**: Identifies emerging content themes and hashtag trends
- **Audience Insights**: Analyzes engagement patterns and audience behavior
- **Predictive Analytics**: Content performance forecasting

### 🛠️ Content Processing Pipeline
- **Schema Validation**: Ensures content meets platform requirements
- **Auto-Enhancement**: Automatically improves content with brand guidelines
- **Smart Chunking**: Splits long content for optimal processing
- **Compliance Checking**: Validates health claims and brand alignment

### 📈 Performance Monitoring
- **Real-time Metrics**: Database performance, search latency, system health
- **Smart Alerts**: Configurable alerting for performance issues
- **Optimization Recommendations**: AI-powered suggestions for improvements
- **Health Dashboard**: Comprehensive system status monitoring

## Installation

```bash
npm install @datastax/astra-db-ts openai zod
```

## Quick Start

```typescript
import { EESystemAstraDBIntegration } from './astradb';

// Configure the integration
const config = {
  astraDB: {
    token: process.env.ASTRA_DB_TOKEN!,
    apiEndpoint: process.env.ASTRA_DB_ENDPOINT!,
    namespace: 'eesystem_curation'
  },
  openAI: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-ada-002'
  },
  monitoring: {
    enabled: true,
    intervalMs: 60000
  },
  search: {
    defaultSemanticWeight: 0.7,
    defaultLexicalWeight: 0.3,
    maxResults: 10
  },
  content: {
    autoValidation: true,
    autoEnhancement: true,
    chunkingEnabled: true
  }
};

// Initialize the integration
const astraDB = new EESystemAstraDBIntegration(config);

// Import content from CSV
const csvData = await fs.readFile('eesystem-publication-schedule.csv', 'utf-8');
const importResult = await astraDB.importFromCSV(csvData);

// Search for content
const searchResults = await astraDB.searchContent('scalar field wellness', {
  platforms: ['INSTAGRAM', 'TIKTOK'],
  themes: ['CLEAR_THE_NOISE'],
  limit: 5
});

// Get content recommendations
const recommendations = await astraDB.getRecommendations(contentId, 5);

// Analyze trends
const trends = await astraDB.analyzeTrends('30d', ['INSTAGRAM'], ['IG_REEL']);

// Monitor system health
const health = astraDB.getHealthStatus();
```

## Core Components

### AstraDBClient
The main database client handling all interactions with AstraDB:

```typescript
import { AstraDBClient } from './integration/astradb-client';

const client = new AstraDBClient({
  token: 'your-astra-token',
  apiEndpoint: 'your-endpoint',
  namespace: 'your-namespace'
});

// Create content
const content = await client.createContent(contentData);

// Vector search
const results = await client.vectorSearchContent({
  vector: embeddings,
  limit: 10,
  filter: { theme: 'SCALAR_WELLNESS' }
});
```

### HybridSearchEngine
Advanced search combining semantic and lexical approaches:

```typescript
import { HybridSearchEngine } from './retrieval/hybrid-search';

const searchEngine = new HybridSearchEngine(astraClient, embeddingService);

const results = await searchEngine.search({
  query: 'scalar energy wellness content',
  semanticWeight: 0.7,
  lexicalWeight: 0.3,
  reranking: true,
  includeBrandContext: true,
  platforms: ['INSTAGRAM', 'TIKTOK']
});
```

### ContentProcessor
Intelligent content processing and validation:

```typescript
import { ContentProcessor } from './preprocessing/content-processor';

const processor = new ContentProcessor(embeddingService);

const result = await processor.processContent(rawContent, {
  validateSchema: true,
  generateEmbeddings: true,
  enhanceContent: true,
  chunkLongContent: true
});
```

### TrendDetector
Advanced analytics and trend detection:

```typescript
import { TrendDetector } from './analytics/trend-detector';

const detector = new TrendDetector(astraClient, embeddingService);

const trends = await detector.analyzeTrends('30d');
const performance = await detector.getPerformanceMetrics(contentId);
```

## Content Schema

The system supports comprehensive content modeling optimized for the EESystem brand:

```typescript
interface ContentPiece {
  id: string;
  title: string;
  content_type: 'IG_REEL' | 'IG_STORY' | 'TIKTOK_SHORT' | 'YOUTUBE_SHORT' | ...;
  platform: ('INSTAGRAM' | 'TIKTOK' | 'YOUTUBE' | 'FACEBOOK' | 'TWITTER')[];
  theme: 'CLEAR_THE_NOISE' | 'WASH_THE_MUD' | 'SCALAR_WELLNESS' | ...;
  
  // Content components
  hook_title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  script: string;
  media_prompt: string;
  
  // Brand guidelines
  brand_colors: {
    primary: string; // #43FAFF for scalar field
    secondary: string;
    accent: string;
    background: string;
  };
  
  // Compliance and safety
  compliance_level: 'GENERAL_CLAIMS' | 'USER_BASED_CLAIMS' | ...;
  health_claims: string[];
  
  // Vector embeddings for search
  embeddings: {
    content_embedding: number[];
    visual_embedding?: number[];
    theme_embedding?: number[];
  };
  
  // Performance tracking
  engagement_metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
}
```

## CSV Import

The system includes specialized CSV import functionality for the EESystem Publication Schedule:

```typescript
// Import from EESystem CSV format
const csvContent = `
Day,DOW,Platform,Content Type,Hook / Title,Caption & Hashtags,CTA,Script,Media Prompt,Compliance,Notes
7/7/2025,Monday,Instagram,IG Reel,Clear the Deck—Your Body's First,"Noise starts in the body. #ClearTheNoise #ScalarWellness",Comment below!,Full script...,Visual prompt...,Claims are general,Body-focused opener
`;

const results = await astraDB.importFromCSV(csvContent);
```

## Search Examples

### Semantic Search
Find content by meaning and context:

```typescript
const results = await astraDB.searchContent('reducing stress with energy fields', {
  semanticWeight: 1.0,
  lexicalWeight: 0.0,
  limit: 5
});
```

### Platform-Specific Search
Search content optimized for specific platforms:

```typescript
const instagramReels = await astraDB.searchContent('wellness tips', {
  platforms: ['INSTAGRAM'],
  contentTypes: ['IG_REEL'],
  themes: ['SCALAR_WELLNESS']
});
```

### Brand-Aligned Search
Find content that matches brand guidelines:

```typescript
const brandContent = await astraDB.searchContent('scalar field benefits', {
  includeBrandContext: true,
  filters: {
    'brand_colors.primary': '#43FAFF',
    compliance_level: 'GENERAL_CLAIMS'
  }
});
```

## Analytics Examples

### Trend Analysis
Identify trending themes and hashtags:

```typescript
const trends = await astraDB.analyzeTrends('30d', ['INSTAGRAM', 'TIKTOK']);

trends.forEach(trend => {
  console.log(`${trend.trend.name}: ${trend.trend.direction} (${trend.trend.strength})`);
  console.log(`Insights: ${trend.insights.join(', ')}`);
  console.log(`Recommendations: ${trend.recommendations.join(', ')}`);
});
```

### Performance Metrics
Track content performance across platforms:

```typescript
const metrics = await astraDB.getPerformanceMetrics(contentId, '7d');

console.log(`Engagement Rate: ${metrics.metrics.engagement.rate}%`);
console.log(`Best Platform: ${metrics.platform}`);
console.log(`Performance Score: ${metrics.performanceScore}/100`);
```

## Monitoring & Optimization

### Health Monitoring
Real-time system health tracking:

```typescript
const health = astraDB.getHealthStatus();
console.log(`Status: ${health.status}`);
console.log(`Issues: ${health.issues.join(', ')}`);
console.log(`Recommendations: ${health.recommendations.join(', ')}`);
```

### Performance Optimization
Get AI-powered optimization recommendations:

```typescript
const recommendations = await astraDB.getOptimizationRecommendations();

recommendations.forEach(rec => {
  console.log(`${rec.priority}: ${rec.title}`);
  console.log(`Impact: ${rec.impact}`);
  console.log(`Implementation: ${rec.implementation.join(', ')}`);
});
```

### Alerts
Monitor for performance issues:

```typescript
const alerts = astraDB.getActiveAlerts();

alerts.forEach(alert => {
  console.log(`${alert.severity}: ${alert.message}`);
  console.log(`Current: ${alert.currentValue}, Threshold: ${alert.threshold}`);
});
```

## Configuration Options

### Database Configuration
```typescript
const astraDBConfig = {
  token: 'your-astra-token',
  apiEndpoint: 'your-endpoint',
  namespace: 'eesystem_curation',
  maxRetries: 3,
  timeout: 30000
};
```

### Search Configuration
```typescript
const searchConfig = {
  defaultSemanticWeight: 0.7,
  defaultLexicalWeight: 0.3,
  maxResults: 10,
  cacheEnabled: true
};
```

### Content Processing Configuration
```typescript
const contentConfig = {
  autoValidation: true,
  autoEnhancement: true,
  chunkingEnabled: true,
  maxChunkSize: 1000
};
```

### Monitoring Configuration
```typescript
const monitoringConfig = {
  enabled: true,
  intervalMs: 60000,
  alertsEnabled: true
};
```

## Best Practices

### Content Creation
1. **Use Themes**: Always assign appropriate themes to content
2. **Brand Colors**: Ensure #43FAFF is used as primary brand color
3. **Compliance**: Set appropriate compliance levels for health claims
4. **Hashtags**: Include brand-specific hashtags like #ScalarWellness

### Search Optimization
1. **Hybrid Search**: Use both semantic and lexical search for best results
2. **Brand Context**: Enable brand context for content discovery
3. **Filters**: Use platform and theme filters to narrow results
4. **Reranking**: Enable reranking for improved relevance

### Performance
1. **Monitoring**: Enable continuous performance monitoring
2. **Alerts**: Set up alerts for critical metrics
3. **Caching**: Enable search result caching for better performance
4. **Batch Operations**: Use batch operations for bulk content processing

## Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const content = await astraDB.createContent(contentData);
} catch (error) {
  if (error.message.includes('validation')) {
    // Handle validation errors
    console.error('Content validation failed:', error);
  } else if (error.message.includes('embedding')) {
    // Handle embedding generation errors
    console.error('Embedding generation failed:', error);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## Contributing

1. Follow the existing code structure and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure brand compliance for EESystem content

## License

Copyright (c) 2025 EESystem Content Curation Platform. All rights reserved.