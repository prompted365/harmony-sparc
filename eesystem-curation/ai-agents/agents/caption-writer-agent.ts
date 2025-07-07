/**
 * Caption Writer Agent - EESystem Content Curation Platform
 * Generates captions and hashtags optimized for each platform and EESystem brand
 */

import { Agent, AgentConfig, AgentResponse } from '../types/agent-types';
import { CaptionContent, Platform } from '../types/content-types';
import { EESystemBrandGuidelines } from '../types/brand-types';

export class CaptionWriterAgent implements Agent {
  private config: AgentConfig;
  private brandGuidelines: EESystemBrandGuidelines;
  private memory: Map<string, any>;
  private platformLimits: Map<Platform, number>;

  constructor(config: AgentConfig) {
    this.config = config;
    this.memory = new Map();
    this.brandGuidelines = {
      primaryColor: '#43FAFF',
      themes: ['scalar field technology', 'wellness', 'clarity', 'coherence'],
      voice: 'wellness-focused, scientific, accessible',
      visualStyle: 'clean, modern, minimalist with scalar wave overlays',
      contentThemes: [
        'Clear the Noise - Body-focused content',
        'Wash the Mud - Clarity and transformation',
        'Scalar Field Effects - Technology and wellness',
        'Coherence & Clarity - Mental/emotional wellness'
      ]
    };
    
    this.platformLimits = new Map([
      [Platform.INSTAGRAM, 2200],
      [Platform.FACEBOOK, 2000],
      [Platform.TWITTER, 280],
      [Platform.LINKEDIN, 700],
      [Platform.TIKTOK, 150],
      [Platform.YOUTUBE, 100]
    ]);
  }

  async initialize(): Promise<void> {
    await this.loadHashtagDatabase();
    await this.loadCaptionTemplates();
    await this.initializeMemory();
  }

  async execute(task: string, context?: any): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Store task in memory for coordination
      this.memory.set('current-task', { task, context, startTime });
      
      const caption = await this.createCaption(task, context);
      const optimization = await this.optimizeCaption(caption, context);
      const brandAlignment = await this.checkBrandAlignment(optimization);
      
      const response: AgentResponse = {
        success: true,
        data: {
          caption: optimization,
          brandAlignment,
          platformVariations: await this.createPlatformVariations(optimization, context),
          hashtagAnalysis: this.analyzeHashtags(optimization),
          engagementPrediction: this.predictEngagement(optimization)
        },
        executionTime: Date.now() - startTime,
        agentId: this.config.id,
        timestamp: new Date().toISOString()
      };

      // Store results in memory for other agents
      this.memory.set('latest-caption', response.data);
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        agentId: this.config.id,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async createCaption(task: string, context?: any): Promise<CaptionContent> {
    // Create caption based on task and context
    const platform = this.identifyPlatform(task, context);
    const theme = this.identifyTheme(task, context);
    const contentType = this.identifyContentType(task, context);
    
    const mainCaption = await this.generateMainCaption(task, theme, contentType);
    const hashtags = await this.generateHashtags(theme, contentType, platform);
    const callToAction = await this.generateCallToAction(task, theme, platform);
    const brandMentions = this.generateBrandMentions(theme);
    
    return {
      mainCaption,
      hashtags,
      callToAction,
      brandMentions,
      characterCount: this.calculateCharacterCount(mainCaption, hashtags, callToAction)
    };
  }

  private async optimizeCaption(caption: CaptionContent, context?: any): Promise<CaptionContent> {
    // Optimize caption for engagement and platform requirements
    const platform = this.identifyPlatform('', context);
    const limit = this.platformLimits.get(platform) || 2000;
    
    let optimized = { ...caption };
    
    // Optimize for character limit
    if (optimized.characterCount > limit) {
      optimized = await this.trimCaption(optimized, limit);
    }
    
    // Optimize hashtags for reach
    optimized.hashtags = await this.optimizeHashtags(optimized.hashtags, platform);
    
    // Optimize CTA for conversion
    optimized.callToAction = await this.optimizeCTA(optimized.callToAction, platform);
    
    // Add brand elements
    optimized.brandMentions = this.enhanceBrandMentions(optimized.brandMentions);
    
    // Recalculate character count
    optimized.characterCount = this.calculateCharacterCount(
      optimized.mainCaption,
      optimized.hashtags,
      optimized.callToAction
    );
    
    return optimized;
  }

