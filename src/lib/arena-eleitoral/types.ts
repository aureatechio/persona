// ── Arena Eleitoral Types ────────────────────────────────────────────────────

// ── Phase Flow ──
export type ElectoralPhase =
  | 'setup'
  | 'researching'
  | 'voting'
  | 'results'
  | 'proposals'
  | 'revoting'
  | 'comparison';

// ── Politician ──
export type PoliticalLeaning =
  | 'esquerda'
  | 'centro-esquerda'
  | 'centro'
  | 'centro-direita'
  | 'direita';

export interface Politician {
  id: string;
  name: string;
  party?: string;
  position?: string;
  leaning?: PoliticalLeaning;
  isCustom?: boolean;
  photoUrl?: string;
}

// ── Persona Vote ──
export type VoteChoice = 'candidateA' | 'candidateB' | 'abstain';

export interface PersonaVote {
  personaId: string;
  personaName: string;
  age: number;
  state: string;
  region: string;
  generation: string;
  educationLevel: string;
  clusterId: string;
  clusterName: string;
  scoreEco: number;
  scoreCost: number;
  politicalLeaning: string;
  vote: VoteChoice;
  confidence: number;
  comment: string;
  criticisms?: string[];
}

// ── Cluster Vote ──
export interface ClusterVoteResult {
  clusterId: string;
  clusterName: string;
  macro: 'Progressista' | 'Moderado' | 'Conservador' | 'Transversal';
  total: number;
  votesA: number;
  votesB: number;
  abstentions: number;
}

// ── Region Vote ──
export interface RegionVoteResult {
  region: string;
  total: number;
  votesA: number;
  votesB: number;
  abstentions: number;
}

// ── Generation Vote ──
export interface GenerationVoteResult {
  generation: string;
  total: number;
  votesA: number;
  votesB: number;
  abstentions: number;
  avgAge: number;
}

// ── Quadrant Vote ──
export interface QuadrantVoteResult {
  quadrant: string;
  label: string;
  total: number;
  votesA: number;
  votesB: number;
  abstentions: number;
}

// ── Round Result ──
export interface RoundResult {
  roundNumber: number;
  totalVoters: number;
  votesA: number;
  votesB: number;
  abstentions: number;
  percentA: number;
  percentB: number;
  votes: PersonaVote[];
  byCluster: ClusterVoteResult[];
  byRegion: RegionVoteResult[];
  byGeneration: GenerationVoteResult[];
  byQuadrant: QuadrantVoteResult[];
  winner: 'candidateA' | 'candidateB' | 'tie';
  processingTime: number;
}

// ── Criticism Behavioral Profile ──
export interface CriticismBehavioralProfile {
  label: string;
  percentage: number;
  insight: string;
}

// ── Criticism Category ──
export interface CriticismCategory {
  category: string;
  description: string;
  voterCount: number;
  sampleComments: string[];
  affectedClusters: string[];
  severity: 'low' | 'medium' | 'high';
  behavioralProfiles: CriticismBehavioralProfile[];
  dominantAge: string;
  dominantRegion: string;
  dominantEducation: string;
  dominantSocialClass: string;
  dominantReligion: string;
  mediaPattern: string;
  psychologicalTrait: string;
  keyObjection: string;
}

// ── Proposal Action Step ──
export interface ProposalActionStep {
  step: number;
  action: string;
  timeline: string;
}

// ── Counter Proposal ──
export interface CounterProposal {
  id: string;
  targetCriticism: string;
  title: string;
  description: string;
  expectedImpact: string;
  targetClusters: string[];
  estimatedFlip: number;
  enabled: boolean;
  strategicRationale: string;
  actionPlan: ProposalActionStep[];
  voterMessage: string;
  ideologicalFit: string;
  risk: string;
  affectedDemographics: string;
}

// ── Voter Shift ──
export interface VoterShift {
  personaId: string;
  personaName: string;
  age: number;
  state: string;
  clusterId: string;
  clusterName: string;
  generation: string;
  previousVote: VoteChoice;
  newVote: VoteChoice;
  reason: string;
}

// ── Electoral Comparison ──
export interface ElectoralComparison {
  previousRound: RoundResult;
  currentRound: RoundResult;
  shifts: VoterShift[];
  totalFlipped: number;
  flippedToA: number;
  flippedToB: number;
  netGainA: number;
  netGainB: number;
}

// ── Round History Entry ──
export interface RoundHistoryEntry {
  roundNumber: number;
  votesA: number;
  votesB: number;
  percentA: number;
  percentB: number;
  proposalsUsed: string[];
  shiftsCount: number;
}

// ── Candidate Color Set ──
export interface CandidateColorSet {
  primary: string;
  bg: string;
  bgSolid: string;
  border: string;
  gradient: string;
  glow: string;
  bar: string;
  dot: string;
}

// ── SSE Event Types ──
export type ElectoralSSEEventType =
  | 'phase'
  | 'web_complete'
  | 'context'
  | 'personas_loaded'
  | 'voting_progress'
  | 'round_results'
  | 'criticisms'
  | 'proposals'
  | 'shifts'
  | 'done';

export interface ElectoralSSEProgress {
  processed: number;
  total: number;
  votesA: number;
  votesB: number;
  abstentions: number;
}
