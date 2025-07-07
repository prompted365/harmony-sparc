/**
 * Compliance Agent - EESystem Content Curation Platform
 * Ensures health claims compliance and regulatory adherence for EESystem content
 */

import { Agent, AgentConfig, AgentResponse } from '../types/agent-types';
import { ComplianceCheck, HealthClaimsCheck, LegalComplianceCheck, BrandComplianceCheck } from '../types/content-types';
import { EESystemBrandGuidelines, ComplianceGuidelines } from '../types/brand-types';

export class ComplianceAgent implements Agent {
  private config: AgentConfig;
  private brandGuidelines: EESystemBrandGuidelines;
  private complianceGuidelines: ComplianceGuidelines;
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
    
    this.complianceGuidelines = {
      healthClaims: {
        allowedClaims: [
          'supports wellness',
          'promotes relaxation',
          'enhances well-being',
          'may help with stress management',
          'supports energy balance'
        ],
        prohibitedClaims: [
          'cures disease',
          'treats medical conditions',
          'replaces medical treatment',
          'guarantees health outcomes',
          'prevents illness'
        ],
        requiresDisclaimer: [
          'energy enhancement',
          'scalar field effects',
          'wellness benefits',
          'health optimization'
        ],
        requiresApproval: [
          'research studies',
          'scientific claims',
          'medical testimonials',
          'health comparisons'
        ]
      },
      legalRequirements: [
        'Include FDA disclaimer when applicable',
        'Avoid medical advice language',
        'Use qualifying language (may, might, could)',
        'Include "individual results may vary"',
        'Respect intellectual property'
      ],
      disclaimers: [
        'This product has not been evaluated by the FDA',
        'Individual results may vary',
        'Not intended to diagnose, treat, cure, or prevent any disease',
        'Consult your healthcare provider before use'
      ],
      approvalProcess: {
        steps: ['Content Review', 'Health Claims Verification', 'Legal Review', 'Final Approval'],
        reviewers: ['Compliance Officer', 'Legal Team', 'Medical Advisor'],
        timeline: '24-48 hours',
        escalation: ['Senior Compliance', 'Legal Counsel', 'Executive Team']
      }
    };
  }

  async initialize(): Promise<void> {
    await this.loadComplianceDatabase();
    await this.loadRegulatory Guidelines();
    await this.initializeMemory();
  }

  async execute(task: string, context?: any): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Store task in memory for coordination
      this.memory.set('current-task', { task, context, startTime });
      
      const complianceCheck = await this.performComplianceCheck(task, context);
      const recommendations = await this.generateRecommendations(complianceCheck);
      const requiredActions = await this.identifyRequiredActions(complianceCheck);
      
      const response: AgentResponse = {
        success: true,
        data: {
          complianceCheck,
          recommendations,
          requiredActions,
          approvalStatus: this.determineApprovalStatus(complianceCheck),
          riskAssessment: this.assessRisk(complianceCheck)
        },
        executionTime: Date.now() - startTime,
        agentId: this.config.id,
        timestamp: new Date().toISOString()
      };

      // Store results in memory for other agents
      this.memory.set('latest-compliance-check', response.data);
      
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

  private async performComplianceCheck(task: string, context?: any): Promise<ComplianceCheck> {
    // Perform comprehensive compliance check
    const content = this.extractContent(task, context);
    const contentId = context?.contentId || this.generateContentId();
    
    const healthClaims = await this.checkHealthClaims(content);
    const legalCompliance = await this.checkLegalCompliance(content);
    const brandCompliance = await this.checkBrandCompliance(content);
    
    const overallScore = this.calculateOverallScore(healthClaims, legalCompliance, brandCompliance);
    const approved = this.determineApproval(healthClaims, legalCompliance, brandCompliance);
    const issues = this.compileIssues(healthClaims, legalCompliance, brandCompliance);
    const recommendations = this.compileRecommendations(healthClaims, legalCompliance, brandCompliance);
    
    return {
      contentId,
      healthClaims,
      legalCompliance,
      brandCompliance,
      overallScore,
      approved,
      issues,
      recommendations
    };
  }

  private async checkHealthClaims(content: string): Promise<HealthClaimsCheck> {
    // Check health claims compliance
    const flaggedClaims = this.identifyProhibitedClaims(content);
    const requiredDisclaimers = this.identifyRequiredDisclaimers(content);
    const score = this.calculateHealthClaimsScore(content, flaggedClaims);
    const approved = flaggedClaims.length === 0;
    
    return {
      score,
      flaggedClaims,
      requiredDisclaimers,
      approved
    };
  }

  private async checkLegalCompliance(content: string): Promise<LegalComplianceCheck> {
    // Check legal compliance
    const issues = this.identifyLegalIssues(content);
    const requiredDisclosures = this.identifyRequiredDisclosures(content);
    const score = this.calculateLegalScore(content, issues);
    const approved = issues.length === 0;
    
    return {
      score,
      issues,
      requiredDisclosures,
      approved
    };
  }

  private async checkBrandCompliance(content: string): Promise<BrandComplianceCheck> {
    // Check brand compliance
    const visualCompliance = this.checkVisualCompliance(content);
    const voiceCompliance = this.checkVoiceCompliance(content);
    const messageCompliance = this.checkMessageCompliance(content);
    
    const score = (visualCompliance + voiceCompliance + messageCompliance) / 3;
    const approved = score >= 70;
    
    return {
      score,
      visualCompliance,
      voiceCompliance,
      messageCompliance,
      approved
    };
  }

  private identifyProhibitedClaims(content: string): string[] {
    // Identify prohibited health claims
    const flagged = [];
    const contentLower = content.toLowerCase();
    
    this.complianceGuidelines.healthClaims.prohibitedClaims.forEach(claim => {
      if (contentLower.includes(claim.toLowerCase())) {
        flagged.push(claim);
      }
    });
    
    // Check for absolute claims
    const absoluteTerms = ['cure', 'heal', 'treat', 'fix', 'eliminate', 'guarantee'];
    absoluteTerms.forEach(term => {
      if (contentLower.includes(term)) {
        flagged.push(`Absolute claim: "${term}"`);
      }
    });
    
    // Check for medical language
    const medicalTerms = ['disease', 'syndrome', 'disorder', 'condition', 'diagnosis'];
    medicalTerms.forEach(term => {
      if (contentLower.includes(term)) {
        flagged.push(`Medical language: "${term}"`);
      }
    });
    
    return flagged;
  }

  private identifyRequiredDisclaimers(content: string): string[] {
    // Identify required disclaimers
    const required = [];
    const contentLower = content.toLowerCase();
    
    this.complianceGuidelines.healthClaims.requiresDisclaimer.forEach(claim => {
      if (contentLower.includes(claim.toLowerCase())) {
        required.push(this.getDisclaimerForClaim(claim));
      }
    });
    
    // Check for wellness claims
    if (contentLower.includes('wellness') || contentLower.includes('health')) {
      required.push('Individual results may vary');
    }
    
    // Check for technology claims
    if (contentLower.includes('scalar') || contentLower.includes('eesystem')) {
      required.push('This product has not been evaluated by the FDA');
    }
    
    return [...new Set(required)]; // Remove duplicates
  }

  private identifyLegalIssues(content: string): string[] {
    // Identify legal compliance issues
    const issues = [];
    const contentLower = content.toLowerCase();
    
    // Check for medical advice language
    if (contentLower.includes('should take') || contentLower.includes('recommended dose') || 
        contentLower.includes('medical advice')) {
      issues.push('Contains medical advice language');
    }
    
    // Check for unsubstantiated claims
    if (contentLower.includes('proven') || contentLower.includes('scientifically proven') ||
        contentLower.includes('clinical studies show')) {
      issues.push('May contain unsubstantiated claims requiring evidence');
    }
    
    // Check for comparison claims
    if (contentLower.includes('better than') || contentLower.includes('superior to') ||
        contentLower.includes('more effective than')) {
      issues.push('Comparative claims require substantiation');
    }
    
    // Check for testimonial compliance
    if (contentLower.includes('testimonial') || contentLower.includes('user says') ||
        contentLower.includes('customer reports')) {
      issues.push('Testimonials require "individual results may vary" disclaimer');
    }
    
    return issues;
  }

  private identifyRequiredDisclosures(content: string): string[] {
    // Identify required legal disclosures
    const disclosures = [];
    const contentLower = content.toLowerCase();
    
    // FDA disclaimer
    if (contentLower.includes('health') || contentLower.includes('wellness') ||
        contentLower.includes('scalar') || contentLower.includes('energy')) {
      disclosures.push('This product has not been evaluated by the FDA');
    }
    
    // Individual results disclaimer
    if (contentLower.includes('results') || contentLower.includes('benefits') ||
        contentLower.includes('effects')) {
      disclosures.push('Individual results may vary');
    }
    
    // Medical disclaimer
    if (contentLower.includes('health') || contentLower.includes('wellness')) {
      disclosures.push('Not intended to diagnose, treat, cure, or prevent any disease');
    }
    
    return [...new Set(disclosures)];
  }

  private calculateHealthClaimsScore(content: string, flaggedClaims: string[]): number {
    // Calculate health claims compliance score
    let score = 100;
    
    // Deduct points for flagged claims
    score -= flaggedClaims.length * 20;
    
    // Bonus for qualifying language
    const qualifiers = ['may', 'might', 'could', 'supports', 'promotes'];
    const qualifierCount = qualifiers.filter(q => 
      content.toLowerCase().includes(q)
    ).length;
    score += Math.min(qualifierCount * 5, 20);
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateLegalScore(content: string, issues: string[]): number {
    // Calculate legal compliance score
    let score = 100;
    
    // Deduct points for issues
    score -= issues.length * 25;
    
    // Bonus for disclaimers
    const hasDisclaimers = this.complianceGuidelines.disclaimers.some(disclaimer =>
      content.toLowerCase().includes(disclaimer.toLowerCase())
    );
    if (hasDisclaimers) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private checkVisualCompliance(content: string): number {
    // Check visual brand compliance
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // Check for brand colors
    if (contentLower.includes('#43faff') || contentLower.includes('scalar blue')) {
      score += 25;
    }
    
    // Check for visual style elements
    if (contentLower.includes('clean') || contentLower.includes('minimalist')) {
      score += 25;
    }
    
    // Check for scalar wave elements
    if (contentLower.includes('scalar wave') || contentLower.includes('wave overlay')) {
      score += 25;
    }
    
    // Check for brand consistency
    if (contentLower.includes('eesystem') || contentLower.includes('scalar')) {
      score += 25;
    }
    
    return score;
  }

  private checkVoiceCompliance(content: string): number {
    // Check voice compliance
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // Check for wellness tone
    if (contentLower.includes('wellness') || contentLower.includes('well-being')) {
      score += 25;
    }
    
    // Check for scientific approach
    if (contentLower.includes('research') || contentLower.includes('study') ||
        contentLower.includes('science')) {
      score += 25;
    }
    
    // Check for accessible language
    if (!this.containsJargon(content)) {
      score += 25;
    }
    
    // Check for brand voice consistency
    if (this.matchesBrandVoice(content)) {
      score += 25;
    }
    
    return score;
  }

  private checkMessageCompliance(content: string): number {
    // Check message compliance
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // Check for theme alignment
    const themeMatch = this.brandGuidelines.contentThemes.some(theme =>
      contentLower.includes(theme.toLowerCase().split(' - ')[0])
    );
    if (themeMatch) score += 50;
    
    // Check for brand messaging
    if (contentLower.includes('clarity') || contentLower.includes('coherence')) {
      score += 25;
    }
    
    // Check for technology messaging
    if (contentLower.includes('scalar field') || contentLower.includes('energy enhancement')) {
      score += 25;
    }
    
    return score;
  }

  private calculateOverallScore(health: HealthClaimsCheck, legal: LegalComplianceCheck, brand: BrandComplianceCheck): number {
    // Calculate overall compliance score
    return Math.round((health.score * 0.4) + (legal.score * 0.4) + (brand.score * 0.2));
  }

  private determineApproval(health: HealthClaimsCheck, legal: LegalComplianceCheck, brand: BrandComplianceCheck): boolean {
    // Determine if content is approved
    return health.approved && legal.approved && brand.approved;
  }

  private compileIssues(health: HealthClaimsCheck, legal: LegalComplianceCheck, brand: BrandComplianceCheck): string[] {
    // Compile all issues
    const issues = [];
    
    if (health.flaggedClaims.length > 0) {
      issues.push(...health.flaggedClaims.map(claim => `Health claim issue: ${claim}`));
    }
    
    if (legal.issues.length > 0) {
      issues.push(...legal.issues.map(issue => `Legal issue: ${issue}`));
    }
    
    if (!brand.approved) {
      issues.push('Brand compliance below threshold');
    }
    
    return issues;
  }

  private compileRecommendations(health: HealthClaimsCheck, legal: LegalComplianceCheck, brand: BrandComplianceCheck): string[] {
    // Compile recommendations
    const recommendations = [];
    
    if (health.flaggedClaims.length > 0) {
      recommendations.push('Revise health claims to use qualifying language');
      recommendations.push('Add required health disclaimers');
    }
    
    if (legal.issues.length > 0) {
      recommendations.push('Address legal compliance issues');
      recommendations.push('Add required legal disclosures');
    }
    
    if (brand.score < 80) {
      recommendations.push('Enhance brand alignment with guidelines');
      recommendations.push('Include more EESystem brand elements');
    }
    
    return recommendations;
  }

  private async generateRecommendations(complianceCheck: ComplianceCheck): Promise<string[]> {
    // Generate detailed recommendations
    const recommendations = [...complianceCheck.recommendations];
    
    // Add specific health recommendations
    if (complianceCheck.healthClaims.score < 80) {
      recommendations.push('Use more qualifying language (may, might, could)');
      recommendations.push('Focus on wellness support rather than treatment claims');
    }
    
    // Add legal recommendations
    if (complianceCheck.legalCompliance.score < 80) {
      recommendations.push('Include FDA disclaimer for health-related content');
      recommendations.push('Add "individual results may vary" disclaimer');
    }
    
    // Add brand recommendations
    if (complianceCheck.brandCompliance.score < 80) {
      recommendations.push('Include #43FAFF brand color prominently');
      recommendations.push('Use EESystem terminology consistently');
    }
    
    return recommendations;
  }

  private async identifyRequiredActions(complianceCheck: ComplianceCheck): Promise<string[]> {
    // Identify required actions for approval
    const actions = [];
    
    if (!complianceCheck.approved) {
      actions.push('Content revision required before publication');
      
      if (complianceCheck.healthClaims.flaggedClaims.length > 0) {
        actions.push('Remove or revise prohibited health claims');
      }
      
      if (complianceCheck.legalCompliance.issues.length > 0) {
        actions.push('Address legal compliance issues');
      }
      
      if (!complianceCheck.brandCompliance.approved) {
        actions.push('Improve brand compliance to meet standards');
      }
    }
    
    // Required disclaimers
    if (complianceCheck.healthClaims.requiredDisclaimers.length > 0) {
      actions.push('Add required health disclaimers');
    }
    
    if (complianceCheck.legalCompliance.requiredDisclosures.length > 0) {
      actions.push('Add required legal disclosures');
    }
    
    return actions;
  }

  private determineApprovalStatus(complianceCheck: ComplianceCheck): string {
    // Determine approval status
    if (complianceCheck.approved) {
      return 'APPROVED';
    } else if (complianceCheck.overallScore >= 70) {
      return 'CONDITIONAL_APPROVAL';
    } else {
      return 'REJECTED';
    }
  }

  private assessRisk(complianceCheck: ComplianceCheck): any {
    // Assess compliance risk
    let riskLevel = 'LOW';
    const riskFactors = [];
    
    if (complianceCheck.healthClaims.flaggedClaims.length > 0) {
      riskLevel = 'HIGH';
      riskFactors.push('Prohibited health claims detected');
    }
    
    if (complianceCheck.legalCompliance.issues.length > 2) {
      riskLevel = 'MEDIUM';
      riskFactors.push('Multiple legal compliance issues');
    }
    
    if (complianceCheck.overallScore < 50) {
      riskLevel = 'HIGH';
      riskFactors.push('Low overall compliance score');
    }
    
    return {
      level: riskLevel,
      factors: riskFactors,
      score: complianceCheck.overallScore
    };
  }

  private extractContent(task: string, context?: any): string {
    // Extract content for compliance checking
    if (context?.content) {
      return typeof context.content === 'string' ? context.content : JSON.stringify(context.content);
    }
    
    if (context?.script) {
      return typeof context.script === 'string' ? context.script : JSON.stringify(context.script);
    }
    
    if (context?.caption) {
      return typeof context.caption === 'string' ? context.caption : JSON.stringify(context.caption);
    }
    
    return task;
  }

  private generateContentId(): string {
    // Generate content ID for tracking
    return 'compliance_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  private getDisclaimerForClaim(claim: string): string {
    // Get appropriate disclaimer for claim
    const disclaimerMap = {
      'energy enhancement': 'Individual results may vary',
      'scalar field effects': 'This product has not been evaluated by the FDA',
      'wellness benefits': 'Not intended to diagnose, treat, cure, or prevent any disease',
      'health optimization': 'Consult your healthcare provider before use'
    };
    
    return disclaimerMap[claim] || 'Individual results may vary';
  }

  private containsJargon(content: string): boolean {
    // Check if content contains too much jargon
    const jargonTerms = ['quantum', 'frequency', 'vibration', 'electromagnetic', 'biofield'];
    const jargonCount = jargonTerms.filter(term => 
      content.toLowerCase().includes(term)
    ).length;
    
    return jargonCount > 2;
  }

  private matchesBrandVoice(content: string): boolean {
    // Check if content matches brand voice
    const voiceKeywords = ['wellness', 'clarity', 'coherence', 'balance', 'harmony'];
    return voiceKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
  }

  private async loadComplianceDatabase(): Promise<void> {
    // Load compliance database
    console.log('Loading compliance database...');
  }

  private async loadRegulatoryGuidelines(): Promise<void> {
    // Load regulatory guidelines
    console.log('Loading regulatory guidelines...');
  }

  private async initializeMemory(): Promise<void> {
    // Initialize memory for coordination
    this.memory.set('agent-type', 'compliance');
    this.memory.set('brand-guidelines', this.brandGuidelines);
    this.memory.set('compliance-guidelines', this.complianceGuidelines);
    this.memory.set('initialized', true);
  }

  getMemory(): Map<string, any> {
    return this.memory;
  }

  getConfig(): AgentConfig {
    return this.config;
  }
}