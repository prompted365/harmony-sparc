/**
 * Content Analytics and Trend Detection for EESystem
 * Analyzes content performance, audience engagement, and emerging trends
 */

import { AstraDBClient } from '../integration/astradb-client';
import { ContentPiece, ContentAnalytics, COLLECTIONS } from '../schemas/content-schema';
import { EmbeddingService } from '../integration/embedding-service';
import { logger } from '../utils/logger';

export interface TrendAnalysis {
  id: string;
  timeframe: string;
  trendType: 'CONTENT_THEME' | 'HASHTAG' | 'ENGAGEMENT_PATTERN' | 'PLATFORM_PERFORMANCE' | 'AUDIENCE_BEHAVIOR';
  trend: {
    name: string;
    description: string;
    strength: number; // 0-1
    direction: 'RISING' | 'FALLING' | 'STABLE' | 'VOLATILE';
    confidence: number; // 0-1
  };
  dataPoints: Array<{
    timestamp: string;
    value: number;
    metadata?: Record<string, any>;
  }>;
  insights: string[];
  recommendations: string[];
  relatedContent: string[]; // Content IDs
  createdAt: string;
}

export interface PerformanceMetrics {
  contentId: string;
  platform: string;
  timeframe: {
    start: string;
    end: string;
  };
  metrics: {
    reach: number;
    impressions: number;
    engagement: {
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      total: number;
      rate: number;
    };
    clickThrough: {
      clicks: number;
      rate: number;
    };
    conversion: {
      conversions: number;
      rate: number;
    };
    watchTime?: {
      average: number;
      total: number;
      completionRate: number;
    };
  };
  demographics: {
    ageGroups: Record<string, number>;
    genderSplit: Record<string, number>;
    locations: Record<string, number>;
    interests: Record<string, number>;
  };
  performanceScore: number; // 0-100
  ranking: {
    overallRank: number;
    categoryRank: number;
    platformRank: number;
  };
}

export interface AudienceInsight {
  segment: string;
  description: string;
  size: number;
  growth: number; // percentage change
  characteristics: {
    demographics: Record<string, any>;
    behaviors: Record<string, any>;
    preferences: Record<string, any>;
  };
  engagementPatterns: {
    bestTimes: string[];
    preferredContent: string[];
    averageEngagement: number;
  };
  recommendations: string[];
}

export interface ContentRecommendation {
  type: 'CONTENT_OPTIMIZATION' | 'TIMING' | 'PLATFORM' | 'THEME' | 'FORMAT';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string[];
  relatedTrends: string[];
}

export class TrendDetector {
  private astraDB: AstraDBClient;
  private embeddingService: EmbeddingService;

  constructor(astraDB: AstraDBClient, embeddingService: EmbeddingService) {
    this.astraDB = astraDB;
    this.embeddingService = embeddingService;
  }

  async analyzeTrends(
    timeframe: string = '30d',
    platforms?: string[],
    contentTypes?: string[]
  ): Promise<TrendAnalysis[]> {
    try {
      logger.info(`Analyzing trends for timeframe: ${timeframe}`);
      
      const endDate = new Date();
      const startDate = this.calculateStartDate(endDate, timeframe);
      
      // Get all content and analytics data
      const contentData = await this.getContentData(startDate, endDate, platforms, contentTypes);
      const analyticsData = await this.getAnalyticsData(startDate, endDate, platforms);
      
      const trends: TrendAnalysis[] = [];
      
      // Analyze different trend types
      trends.push(...await this.analyzeContentThemeTrends(contentData, analyticsData, timeframe));
      trends.push(...await this.analyzeHashtagTrends(contentData, analyticsData, timeframe));
      trends.push(...await this.analyzeEngagementPatterns(analyticsData, timeframe));
      trends.push(...await this.analyzePlatformPerformance(analyticsData, timeframe));
      trends.push(...await this.analyzeAudienceBehavior(analyticsData, timeframe));
      
      logger.info(`Found ${trends.length} trends`);
      return trends;

    } catch (error) {
      logger.error('Failed to analyze trends:', error);
      throw error;
    }
  }

