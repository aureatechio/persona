// Arena PWA — Types (ported from mobile)

export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  user_type?: string;
  ideology?: 'esquerda' | 'centro' | 'direita';
  state?: string;
  city?: string;
  avatar_url?: string;
  audience_filter?: 'esquerda' | 'centro' | 'direita' | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SegmentItem {
  label: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore: number;
}

export interface AllSegments {
  gender: SegmentItem[];
  religion: SegmentItem[];
  race: SegmentItem[];
  region: SegmentItem[];
  generation: SegmentItem[];
  socialClass: SegmentItem[];
  education: SegmentItem[];
  politicalLeaning: SegmentItem[];
  voto2022: SegmentItem[];
  aprovacaoLula: SegmentItem[];
  voto2026: SegmentItem[];
  archetype: SegmentItem[];
  clusterMacro: SegmentItem[];
  scoreEco: SegmentItem[];
  scoreCost: SegmentItem[];
}

export interface CommentResult {
  archetype: string;
  sentiment: Sentiment;
  comment: string;
  personaName: string;
  age: number;
  city?: string;
  location: string;
  state: string;
  region: string;
  generation: string;
  lat?: number;
  lng?: number;
  gender?: string;
  politicalLeaning?: string;
  score?: number;
}

export interface ArchetypeResult {
  id: string;
  name: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
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

export interface CityData {
  city: string;
  lat: number;
  lng: number;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore: number;
}

export interface ContentMeta {
  mediaType: string | string[];
  candidateIdeology: 'direita' | 'esquerda';
  region: string;
  city?: string;
  contentType?: string;
  attachmentType?: 'image' | 'video' | 'audio' | 'text';
}

export interface RadarData {
  alcance: number;
  engajamento: number;
  retencao: number;
  conversao: number;
  adequacao: number;
  emocional: number;
}

export interface PlatformSummary {
  platform: string;
  summary: string;
}

export interface DashboardHighlight {
  segmentName: string;
  type: 'high_approval' | 'high_rejection' | 'high_neutrality';
  percentage: number;
  description: string;
}

export interface AnaliseData {
  headline: string;
  summary?: string;
  platformSummaries?: PlatformSummary[];
  dashboardHighlights?: DashboardHighlight[];
  score: number;
  tags: string[];
  stats: { value: string; label: string }[];
  recommendations: { icon: string; text: string; gain: string; priority: string; detail: string }[];
  insight: { title: string; description: string; action: string };
  nextSteps: { title: string; benefit: string; deadline: string }[];
  projectedScore: number;
  radar: RadarData;
}

export interface EnhancedSimulationResult {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  archetypes: ArchetypeResult[];
  clusterResults: ClusterResult[];
  comments: CommentResult[];
  processingTime: number;
  ideologicalPoints: any[];
}

export interface GeoCity {
  city: string;
  state: string;
  lat: number;
  lng: number;
  personaCount: number;
}

export interface ArenaLiveData {
  question: string;
  phase: 'collecting' | 'streaming' | 'aggregating' | 'complete';
  processedCount: number;
  totalCount: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore: number;
  scoreSum: number;
  simulation: EnhancedSimulationResult | null;
  totalPersonas?: number;
  segments?: Partial<AllSegments>;
  stateBreakdown?: Record<string, { count: number; positive: number; negative: number; neutral: number; avgScore?: number }>;
  cityBreakdown?: Record<string, CityData[]>;
  liveComments?: CommentResult[];
  contentMeta?: ContentMeta;
  geoCities?: GeoCity[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'video';
  uri?: string;
  base64?: string;
  mimeType?: string;
  name: string;
  file?: File;
}
