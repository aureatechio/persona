// ── Arena Types ──────────────────────────────────────────────────────────────

export type Phase = 'idle' | 'processing' | 'results';
export type Sentiment = 'positive' | 'negative' | 'neutral';

// ── Impact Score System (0-10) ──────────────────────────────────────────────

export type ImpactScore = number; // 0.0 to 10.0

/** Maps a 0-10 score to the psychological reading emoji */
export function scoreToEmoji(score: number): string {
  if (score <= 1) return '💣';
  if (score <= 3) return '😡';
  if (score <= 5) return '😐';
  if (score <= 7) return '👍';
  if (score <= 9) return '❤️';
  return '🔥';
}

/** Maps a 0-10 score to a human-readable label */
export function scoreToLabel(score: number): string {
  if (score <= 1) return 'Rejeição total';
  if (score <= 3) return 'Rejeição';
  if (score <= 5) return 'Indiferença';
  if (score <= 7) return 'Aceitou';
  if (score <= 9) return 'Gostou';
  return 'Impacto máximo';
}

/** Maps a 0-10 score to a Tailwind color class (text-*) */
export function scoreToColor(score: number): string {
  if (score <= 2) return 'text-rose-400';
  if (score <= 4) return 'text-orange-400';
  if (score <= 6) return 'text-amber-400';
  if (score <= 8) return 'text-emerald-400';
  return 'text-emerald-300';
}

/** Maps a 0-10 score to a raw hex color for canvas/svg */
export function scoreToHex(score: number): string {
  if (score <= 2) return '#fb7185';  // rose-400
  if (score <= 4) return '#fb923c';  // orange-400
  if (score <= 6) return '#fbbf24';  // amber-400
  if (score <= 8) return '#34d399';  // emerald-400
  return '#6ee7b7';                  // emerald-300
}

/** Bridge: converts a 0-10 score back to categorical sentiment */
export function scoreToSentiment(score: number): Sentiment {
  if (score >= 6.5) return 'positive';
  if (score <= 3.5) return 'negative';
  return 'neutral';
}

export interface ArchetypeResult {
  id: string;
  name: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface CommentResult {
  archetype: string;
  sentiment: Sentiment;
  comment: string;
  personaName: string;
  age: number;
  location: string;
  state: string;
  region: string;
  generation: string;
}

export interface ClusterResult {
  id: string;
  name: string;
  macro: 'Progressista' | 'Moderado' | 'Conservador' | 'Transversal';
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface SimulationResult {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  archetypes: ArchetypeResult[];
  clusterResults: ClusterResult[];
  comments: CommentResult[];
  processingTime: number;
}

// ── New types for enhanced 2D analysis ──────────────────────────────────────

export interface IdeologicalPoint {
  personaId: string;
  name: string;
  scoreEco: number;
  scoreCost: number;
  clusterId: string;
  clusterName: string;
  sentiment: Sentiment;
  region: string;
  generation: string;
  educationLevel: string;
}

export type Quadrant =
  | 'esq_progressista'
  | 'esq_conservador'
  | 'dir_conservador'
  | 'dir_progressista';

export interface QuadrantResult {
  quadrant: Quadrant;
  label: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  dominantClusters: string[];
}

export interface RegionResult {
  region: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface GenerationResult {
  generation: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  avgAge: number;
}

export interface EducationResult {
  level: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  avgIntensity: number;
}

export type PoliticalFigure = 'lula' | 'bolsonaro';

export interface PoliticalFigureDetection {
  figure: PoliticalFigure;
  label: string;
  supportCount: number;
  attackCount: number;
  neutralCount: number;
  supportClusters: string[];
  attackClusters: string[];
}

export interface IntensityBand {
  label: string;
  range: [number, number];
  count: number;
  avgSentimentScore: number;
}

export interface EnhancedSimulationResult extends SimulationResult {
  ideologicalPoints: IdeologicalPoint[];
  quadrants: QuadrantResult[];
  regions: RegionResult[];
  generations: GenerationResult[];
  educationLevels: EducationResult[];
  politicalFigures: PoliticalFigureDetection[];
  intensityBands: IntensityBand[];
}

// ── SSE Event Types (Python Arena Backend) ──────────────────────────────────

export type ArenaSSEEventType =
  | 'phase'
  | 'web_complete'
  | 'context'
  | 'validation'
  | 'personas_loaded'
  | 'progress'
  | 'results'
  | 'done';

export interface ArenaSSEContext {
  tema: string;
  contexto: string;
  figuras: Array<{ nome: string; cargo: string; relevancia?: string }>;
  periodo: string;
}

export interface ArenaSSEProgress {
  processed: number;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface ArenaSSEDone {
  processing_time_ms: number;
  total_personas: number;
  total_comments: number;
  total_tokens: number;
}
