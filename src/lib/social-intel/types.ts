export type SocialPlatform = 'instagram' | 'twitter' | 'tiktok' | 'facebook';

export interface SocialIntelInput {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  facebook?: string;
}

export interface SocialEvidence {
  platform: SocialPlatform;
  excerpt: string;
  url?: string;
}

export interface LabelConfidence {
  label: string;
  confidence: number;
}

export interface SocialIntelIndicators {
  politicalOrientationScore: number;
  customsScore: number;
  economicScore: number;
  religiosityScore: number;
  polarizationScore: number;
  consistencyScore: number;
  likelyPoliticalSide: LabelConfidence[];
  likelyReligions: LabelConfidence[];
  likelyTeams: LabelConfidence[];
  confidence: number;
}

export interface SocialIntelDetailed {
  identity: string;
  politicalPanorama: string;
  beliefs: string;
  interests: string;
  communicationStyle: string;
}

export interface SocialIntelCoverage {
  profilesAnalyzed: number;
  platformsAnalyzed: SocialPlatform[];
  totalPostsAnalyzed: number;
  totalTextsAnalyzed: number;
}

export interface PlatformBreakdown {
  platform: SocialPlatform;
  postsAnalyzed: number;
  topTopics: LabelConfidence[];
  politicalScore: number;
  religiosityScore: number;
  polarizationScore: number;
}

export interface PoliticalProfile {
  primarySide: string;
  sideConfidence: number;
  economicAxis: string;
  customsAxis: string;
  summary: string;
  keySignals: string[];
}

export interface BeliefProfile {
  religion: string;
  favoriteTeam: string;
  coreValues: string[];
  ideologicalBeliefs: string[];
}

export interface SocialProfileCard {
  platform: SocialPlatform;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  followers?: number;
}

export interface SocialIntelReport {
  quickSummary: string[];
  executiveSummary: string;
  detailed: SocialIntelDetailed;
  indicators: SocialIntelIndicators;
  topInterests: LabelConfidence[];
  topTopics: LabelConfidence[];
  evidence: SocialEvidence[];
  profiles: SocialProfileCard[];
  platformBreakdown: PlatformBreakdown[];
  politicalProfile: PoliticalProfile;
  beliefProfile: BeliefProfile;
  contradictions: string[];
  recommendations: string[];
  coverage: SocialIntelCoverage;
  warnings: string[];
}