  private calculateStartDate(endDate: Date, timeframe: string): Date {
    const startDate = new Date(endDate);
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }
    
    return startDate;
  }

  private async getContentData(
    startDate: Date,
    endDate: Date,
    platforms?: string[],
    contentTypes?: string[]
  ): Promise<ContentPiece[]> {
    const filters: any = {
      created_at: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      }
    };
    
    if (platforms && platforms.length > 0) {
      filters.platform = { $elemMatch: { $in: platforms } };
    }
    
    if (contentTypes && contentTypes.length > 0) {
      filters.content_type = { $in: contentTypes };
    }
    
    return this.astraDB.searchContent({ filter: filters, limit: 1000 });
  }

  private async getAnalyticsData(
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<ContentAnalytics[]> {
    const collection = await this.astraDB['collections'].get(COLLECTIONS.CONTENT_ANALYTICS);
    
    const filters: any = {
      date: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      }
    };
    
    if (platforms && platforms.length > 0) {
      filters.platform = { $in: platforms };
    }
    
    const results = await collection.find(filters).limit(10000).toArray();
    return results;
  }

  private async analyzeContentThemeTrends(
    contentData: ContentPiece[],
    analyticsData: ContentAnalytics[],
    timeframe: string
  ): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // Group content by themes and analyze performance
    const themeGroups = this.groupContentByTheme(contentData);
    
    for (const [theme, contents] of Object.entries(themeGroups)) {
      const themeAnalytics = analyticsData.filter(a => 
        contents.some(c => c.id === a.content_id)
      );
      
      if (themeAnalytics.length === 0) continue;
      
      const dataPoints = this.aggregateDataByTime(themeAnalytics, timeframe);
      const trendStrength = this.calculateTrendStrength(dataPoints);
      const trendDirection = this.calculateTrendDirection(dataPoints);
      
      const trend: TrendAnalysis = {
        id: crypto.randomUUID(),
        timeframe,
        trendType: 'CONTENT_THEME',
        trend: {
          name: theme,
          description: `Performance trend for ${theme} themed content`,
          strength: trendStrength,
          direction: trendDirection,
          confidence: this.calculateConfidence(dataPoints)
        },
        dataPoints,
        insights: this.generateThemeInsights(theme, contents, themeAnalytics),
        recommendations: this.generateThemeRecommendations(theme, trendDirection, trendStrength),
        relatedContent: contents.map(c => c.id),
        createdAt: new Date().toISOString()
      };
      
      trends.push(trend);
    }
    
    return trends;
  }

  private async analyzeHashtagTrends(
    contentData: ContentPiece[],
    analyticsData: ContentAnalytics[],
    timeframe: string
  ): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // Extract and analyze hashtag performance
    const hashtagPerformance = this.analyzeHashtagPerformance(contentData, analyticsData);
    
    // Identify trending hashtags
    const trendingHashtags = Object.entries(hashtagPerformance)
      .sort(([,a], [,b]) => b.averageEngagement - a.averageEngagement)
      .slice(0, 10);
    
    for (const [hashtag, performance] of trendingHashtags) {
      const dataPoints = performance.timeSeriesData || [];
      
      const trend: TrendAnalysis = {
        id: crypto.randomUUID(),
        timeframe,
        trendType: 'HASHTAG',
        trend: {
          name: hashtag,
          description: `Performance trend for #${hashtag}`,
          strength: Math.min(performance.averageEngagement / 1000, 1), // Normalize
          direction: this.calculateTrendDirection(dataPoints),
          confidence: Math.min(performance.usageCount / 10, 1) // More usage = higher confidence
        },
        dataPoints,
        insights: [
          `Used in ${performance.usageCount} pieces of content`,
          `Average engagement: ${performance.averageEngagement.toFixed(0)}`,
          `Best performing platform: ${performance.bestPlatform}`
        ],
        recommendations: this.generateHashtagRecommendations(hashtag, performance),
        relatedContent: performance.contentIds,
        createdAt: new Date().toISOString()
      };
      
      trends.push(trend);
    }
    
    return trends;
  }

  private async analyzeEngagementPatterns(
    analyticsData: ContentAnalytics[],
    timeframe: string
  ): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // Analyze engagement rate trends
    const engagementData = analyticsData.map(a => ({
      timestamp: a.date,
      value: a.metrics.engagement_rate,
      metadata: {
        platform: a.platform,
        content_id: a.content_id
      }
    }));
    
    const aggregatedData = this.aggregateDataByTime(analyticsData, timeframe);
    
    const trend: TrendAnalysis = {
      id: crypto.randomUUID(),
      timeframe,
      trendType: 'ENGAGEMENT_PATTERN',
      trend: {
        name: 'Overall Engagement Rate',
        description: 'Trend in overall content engagement rates',
        strength: this.calculateTrendStrength(aggregatedData),
        direction: this.calculateTrendDirection(aggregatedData),
        confidence: this.calculateConfidence(aggregatedData)
      },
      dataPoints: aggregatedData,
      insights: this.generateEngagementInsights(analyticsData),
      recommendations: this.generateEngagementRecommendations(analyticsData),
      relatedContent: [...new Set(analyticsData.map(a => a.content_id))],
      createdAt: new Date().toISOString()
    };
    
    trends.push(trend);
    
    return trends;
  }

  private async analyzePlatformPerformance(
    analyticsData: ContentAnalytics[],
    timeframe: string
  ): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // Group analytics by platform
    const platformGroups = this.groupAnalyticsByPlatform(analyticsData);
    
    for (const [platform, analytics] of Object.entries(platformGroups)) {
      const dataPoints = this.aggregateDataByTime(analytics, timeframe);
      
      const trend: TrendAnalysis = {
        id: crypto.randomUUID(),
        timeframe,
        trendType: 'PLATFORM_PERFORMANCE',
        trend: {
          name: platform,
          description: `Performance trend for ${platform}`,
          strength: this.calculateTrendStrength(dataPoints),
          direction: this.calculateTrendDirection(dataPoints),
          confidence: this.calculateConfidence(dataPoints)
        },
        dataPoints,
        insights: this.generatePlatformInsights(platform, analytics),
        recommendations: this.generatePlatformRecommendations(platform, analytics),
        relatedContent: analytics.map(a => a.content_id),
        createdAt: new Date().toISOString()
      };
      
      trends.push(trend);
    }
    
    return trends;
  }

  private async analyzeAudienceBehavior(
    analyticsData: ContentAnalytics[],
    timeframe: string
  ): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // Analyze audience engagement patterns over time
    const audienceData = this.analyzeAudienceData(analyticsData);
    
    if (audienceData.length > 0) {
      const trend: TrendAnalysis = {
        id: crypto.randomUUID(),
        timeframe,
        trendType: 'AUDIENCE_BEHAVIOR',
        trend: {
          name: 'Audience Engagement Behavior',
          description: 'Changes in how audiences interact with content',
          strength: this.calculateAudienceTrendStrength(audienceData),
          direction: this.calculateAudienceTrendDirection(audienceData),
          confidence: 0.8
        },
        dataPoints: audienceData,
        insights: this.generateAudienceInsights(audienceData),
        recommendations: this.generateAudienceRecommendations(audienceData),
        relatedContent: analyticsData.map(a => a.content_id),
        createdAt: new Date().toISOString()
      };
      
      trends.push(trend);
    }
    
    return trends;
  }

  private groupContentByTheme(contentData: ContentPiece[]): Record<string, ContentPiece[]> {
    return contentData.reduce((groups, content) => {
      const theme = content.theme || 'UNTHEMED';
      if (!groups[theme]) {
        groups[theme] = [];
      }
      groups[theme].push(content);
      return groups;
    }, {} as Record<string, ContentPiece[]>);
  }

  private groupAnalyticsByPlatform(analyticsData: ContentAnalytics[]): Record<string, ContentAnalytics[]> {
    return analyticsData.reduce((groups, analytics) => {
      const platform = analytics.platform;
      if (!groups[platform]) {
        groups[platform] = [];
      }
      groups[platform].push(analytics);
      return groups;
    }, {} as Record<string, ContentAnalytics[]>);
  }

  private aggregateDataByTime(
    analyticsData: ContentAnalytics[],
    timeframe: string
  ): Array<{ timestamp: string; value: number; metadata?: Record<string, any> }> {
    // Group data by time intervals based on timeframe
    const intervalMs = this.getIntervalMs(timeframe);
    const grouped = new Map<number, ContentAnalytics[]>();
    
    analyticsData.forEach(data => {
      const timestamp = new Date(data.date).getTime();
      const interval = Math.floor(timestamp / intervalMs) * intervalMs;
      
      if (!grouped.has(interval)) {
        grouped.set(interval, []);
      }
      grouped.get(interval)!.push(data);
    });
    
    // Calculate average metrics for each interval
    return Array.from(grouped.entries())
      .map(([interval, data]) => ({
        timestamp: new Date(interval).toISOString(),
        value: data.reduce((sum, d) => sum + d.metrics.engagement_rate, 0) / data.length,
        metadata: {
          count: data.length,
          totalReach: data.reduce((sum, d) => sum + d.metrics.reach, 0),
          platforms: [...new Set(data.map(d => d.platform))]
        }
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private getIntervalMs(timeframe: string): number {
    switch (timeframe) {
      case '7d':
        return 24 * 60 * 60 * 1000; // 1 day
      case '30d':
        return 7 * 24 * 60 * 60 * 1000; // 1 week
      case '90d':
        return 7 * 24 * 60 * 60 * 1000; // 1 week
      case '1y':
        return 30 * 24 * 60 * 60 * 1000; // 1 month
      default:
        return 24 * 60 * 60 * 1000; // 1 day
    }
  }

  private calculateTrendStrength(dataPoints: Array<{ value: number }>): number {
    if (dataPoints.length < 2) return 0;
    
    const values = dataPoints.map(d => d.value);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    return Math.abs((secondAvg - firstAvg) / firstAvg);
  }

  private calculateTrendDirection(dataPoints: Array<{ value: number }>): 'RISING' | 'FALLING' | 'STABLE' | 'VOLATILE' {
    if (dataPoints.length < 2) return 'STABLE';
    
    const values = dataPoints.map(d => d.value);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const change = (lastValue - firstValue) / firstValue;
    
    // Calculate volatility
    const variance = this.calculateVariance(values);
    const volatilityThreshold = 0.3;
    
    if (variance > volatilityThreshold) {
      return 'VOLATILE';
    } else if (change > 0.1) {
      return 'RISING';
    } else if (change < -0.1) {
      return 'FALLING';
    } else {
      return 'STABLE';
    }
  }

  private calculateConfidence(dataPoints: Array<{ value: number }>): number {
    if (dataPoints.length < 3) return 0.5;
    
    // Confidence based on data consistency and sample size
    const variance = this.calculateVariance(dataPoints.map(d => d.value));
    const sampleSize = Math.min(dataPoints.length / 10, 1); // More data = higher confidence
    const consistency = Math.max(0, 1 - variance); // Lower variance = higher confidence
    
    return (sampleSize + consistency) / 2;
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }

  private analyzeHashtagPerformance(
    contentData: ContentPiece[],
    analyticsData: ContentAnalytics[]
  ): Record<string, any> {
    const hashtagMap = new Map<string, {
      usageCount: number;
      totalEngagement: number;
      contentIds: string[];
      platforms: Set<string>;
      averageEngagement: number;
      bestPlatform: string;
      timeSeriesData?: Array<{ timestamp: string; value: number }>;
    }>();
    
    contentData.forEach(content => {
      if (!content.hashtags) return;
      
      const contentAnalytics = analyticsData.filter(a => a.content_id === content.id);
      const totalEngagement = contentAnalytics.reduce((sum, a) => 
        sum + a.metrics.engagement_rate, 0
      );
      
      content.hashtags.forEach(hashtag => {
        const cleanHashtag = hashtag.replace('#', '').toLowerCase();
        
        if (!hashtagMap.has(cleanHashtag)) {
          hashtagMap.set(cleanHashtag, {
            usageCount: 0,
            totalEngagement: 0,
            contentIds: [],
            platforms: new Set(),
            averageEngagement: 0,
            bestPlatform: ''
          });
        }
        
        const entry = hashtagMap.get(cleanHashtag)!;
        entry.usageCount++;
        entry.totalEngagement += totalEngagement;
        entry.contentIds.push(content.id);
        content.platform.forEach(p => entry.platforms.add(p));
      });
    });
    
    // Calculate averages and best platforms
    const result: Record<string, any> = {};
    hashtagMap.forEach((data, hashtag) => {
      data.averageEngagement = data.totalEngagement / data.usageCount;
      
      // Find best performing platform for this hashtag
      const platformPerformance = new Map<string, number>();
      data.contentIds.forEach(contentId => {
        const contentAnalytics = analyticsData.filter(a => a.content_id === contentId);
        contentAnalytics.forEach(a => {
          const current = platformPerformance.get(a.platform) || 0;
          platformPerformance.set(a.platform, current + a.metrics.engagement_rate);
        });
      });
      
      data.bestPlatform = Array.from(platformPerformance.entries())
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
      
      result[hashtag] = data;
    });
    
    return result;
  }

  private generateThemeInsights(
    theme: string,
    contents: ContentPiece[],
    analytics: ContentAnalytics[]
  ): string[] {
    const insights: string[] = [];
    
    const avgEngagement = analytics.reduce((sum, a) => sum + a.metrics.engagement_rate, 0) / analytics.length;
    insights.push(`Average engagement rate: ${(avgEngagement * 100).toFixed(1)}%`);
    
    const platformPerformance = this.analyzePlatformPerformanceForTheme(analytics);
    const bestPlatform = Object.entries(platformPerformance)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (bestPlatform) {
      insights.push(`Best performing platform: ${bestPlatform[0]}`);
    }
    
    const contentTypePerformance = this.analyzeContentTypePerformance(contents, analytics);
    const bestContentType = Object.entries(contentTypePerformance)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (bestContentType) {
      insights.push(`Best performing content type: ${bestContentType[0]}`);
    }
    
    return insights;
  }

  private analyzePlatformPerformanceForTheme(analytics: ContentAnalytics[]): Record<string, number> {
    const performance: Record<string, number> = {};
    
    analytics.forEach(a => {
      if (!performance[a.platform]) {
        performance[a.platform] = 0;
      }
      performance[a.platform] += a.metrics.engagement_rate;
    });
    
    // Calculate averages
    Object.keys(performance).forEach(platform => {
      const count = analytics.filter(a => a.platform === platform).length;
      performance[platform] = performance[platform] / count;
    });
    
    return performance;
  }

  private analyzeContentTypePerformance(
    contents: ContentPiece[],
    analytics: ContentAnalytics[]
  ): Record<string, number> {
    const performance: Record<string, number> = {};
    
    contents.forEach(content => {
      const contentAnalytics = analytics.filter(a => a.content_id === content.id);
      const avgEngagement = contentAnalytics.reduce((sum, a) => sum + a.metrics.engagement_rate, 0) / contentAnalytics.length;
      
      if (!performance[content.content_type]) {
        performance[content.content_type] = 0;
      }
      performance[content.content_type] += avgEngagement;
    });
    
    return performance;
  }

  private generateThemeRecommendations(
    theme: string,
    direction: string,
    strength: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (direction === 'RISING' && strength > 0.2) {
      recommendations.push(`${theme} content is trending up - consider increasing production`);
      recommendations.push('Expand on successful elements from top-performing posts');
    } else if (direction === 'FALLING') {
      recommendations.push(`${theme} content performance declining - review and refresh approach`);
      recommendations.push('Consider new angles or formats for this theme');
    } else if (direction === 'STABLE') {
      recommendations.push(`${theme} content has stable performance - maintain current strategy`);
    }
    
    return recommendations;
  }

  private generateHashtagRecommendations(hashtag: string, performance: any): string[] {
    const recommendations: string[] = [];
    
    if (performance.averageEngagement > 1000) {
      recommendations.push(`#${hashtag} shows strong performance - use more frequently`);
    }
    
    if (performance.platforms.size === 1) {
      recommendations.push(`Consider expanding #${hashtag} to other platforms`);
    }
    
    recommendations.push(`Best performing platform for #${hashtag}: ${performance.bestPlatform}`);
    
    return recommendations;
  }

  private generateEngagementInsights(analytics: ContentAnalytics[]): string[] {
    const insights: string[] = [];
    
    const avgEngagement = analytics.reduce((sum, a) => sum + a.metrics.engagement_rate, 0) / analytics.length;
    insights.push(`Overall average engagement rate: ${(avgEngagement * 100).toFixed(1)}%`);
    
    // Find peak engagement times
    const timeAnalysis = this.analyzeEngagementByTime(analytics);
    insights.push(`Peak engagement period: ${timeAnalysis.peakPeriod}`);
    
    return insights;
  }

  private analyzeEngagementByTime(analytics: ContentAnalytics[]): { peakPeriod: string } {
    // Simple implementation - could be expanded for more sophisticated time analysis
    return { peakPeriod: 'Weekday evenings' };
  }

  private generateEngagementRecommendations(analytics: ContentAnalytics[]): string[] {
    const recommendations: string[] = [];
    
    const avgEngagement = analytics.reduce((sum, a) => sum + a.metrics.engagement_rate, 0) / analytics.length;
    
    if (avgEngagement < 0.02) {
      recommendations.push('Consider more engaging content formats or stronger CTAs');
    } else if (avgEngagement > 0.05) {
      recommendations.push('Engagement is strong - analyze top performers to replicate success');
    }
    
    return recommendations;
  }

  private generatePlatformInsights(platform: string, analytics: ContentAnalytics[]): string[] {
    const insights: string[] = [];
    
    const avgEngagement = analytics.reduce((sum, a) => sum + a.metrics.engagement_rate, 0) / analytics.length;
    insights.push(`${platform} average engagement: ${(avgEngagement * 100).toFixed(1)}%`);
    
    const totalReach = analytics.reduce((sum, a) => sum + a.metrics.reach, 0);
    insights.push(`Total reach on ${platform}: ${totalReach.toLocaleString()}`);
    
    return insights;
  }

  private generatePlatformRecommendations(platform: string, analytics: ContentAnalytics[]): string[] {
    const recommendations: string[] = [];
    
    const avgEngagement = analytics.reduce((sum, a) => sum + a.metrics.engagement_rate, 0) / analytics.length;
    
    // Platform-specific recommendations
    switch (platform) {
      case 'INSTAGRAM':
        if (avgEngagement < 0.03) {
          recommendations.push('Instagram engagement below average - consider more visual content');
        }
        break;
      case 'TIKTOK':
        if (avgEngagement < 0.05) {
          recommendations.push('TikTok engagement low - try trending sounds and effects');
        }
        break;
      case 'YOUTUBE':
        recommendations.push('Focus on watch time and subscriber growth metrics');
        break;
    }
    
    return recommendations;
  }

  private analyzeAudienceData(analyticsData: ContentAnalytics[]): Array<{ timestamp: string; value: number }> {
    // Simplified audience behavior analysis
    // In production, this would analyze demographic shifts, behavior changes, etc.
    return analyticsData.map(a => ({
      timestamp: a.date,
      value: a.performance_score
    }));
  }

  private calculateAudienceTrendStrength(audienceData: Array<{ value: number }>): number {
    return this.calculateTrendStrength(audienceData);
  }

  private calculateAudienceTrendDirection(audienceData: Array<{ value: number }>): 'RISING' | 'FALLING' | 'STABLE' | 'VOLATILE' {
    return this.calculateTrendDirection(audienceData);
  }

  private generateAudienceInsights(audienceData: Array<{ timestamp: string; value: number }>): string[] {
    return [
      'Audience engagement patterns show consistent interaction',
      'Peak audience activity during standard posting times'
    ];
  }

  private generateAudienceRecommendations(audienceData: Array<{ timestamp: string; value: number }>): string[] {
    return [
      'Maintain current posting schedule for optimal audience reach',
      'Consider A/B testing different posting times'
    ];
  }

  async getPerformanceMetrics(
    contentId: string,
    timeframe: string = '30d'
  ): Promise<PerformanceMetrics | null> {
    try {
      const content = await this.astraDB.getContentById(contentId);
      if (!content) return null;
      
      const endDate = new Date();
      const startDate = this.calculateStartDate(endDate, timeframe);
      
      const analytics = await this.astraDB.getContentAnalytics(contentId);
      const relevantAnalytics = analytics.filter(a => {
        const date = new Date(a.date);
        return date >= startDate && date <= endDate;
      });
      
      if (relevantAnalytics.length === 0) return null;
      
      // Aggregate metrics across all platforms and time periods
      const aggregatedMetrics = this.aggregateMetrics(relevantAnalytics);
      
      return {
        contentId,
        platform: content.platform.join(', '),
        timeframe: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        metrics: aggregatedMetrics,
        demographics: this.aggregateDemographics(relevantAnalytics),
        performanceScore: this.calculatePerformanceScore(aggregatedMetrics),
        ranking: await this.calculateRankings(content, aggregatedMetrics)
      };
      
    } catch (error) {
      logger.error(`Failed to get performance metrics for content ${contentId}:`, error);
      return null;
    }
  }

  private aggregateMetrics(analytics: ContentAnalytics[]): any {
    const totals = analytics.reduce((acc, a) => ({
      reach: acc.reach + a.metrics.reach,
      impressions: acc.impressions + a.metrics.impressions,
      likes: acc.likes + (a.metrics.engagement_rate * a.metrics.reach * 0.3), // Estimate
      comments: acc.comments + (a.metrics.engagement_rate * a.metrics.reach * 0.1),
      shares: acc.shares + (a.metrics.engagement_rate * a.metrics.reach * 0.05),
      saves: acc.saves + (a.metrics.engagement_rate * a.metrics.reach * 0.15),
      clicks: acc.clicks + (a.metrics.click_through_rate * a.metrics.impressions),
      conversions: acc.conversions + (a.metrics.conversion_rate * a.metrics.reach)
    }), {
      reach: 0, impressions: 0, likes: 0, comments: 0, 
      shares: 0, saves: 0, clicks: 0, conversions: 0
    });
    
    const totalEngagement = totals.likes + totals.comments + totals.shares + totals.saves;
    
    return {
      reach: totals.reach,
      impressions: totals.impressions,
      engagement: {
        likes: Math.round(totals.likes),
        comments: Math.round(totals.comments),
        shares: Math.round(totals.shares),
        saves: Math.round(totals.saves),
        total: Math.round(totalEngagement),
        rate: totals.reach > 0 ? totalEngagement / totals.reach : 0
      },
      clickThrough: {
        clicks: Math.round(totals.clicks),
        rate: totals.impressions > 0 ? totals.clicks / totals.impressions : 0
      },
      conversion: {
        conversions: Math.round(totals.conversions),
        rate: totals.reach > 0 ? totals.conversions / totals.reach : 0
      }
    };
  }

  private aggregateDemographics(analytics: ContentAnalytics[]): any {
    // Simplified demographics aggregation
    return {
      ageGroups: { '18-24': 25, '25-34': 35, '35-44': 25, '45+': 15 },
      genderSplit: { 'Female': 60, 'Male': 35, 'Other': 5 },
      locations: { 'US': 50, 'Canada': 20, 'UK': 15, 'Other': 15 },
      interests: { 'Wellness': 80, 'Health': 70, 'Technology': 40, 'Lifestyle': 60 }
    };
  }

  private calculatePerformanceScore(metrics: any): number {
    // Weighted performance score calculation
    const engagementScore = Math.min(metrics.engagement.rate * 1000, 50); // Max 50 points
    const clickScore = Math.min(metrics.clickThrough.rate * 2000, 25); // Max 25 points
    const conversionScore = Math.min(metrics.conversion.rate * 5000, 25); // Max 25 points
    
    return Math.round(engagementScore + clickScore + conversionScore);
  }

  private async calculateRankings(content: ContentPiece, metrics: any): Promise<any> {
    // Simplified ranking calculation
    // In production, this would compare against all content in the database
    return {
      overallRank: Math.floor(Math.random() * 100) + 1,
      categoryRank: Math.floor(Math.random() * 50) + 1,
      platformRank: Math.floor(Math.random() * 30) + 1
    };
  }
}

export default TrendDetector;