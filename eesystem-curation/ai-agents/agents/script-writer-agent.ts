/**
 * Script Writer Agent - EESystem Content Curation Platform
 * Creates video scripts and content aligned with EESystem brand guidelines
 */

import { Agent, AgentConfig, AgentResponse } from '../types/agent-types';
import { ScriptContent, ScriptScene } from '../types/content-types';
import { EESystemBrandGuidelines } from '../types/brand-types';

export class ScriptWriterAgent implements Agent {
  private config: AgentConfig;
  private brandGuidelines: EESystemBrandGuidelines;
  private memory: Map<string, any>;

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
  }

  async initialize(): Promise<void> {
    await this.loadScriptTemplates();
    await this.loadBrandVoiceExamples();
    await this.initializeMemory();
  }

  async execute(task: string, context?: any): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Store task in memory for coordination
      this.memory.set('current-task', { task, context, startTime });
      
      const script = await this.createScript(task, context);
      const optimization = await this.optimizeScript(script);
      const brandAlignment = await this.checkBrandAlignment(optimization);
      
      const response: AgentResponse = {
        success: true,
        data: {
          script: optimization,
          brandAlignment,
          wordCount: this.countWords(optimization),
          estimatedDuration: this.estimateDuration(optimization),
          sceneBreakdown: this.analyzeScenes(optimization)
        },
        executionTime: Date.now() - startTime,
        agentId: this.config.id,
        timestamp: new Date().toISOString()
      };

      // Store results in memory for other agents
      this.memory.set('latest-script', response.data);
      
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

  private async createScript(task: string, context?: any): Promise<ScriptContent> {
    // Create script based on task and context
    const contentType = this.identifyContentType(task, context);
    const theme = this.identifyTheme(task, context);
    const duration = this.determineDuration(contentType);
    
    const script: ScriptContent = {
      title: await this.generateTitle(task, theme),
      hook: await this.generateHook(task, theme),
      scenes: await this.generateScenes(task, theme, duration),
      duration: duration,
      callToAction: await this.generateCTA(task, theme),
      brandElements: this.includeBrandElements(theme)
    };
    
    return script;
  }

  private async optimizeScript(script: ScriptContent): Promise<ScriptContent> {
    // Optimize script for engagement and brand alignment
    const optimized = { ...script };
    
    // Optimize hook for first 3 seconds
    optimized.hook = await this.optimizeHook(script.hook);
    
    // Optimize scenes for pacing
    optimized.scenes = await this.optimizeScenes(script.scenes);
    
    // Optimize CTA for conversion
    optimized.callToAction = await this.optimizeCTA(script.callToAction);
    
    // Add brand elements
    optimized.brandElements = this.enhanceBrandElements(script.brandElements);
    
    return optimized;
  }

  private async checkBrandAlignment(script: ScriptContent): Promise<number> {
    // Check brand alignment of script
    let alignment = 0;
    
    // Check theme alignment
    const themeScore = this.checkThemeAlignment(script);
    alignment += themeScore * 0.3;
    
    // Check voice alignment
    const voiceScore = this.checkVoiceAlignment(script);
    alignment += voiceScore * 0.3;
    
    // Check brand element inclusion
    const brandElementScore = this.checkBrandElements(script);
    alignment += brandElementScore * 0.2;
    
    // Check messaging alignment
    const messagingScore = this.checkMessagingAlignment(script);
    alignment += messagingScore * 0.2;
    
    return Math.min(alignment, 100);
  }

  private identifyContentType(task: string, context?: any): string {
    // Identify content type from task
    if (task.includes('Reel') || task.includes('reel')) return 'IG Reel';
    if (task.includes('Short') || task.includes('short')) return 'YouTube Short';
    if (task.includes('TikTok') || task.includes('tiktok')) return 'TikTok';
    if (task.includes('Story') || task.includes('story')) return 'IG Story';
    
    return context?.contentType || 'General Video';
  }

  private identifyTheme(task: string, context?: any): string {
    // Identify theme from task
    if (task.includes('Clear') || task.includes('Noise')) return 'Clear the Noise';
    if (task.includes('Wash') || task.includes('Mud')) return 'Wash the Mud';
    if (task.includes('Scalar') || task.includes('Field')) return 'Scalar Field Effects';
    if (task.includes('Clarity') || task.includes('Coherence')) return 'Coherence & Clarity';
    
    return context?.theme || 'General Wellness';
  }

  private determineDuration(contentType: string): number {
    // Determine duration based on content type
    const durations = {
      'IG Reel': 15,
      'YouTube Short': 30,
      'TikTok': 15,
      'IG Story': 10,
      'General Video': 30
    };
    
    return durations[contentType] || 30;
  }

  private async generateTitle(task: string, theme: string): Promise<string> {
    // Generate title based on task and theme
    const titles = {
      'Clear the Noise': [
        'Clear the Deck—Your Body's First',
        'What's Stuck? Shake It Loose',
        'From Noise to Clarity'
      ],
      'Wash the Mud': [
        'Pathway to Purity',
        'Mud to Mirror: Real Shifts',
        'From Mud to Mirror'
      ],
      'Scalar Field Effects': [
        'Scalar Field Technology Explained',
        'How Scalar Energy Works',
        'The Science of Coherence'
      ],
      'Coherence & Clarity': [
        'Finding Your Center',
        'Clarity's a Choice',
        'It's Not Magic. It's Clarity.'
      ]
    };
    
    const themetitles = titles[theme] || ['Wellness Journey', 'Your Transformation', 'Find Balance'];
    return themeTitle[Math.floor(Math.random() * themeTitle.length)];
  }

  private async generateHook(task: string, theme: string): Promise<string> {
    // Generate engaging hook for first 3 seconds
    const hooks = {
      'Clear the Noise': [
        'Your body's where noise begins.',
        'Noise starts in the body—tension, fatigue, clutter.',
        'Energy gets stuck—scalar fields loosen it.'
      ],
      'Wash the Mud': [
        'Noise fades, clarity shines.',
        'Clear the noise, then wash the mud.',
        'From noise to clarity—watch the mud wash away.'
      ],
      'Scalar Field Effects': [
        'Scalar energy helps release what's stuck.',
        'The field subtracts noise, not adds magic.',
        'Scalar makes it simple.'
      ],
      'Coherence & Clarity': [
        'Clarity's a choice.',
        'Your body thrives without static.',
        'Coherence is the goal.'
      ]
    };
    
    const themeHooks = hooks[theme] || ['Transform your wellness', 'Find your balance', 'Clear your energy'];
    return themeHooks[Math.floor(Math.random() * themeHooks.length)];
  }

  private async generateScenes(task: string, theme: string, duration: number): Promise<ScriptScene[]> {
    // Generate scenes based on theme and duration
    const scenes: ScriptScene[] = [];
    const sceneCount = Math.ceil(duration / 5); // 5 seconds per scene
    
    for (let i = 0; i < sceneCount; i++) {
      const startTime = i * 5;
      const endTime = Math.min((i + 1) * 5, duration);
      
      scenes.push({
        timestamp: `${startTime}-${endTime}s`,
        visual: await this.generateVisualDirection(theme, i),
        audio: await this.generateAudioDirection(theme, i),
        text: await this.generateTextOverlay(theme, i),
        effects: await this.generateEffects(theme, i)
      });
    }
    
    return scenes;
  }

  private async generateCTA(task: string, theme: string): Promise<string> {
    // Generate call-to-action
    const ctas = [
      'Comment: What's your body holding onto?',
      'Tag us with your reset moment!',
      'Book a session to feel the shift.',
      'Find a center near you.',
      'Try it and tag us!',
      'Share if you're ready to simplify.',
      'DM us your moment.',
      'Subscribe for more shifts.'
    ];
    
    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  private includeBrandElements(theme: string): string[] {
    // Include EESystem brand elements
    return [
      '#43FAFF color accent',
      'Scalar wave overlay',
      'EESystem branding',
      'Wellness-focused messaging',
      'Clean, modern aesthetic',
      'Minimalist design'
    ];
  }

  private async optimizeHook(hook: string): Promise<string> {
    // Optimize hook for engagement
    let optimized = hook;
    
    // Ensure hook is attention-grabbing
    if (!hook.includes('?') && !hook.includes('!') && !hook.includes('...')) {
      optimized = hook + '...';
    }
    
    // Add urgency if missing
    if (!hook.includes('now') && !hook.includes('today') && !hook.includes('starts')) {
      optimized = optimized.replace('.', ' now.');
    }
    
    return optimized;
  }

  private async optimizeScenes(scenes: ScriptScene[]): Promise<ScriptScene[]> {
    // Optimize scenes for pacing and engagement
    return scenes.map((scene, index) => {
      const optimized = { ...scene };
      
      // Add transitions between scenes
      if (index > 0) {
        optimized.effects.push('Smooth transition from previous scene');
      }
      
      // Add scalar wave effects
      if (!optimized.effects.includes('scalar wave')) {
        optimized.effects.push('Subtle scalar wave overlay');
      }
      
      return optimized;
    });
  }

  private async optimizeCTA(cta: string): Promise<string> {
    // Optimize call-to-action
    let optimized = cta;
    
    // Add action verbs if missing
    const actionVerbs = ['Comment', 'Share', 'Tag', 'Book', 'Try', 'Find', 'Subscribe'];
    if (!actionVerbs.some(verb => cta.includes(verb))) {
      optimized = 'Take action: ' + cta;
    }
    
    return optimized;
  }

  private enhanceBrandElements(elements: string[]): string[] {
    // Enhance brand elements
    const enhanced = [...elements];
    
    // Ensure key brand elements are included
    const requiredElements = [
      '#43FAFF primary color',
      'Scalar wave effects',
      'EESystem branding',
      'Wellness messaging'
    ];
    
    requiredElements.forEach(element => {
      if (!enhanced.includes(element)) {
        enhanced.push(element);
      }
    });
    
    return enhanced;
  }

  private checkThemeAlignment(script: ScriptContent): number {
    // Check theme alignment
    let alignment = 0;
    const content = script.title + ' ' + script.hook + ' ' + script.callToAction;
    
    this.brandGuidelines.themes.forEach(theme => {
      if (content.toLowerCase().includes(theme.toLowerCase())) {
        alignment += 25;
      }
    });
    
    return Math.min(alignment, 100);
  }

  private checkVoiceAlignment(script: ScriptContent): number {
    // Check voice alignment
    let alignment = 0;
    const content = script.title + ' ' + script.hook + ' ' + script.callToAction;
    const voiceKeywords = ['wellness', 'scientific', 'accessible', 'clarity', 'coherence'];
    
    voiceKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        alignment += 20;
      }
    });
    
    return Math.min(alignment, 100);
  }

  private checkBrandElements(script: ScriptContent): number {
    // Check brand element inclusion
    let alignment = 0;
    const requiredElements = ['#43FAFF', 'scalar', 'EESystem', 'wellness'];
    
    requiredElements.forEach(element => {
      if (script.brandElements.some(be => be.toLowerCase().includes(element.toLowerCase()))) {
        alignment += 25;
      }
    });
    
    return Math.min(alignment, 100);
  }

  private checkMessagingAlignment(script: ScriptContent): number {
    // Check messaging alignment
    let alignment = 0;
    const content = script.title + ' ' + script.hook + ' ' + script.callToAction;
    
    this.brandGuidelines.contentThemes.forEach(theme => {
      if (content.toLowerCase().includes(theme.toLowerCase())) {
        alignment += 25;
      }
    });
    
    return Math.min(alignment, 100);
  }

  private countWords(script: ScriptContent): number {
    // Count words in script
    const content = script.title + ' ' + script.hook + ' ' + script.callToAction;
    return content.split(/\s+/).length;
  }

  private estimateDuration(script: ScriptContent): number {
    // Estimate duration based on word count
    const wordCount = this.countWords(script);
    const wordsPerSecond = 2.5; // Average speaking rate
    return Math.ceil(wordCount / wordsPerSecond);
  }

  private analyzeScenes(script: ScriptContent): any {
    // Analyze scene breakdown
    return {
      totalScenes: script.scenes.length,
      averageSceneLength: script.duration / script.scenes.length,
      effectsUsed: script.scenes.reduce((acc, scene) => acc + scene.effects.length, 0),
      textOverlays: script.scenes.filter(scene => scene.text).length
    };
  }

  private async generateVisualDirection(theme: string, sceneIndex: number): Promise<string> {
    // Generate visual direction for scene
    const visuals = {
      'Clear the Noise': [
        'Close-up of broom sweeping dust in sunlit room',
        'Hands tossing junk into bin with #43FAFF glow',
        'Cloth wiping foggy mirror revealing reflection'
      ],
      'Wash the Mud': [
        'Shaking dusty rug outdoors in bright sunlight',
        'Brushing dirt off hands in slow motion',
        'Wiping grimy window to reveal clear view'
      ]
    };
    
    const themeVisuals = visuals[theme] || ['Clean, modern aesthetic', 'Minimalist composition', 'Scalar wave overlay'];
    return themeVisuals[sceneIndex % themeVisuals.length];
  }

  private async generateAudioDirection(theme: string, sceneIndex: number): Promise<string> {
    // Generate audio direction for scene
    const audio = [
      'Upbeat acoustic track at 90 BPM',
      'Ambient soundscape with 70 BPM',
      'Energetic electronic track at 100 BPM',
      'Soft chime sound effects',
      'Natural cleaning sounds at 20% volume'
    ];
    
    return audio[sceneIndex % audio.length];
  }

  private async generateTextOverlay(theme: string, sceneIndex: number): Promise<string> {
    // Generate text overlay for scene
    const overlays = {
      'Clear the Noise': [
        'Clear the clutter',
        'Start fresh with scalar',
        'Part 1/3'
      ],
      'Wash the Mud': [
        'Shake the energy',
        'Reset with scalar',
        'Part 2/3'
      ]
    };
    
    const themeOverlays = overlays[theme] || ['Transform', 'Clarity', 'Wellness'];
    return themeOverlays[sceneIndex % themeOverlays.length];
  }

  private async generateEffects(theme: string, sceneIndex: number): Promise<string[]> {
    // Generate effects for scene
    const effects = [
      'Dust particle effect overlay',
      'Scalar wave ripple',
      '#43FAFF accent glow',
      'Smooth fade transition',
      'Water droplet sound effect'
    ];
    
    return effects.slice(0, 2); // Return 2 effects per scene
  }

  private async loadScriptTemplates(): Promise<void> {
    // Load script templates
    console.log('Loading script templates...');
  }

  private async loadBrandVoiceExamples(): Promise<void> {
    // Load brand voice examples
    console.log('Loading brand voice examples...');
  }

  private async initializeMemory(): Promise<void> {
    // Initialize memory for coordination
    this.memory.set('agent-type', 'script-writer');
    this.memory.set('brand-guidelines', this.brandGuidelines);
    this.memory.set('content-themes', this.brandGuidelines.contentThemes);
    this.memory.set('initialized', true);
  }

  getMemory(): Map<string, any> {
    return this.memory;
  }

  getConfig(): AgentConfig {
    return this.config;
  }
}