  private async checkBrandAlignment(caption: CaptionContent): Promise<number> {
    // Check brand alignment of caption
    let alignment = 0;
    
    // Check theme alignment
    const themeScore = this.checkThemeAlignment(caption);
    alignment += themeScore * 0.3;
    
    // Check voice alignment
    const voiceScore = this.checkVoiceAlignment(caption);
    alignment += voiceScore * 0.3;
    
    // Check hashtag brand alignment
    const hashtagScore = this.checkHashtagAlignment(caption);
    alignment += hashtagScore * 0.2;
    
    // Check brand mention inclusion
    const brandMentionScore = this.checkBrandMentions(caption);
    alignment += brandMentionScore * 0.2;
    
    return Math.min(alignment, 100);
  }

  private identifyPlatform(task: string, context?: any): Platform {
    // Identify target platform
    if (task.includes('Instagram') || task.includes('IG')) return Platform.INSTAGRAM;
    if (task.includes('Facebook') || task.includes('FB')) return Platform.FACEBOOK;
    if (task.includes('TikTok') || task.includes('tiktok')) return Platform.TIKTOK;
    if (task.includes('YouTube') || task.includes('youtube')) return Platform.YOUTUBE;
    if (task.includes('Twitter') || task.includes('X')) return Platform.TWITTER;
    if (task.includes('LinkedIn') || task.includes('linkedin')) return Platform.LINKEDIN;
    
    return context?.platform || Platform.INSTAGRAM;
  }

  private identifyTheme(task: string, context?: any): string {
    // Identify content theme
    if (task.includes('Clear') || task.includes('Noise')) return 'Clear the Noise';
    if (task.includes('Wash') || task.includes('Mud')) return 'Wash the Mud';
    if (task.includes('Scalar') || task.includes('Field')) return 'Scalar Field Effects';
    if (task.includes('Clarity') || task.includes('Coherence')) return 'Coherence & Clarity';
    
    return context?.theme || 'General Wellness';
  }

  private identifyContentType(task: string, context?: any): string {
    // Identify content type
    if (task.includes('Reel') || task.includes('reel')) return 'IG Reel';
    if (task.includes('Short') || task.includes('short')) return 'YouTube Short';
    if (task.includes('Story') || task.includes('story')) return 'IG Story';
    if (task.includes('Carousel') || task.includes('carousel')) return 'Carousel';
    if (task.includes('Quote') || task.includes('quote')) return 'Quote';
    
    return context?.contentType || 'Post';
  }

