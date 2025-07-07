/**
 * EESystem Brand Guidelines Type Definitions
 */

export interface EESystemBrandGuidelines {
  primaryColor: string;
  themes: string[];
  voice: string;
  visualStyle: string;
  contentThemes: string[];
}

export interface BrandCompliance {
  score: number;
  issues: string[];
  recommendations: string[];
  approved: boolean;
}

export interface VisualBrandRequirements {
  primaryColor: string;
  secondaryColors: string[];
  typography: Typography;
  imagery: ImageryGuidelines;
  logo: LogoGuidelines;
  layout: LayoutGuidelines;
}

export interface Typography {
  primaryFont: string;
  secondaryFont: string;
  headingSize: string;
  bodySize: string;
  lineHeight: number;
}

export interface ImageryGuidelines {
  style: string;
  colorPalette: string[];
  filters: string[];
  overlays: string[];
  scalarWaveEffect: boolean;
}

export interface LogoGuidelines {
  placement: string[];
  minSize: string;
  clearSpace: string;
  colorVariations: string[];
}

export interface LayoutGuidelines {
  grid: string;
  spacing: string;
  alignment: string;
  whitespace: string;
}

export interface ContentVoiceGuidelines {
  tone: string;
  personality: string[];
  vocabulary: VocabularyGuidelines;
  messaging: MessagingGuidelines;
}

export interface VocabularyGuidelines {
  preferredTerms: string[];
  avoidTerms: string[];
  brandTerms: string[];
  technicalTerms: string[];
}

export interface MessagingGuidelines {
  keyMessages: string[];
  valuePropositions: string[];
  benefits: string[];
  features: string[];
}

export interface ComplianceGuidelines {
  healthClaims: HealthClaimsGuidelines;
  legalRequirements: string[];
  disclaimers: string[];
  approvalProcess: ApprovalProcess;
}

export interface HealthClaimsGuidelines {
  allowedClaims: string[];
  prohibitedClaims: string[];
  requiresDisclaimer: string[];
  requiresApproval: string[];
}

export interface ApprovalProcess {
  steps: string[];
  reviewers: string[];
  timeline: string;
  escalation: string[];
}