  private async generateMainCaption(task: string, theme: string, contentType: string): Promise<string> {
    // Generate main caption based on theme and content type
    const captionTemplates = {
      'Clear the Noise': {
        'IG Reel': [
          'Noise starts in the body—tension, fatigue, clutter. This week, we're clearing it all with the scalar field. Part 1 of 3.',
          'Your body's where noise begins. Start fresh with scalar energy and feel the difference.',
          'Energy gets trapped—scalar fields loosen it. Feel the flow return to your body.'
        ],
        'Quote': [
          'Your body thrives without static. Let the field subtract what's not yours.',
          'Noise is optional. Choose clarity with scalar energy.',
          'The field reveals what's already yours—pure coherence.'
        ]
      },
      'Wash the Mud': {
        'IG Reel': [
          'Noise fades, clarity shines. Scalar makes it simple.',
          'From noise to clarity—watch the transformation unfold.',
          'Real people, real shifts—watch the noise wash away.'
        ],
        'Quote': [
          'Clarity's a choice. The field subtracts noise, not adds magic.',
          'It's not magic. It's clarity.',
          'Coherence is the goal—wash away the noise.'
        ]
      },
      'Scalar Field Effects': [
        'Scalar energy helps release what's stuck in your body.',
        'The science behind scalar fields and their wellness benefits.',
        'How scalar technology supports your body's natural coherence.'
      ],
      'Coherence & Clarity': [
        'Find your center with scalar field technology.',
        'Clarity comes from coherence—scalar energy shows you how.',
        'Transform your wellness journey with EESystem technology.'
      ]
    };
    
    const themeTemplates = captionTemplates[theme] || captionTemplates['Scalar Field Effects'];
    const templates = Array.isArray(themeTemplates) ? themeTemplates : themeTemplates[contentType] || themeTemplates['IG Reel'] || themeTemplates;
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private async generateHashtags(theme: string, contentType: string, platform: Platform): Promise<string[]> {
    // Generate hashtags based on theme and platform
    const brandHashtags = ['#EESystem', '#ScalarField', '#ScalarEnergy', '#EECoherence'];
    
    const themeHashtags = {
      'Clear the Noise': ['#ClearTheNoise', '#ScalarWellness', '#EnergyClearing', '#BodyWellness'],
      'Wash the Mud': ['#WashTheMud', '#ScalarShift', '#Clarity', '#Transformation'],
      'Scalar Field Effects': ['#FieldEffect', '#ScalarScience', '#WellnessTech', '#EnergyHealing'],
      'Coherence & Clarity': ['#Coherence', '#MentalClarity', '#WellnessJourney', '#InnerBalance']
    };
    
    const generalHashtags = ['#Wellness', '#SelfCare', '#Mindfulness', '#HealthTech', '#WellnessTechnology'];
    
    const platformHashtags = {
      [Platform.INSTAGRAM]: ['#InstaWellness', '#WellnessGram'],
      [Platform.TIKTOK]: ['#WellnessTok', '#HealthHacks'],
      [Platform.YOUTUBE]: ['#WellnessVideo', '#HealthEducation'],
      [Platform.FACEBOOK]: ['#WellnessCommunity', '#HealthAndWellness'],
      [Platform.TWITTER]: ['#WellnessChat', '#HealthTech'],
      [Platform.LINKEDIN]: ['#WellnessProfessional', '#HealthInnovation']
    };
    
    let hashtags = [
      ...brandHashtags,
      ...(themeHashtags[theme] || themeHashtags['Scalar Field Effects']),
      ...generalHashtags.slice(0, 3),
      ...(platformHashtags[platform] || [])
    ];
    
    // Limit hashtags based on platform
    const limits = {
      [Platform.INSTAGRAM]: 30,
      [Platform.TIKTOK]: 20,
      [Platform.YOUTUBE]: 15,
      [Platform.FACEBOOK]: 25,
      [Platform.TWITTER]: 10,
      [Platform.LINKEDIN]: 15
    };
    
    const limit = limits[platform] || 20;
    return hashtags.slice(0, limit);
  }

  private async generateCallToAction(task: string, theme: string, platform: Platform): Promise<string> {
    // Generate call-to-action based on theme and platform
    const ctas = {
      'Clear the Noise': [
        'Comment: What's your body holding onto?',
        'Share if you're ready to clear the noise.',
        'Tag someone who needs to hear this.'
      ],
      'Wash the Mud': [
        'DM us your transformation moment.',
        'Share your clarity journey below.',
        'Tag us with your reset experience!'
      ],
      'Scalar Field Effects': [
        'Book a session to feel the difference.',
        'Find a center near you.',
        'Learn more about scalar technology.'
      ],
      'Coherence & Clarity': [
        'Subscribe for more wellness insights.',
        'Follow for daily clarity tips.',
        'Save this for your wellness journey.'
      ]
    };
    
    const themeCTAs = ctas[theme] || ctas['Scalar Field Effects'];
    return themeCTAs[Math.floor(Math.random() * themeCTAs.length)];
  }

  private generateBrandMentions(theme: string): string[] {
    // Generate brand mentions
    return ['@eesystem', '@energyenhancement', '@scalarfieldtech'];
  }

  private calculateCharacterCount(mainCaption: string, hashtags: string[], callToAction: string): number {
    // Calculate total character count
    const hashtagString = hashtags.join(' ');
    return mainCaption.length + hashtagString.length + callToAction.length + 4; // +4 for spaces
  }

  private async trimCaption(caption: CaptionContent, limit: number): Promise<CaptionContent> {
    // Trim caption to fit character limit
    const trimmed = { ...caption };
    
    if (caption.characterCount <= limit) return trimmed;
    
    // First, try reducing hashtags
    while (trimmed.characterCount > limit && trimmed.hashtags.length > 5) {
      trimmed.hashtags.pop();
      trimmed.characterCount = this.calculateCharacterCount(
        trimmed.mainCaption,
        trimmed.hashtags,
        trimmed.callToAction
      );
    }
    
    // If still over limit, trim main caption
    if (trimmed.characterCount > limit) {
      const availableSpace = limit - trimmed.hashtags.join(' ').length - trimmed.callToAction.length - 4;
      trimmed.mainCaption = trimmed.mainCaption.substring(0, availableSpace - 3) + '...';
      trimmed.characterCount = this.calculateCharacterCount(
        trimmed.mainCaption,
        trimmed.hashtags,
        trimmed.callToAction
      );
    }
    
    return trimmed;
  }

  private async optimizeHashtags(hashtags: string[], platform: Platform): Promise<string[]> {
    // Optimize hashtags for reach and engagement
    const optimized = [...hashtags];
    
    // Ensure brand hashtags are included
    const brandHashtags = ['#EESystem', '#ScalarField'];
    brandHashtags.forEach(brand => {
      if (!optimized.includes(brand)) {
        optimized.unshift(brand);
      }
    });
    
    // Remove duplicate hashtags
    return [...new Set(optimized)];
  }

  private async optimizeCTA(cta: string, platform: Platform): Promise<string> {
    // Optimize CTA for platform
    let optimized = cta;
    
    // Platform-specific optimizations
    if (platform === Platform.INSTAGRAM) {
      if (!cta.includes('Comment') && !cta.includes('Share') && !cta.includes('Tag')) {
        optimized = 'Comment below: ' + cta;
      }
    } else if (platform === Platform.TIKTOK) {
      if (!cta.includes('duet') && !cta.includes('stitch')) {
        optimized = cta + ' 🎵';
      }
    }
    
    return optimized;
  }

  private enhanceBrandMentions(mentions: string[]): string[] {
    // Enhance brand mentions
    const enhanced = [...mentions];
    
    // Ensure key brand accounts are mentioned
    const keyAccounts = ['@eesystem'];
    keyAccounts.forEach(account => {
      if (!enhanced.includes(account)) {
        enhanced.push(account);
      }
    });
    
    return enhanced;
  }

  private async createPlatformVariations(caption: CaptionContent, context?: any): Promise<any> {
    // Create variations for different platforms
    const variations = {};
    
    const platforms = [Platform.INSTAGRAM, Platform.FACEBOOK, Platform.TIKTOK, Platform.YOUTUBE, Platform.TWITTER];
    
    for (const platform of platforms) {
      const limit = this.platformLimits.get(platform) || 2000;
      let variation = { ...caption };
      
      // Adjust for platform character limits
      if (variation.characterCount > limit) {
        variation = await this.trimCaption(variation, limit);
      }
      
      // Platform-specific hashtag adjustments
      variation.hashtags = await this.optimizeHashtags(variation.hashtags, platform);
      
      // Platform-specific CTA adjustments
      variation.callToAction = await this.optimizeCTA(variation.callToAction, platform);
      
      variations[platform] = variation;
    }
    
    return variations;
  }

  private analyzeHashtags(caption: CaptionContent): any {
    // Analyze hashtag effectiveness
    const brandHashtags = caption.hashtags.filter(tag => 
      tag.includes('EESystem') || tag.includes('Scalar') || tag.includes('EE')
    );
    
    const themeHashtags = caption.hashtags.filter(tag =>
      tag.includes('Clear') || tag.includes('Wash') || tag.includes('Clarity') || tag.includes('Coherence')
    );
    
    const generalHashtags = caption.hashtags.filter(tag =>
      tag.includes('Wellness') || tag.includes('Health') || tag.includes('Mindfulness')
    );
    
    return {
      total: caption.hashtags.length,
      brand: brandHashtags.length,
      theme: themeHashtags.length,
      general: generalHashtags.length,
      brandAlignment: (brandHashtags.length + themeHashtags.length) / caption.hashtags.length * 100
    };
  }

  private predictEngagement(caption: CaptionContent): any {
    // Predict engagement based on caption elements
    let score = 50; // Base score
    
    // Boost for questions
    if (caption.mainCaption.includes('?') || caption.callToAction.includes('?')) {
      score += 15;
    }
    
    // Boost for CTAs
    if (caption.callToAction.includes('Comment') || caption.callToAction.includes('Share')) {
      score += 10;
    }
    
    // Boost for brand hashtags
    const brandHashtagCount = caption.hashtags.filter(tag => 
      tag.includes('EESystem') || tag.includes('Scalar')
    ).length;
    score += brandHashtagCount * 5;
    
    // Penalty for too long
    if (caption.characterCount > 1500) {
      score -= 10;
    }
    
    return {
      predictedScore: Math.min(score, 100),
      factors: {
        hasQuestion: caption.mainCaption.includes('?'),
        hasStrongCTA: caption.callToAction.includes('Comment'),
        brandHashtags: brandHashtagCount,
        length: caption.characterCount
      }
    };
  }

  private checkThemeAlignment(caption: CaptionContent): number {
    // Check theme alignment
    let alignment = 0;
    const content = caption.mainCaption + ' ' + caption.callToAction;
    
    this.brandGuidelines.themes.forEach(theme => {
      if (content.toLowerCase().includes(theme.toLowerCase())) {
        alignment += 25;
      }
    });
    
    return Math.min(alignment, 100);
  }

  private checkVoiceAlignment(caption: CaptionContent): number {
    // Check voice alignment
    let alignment = 0;
    const content = caption.mainCaption + ' ' + caption.callToAction;
    const voiceKeywords = ['wellness', 'scientific', 'accessible', 'clarity', 'coherence'];
    
    voiceKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        alignment += 20;
      }
    });
    
    return Math.min(alignment, 100);
  }

  private checkHashtagAlignment(caption: CaptionContent): number {
    // Check hashtag brand alignment
    const brandHashtags = caption.hashtags.filter(tag =>
      tag.includes('EESystem') || tag.includes('Scalar') || tag.includes('EE')
    );
    
    return (brandHashtags.length / caption.hashtags.length) * 100;
  }

  private checkBrandMentions(caption: CaptionContent): number {
    // Check brand mention inclusion
    const hasEESystem = caption.brandMentions.some(mention => mention.includes('eesystem'));
    return hasEESystem ? 100 : 0;
  }

  private async loadHashtagDatabase(): Promise<void> {
    // Load hashtag performance database
    console.log('Loading hashtag database...');
  }

  private async loadCaptionTemplates(): Promise<void> {
    // Load caption templates
    console.log('Loading caption templates...');
  }

  private async initializeMemory(): Promise<void> {
    // Initialize memory for coordination
    this.memory.set('agent-type', 'caption-writer');
    this.memory.set('brand-guidelines', this.brandGuidelines);
    this.memory.set('platform-limits', this.platformLimits);
    this.memory.set('initialized', true);
  }

  getMemory(): Map<string, any> {
    return this.memory;
  }

  getConfig(): AgentConfig {
    return this.config;
  }
}