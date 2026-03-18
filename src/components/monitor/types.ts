import {
  Search, Brain, Globe, ShieldCheck, Users,
  Cpu, BarChart3, FileText,
} from 'lucide-react';
import { createElement } from 'react';
import type { AllSegments } from '@/lib/arena/segments';

/* ================================================================
   Types
   ================================================================ */

export type NodeStatus = 'idle' | 'running' | 'complete' | 'error' | 'skipped';

export interface LogEntry {
  id: string;
  timestamp: number;
  step: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  detail?: Record<string, unknown>;
}

export interface BatchDetail {
  model: string;
  persona_count: number;
  personas_summary: Array<{
    id: string;
    name: string;
    state: string;
    age: number;
    sentiment: string;
    comment: string;
    score?: number;
  }>;
}

export interface ContextExtractionData {
  rawTranscript: string | null;
  title: string | null;
  author: string | null;
  corePoint: string | null;
  claudeSummary: string | null;
  enrichedContext: string | null;
  generatedQuestion: string | null;
  politicalFigures: Array<{ nome: string; alinhamento: string; posicao_autor: string }> | null;
}

/* Step detail data stored from verbose events */
export interface QueryAnalyzerData {
  needs_research: boolean;
  reason: string;
}

export interface WebResearchData {
  queries: string[];
  snippets: string[];
  sources: string[];
}

export interface ContextData {
  tema: string;
  contexto: string;
  figuras: Array<Record<string, unknown>>;
  periodo: string;
}

export interface ValidatorData {
  verdict: string;
  issues: string[];
  corrections: string;
  fullContext?: string;
  figuras?: Array<Record<string, unknown>>;
}

export interface PromptSampleData {
  system_prompt: string;
  user_prompt: string;
  persona_count: number;
  note: string;
}

export interface StepDetails {
  queryAnalyzer: QueryAnalyzerData | null;
  webResearch: WebResearchData | null;
  context: ContextData | null;
  validator: ValidatorData | null;
  promptSample: PromptSampleData | null;
  ideologicalFrame: string | null;
}

export interface PipelineState {
  question: string;
  topic: string;
  corePoint: string;
  contextExtraction: ContextExtractionData | null;
  nodes: Record<string, NodeStatus>;
  logs: LogEntry[];
  batches: BatchDetail[];
  stepDetails: StepDetails;
  progress: { processed: number; total: number; positive: number; negative: number; neutral: number };
  avgScore: number;
  segments: AllSegments | null;
  startTime: number | null;
  endTime: number | null;
  listening: boolean;
}

/* ================================================================
   Constants
   ================================================================ */

export const initialStepDetails: StepDetails = {
  queryAnalyzer: null,
  webResearch: null,
  context: null,
  validator: null,
  promptSample: null,
  ideologicalFrame: null,
};

export const initialState: PipelineState = {
  question: '',
  topic: '',
  corePoint: '',
  contextExtraction: null,
  nodes: {
    contextExtraction: 'idle',
    queryAnalyzer: 'idle',
    webResearch: 'idle',
    contextBuilder: 'idle',
    contextValidator: 'idle',
    personaLoader: 'idle',
    personaLoop: 'idle',
    aggregator: 'idle',
  },
  logs: [],
  batches: [],
  stepDetails: { ...initialStepDetails },
  progress: { processed: 0, total: 0, positive: 0, negative: 0, neutral: 0 },
  avgScore: 0,
  segments: null,
  startTime: null,
  endTime: null,
  listening: false,
};

export const MONITOR_CHANNEL = 'arena-monitor';

/* ================================================================
   Node Config
   ================================================================ */

export const NODE_ICONS: Record<string, React.ReactNode> = {
  contextExtraction: createElement(FileText, { size: 16 }),
  queryAnalyzer: createElement(Search, { size: 16 }),
  webResearch: createElement(Globe, { size: 16 }),
  contextBuilder: createElement(Brain, { size: 16 }),
  contextValidator: createElement(ShieldCheck, { size: 16 }),
  personaLoader: createElement(Users, { size: 16 }),
  personaLoop: createElement(Cpu, { size: 16 }),
  aggregator: createElement(BarChart3, { size: 16 }),
};

export const NODE_LABELS: Record<string, string> = {
  contextExtraction: 'Extracao de Contexto',
  queryAnalyzer: 'Analise da Pergunta',
  webResearch: 'Pesquisa na Web',
  contextBuilder: 'Construcao de Contexto',
  contextValidator: 'Validacao de Contexto',
  personaLoader: 'Carregamento de Personas',
  personaLoop: 'Processamento de Personas',
  aggregator: 'Agregacao de Resultados',
};

export const NODE_DESCRIPTIONS: Record<string, string> = {
  contextExtraction: 'Transcricao e contexto extraidos da midia',
  queryAnalyzer: 'Claude Sonnet 4 decide se precisa pesquisa web',
  webResearch: 'Tavily busca 3 queries na web em paralelo',
  contextBuilder: 'Claude Sonnet 4 cria contexto factual neutro',
  contextValidator: 'Claude Sonnet 4 valida precisao e neutralidade',
  personaLoader: 'Carrega 20.000 personas do Supabase',
  personaLoop: 'Processa batches em paralelo com Claude + GPT',
  aggregator: 'Agrega sentimentos, segmentos e comentarios',
};

export const nodeOrder = ['contextExtraction', 'queryAnalyzer', 'webResearch', 'contextBuilder', 'contextValidator', 'personaLoader', 'personaLoop', 'aggregator'];

export const SEGMENT_LABELS: Record<string, string> = {
  gender: 'Gênero', religion: 'Religião', race: 'Raça/Cor', region: 'Região',
  generation: 'Geração', socialClass: 'Classe Social', education: 'Escolaridade',
  politicalLeaning: 'Posição Política', voto2022: 'Voto 2022', aprovacaoLula: 'Aprovação Lula',
  voto2026: 'Voto 2026', archetype: 'Arquétipo', clusterMacro: 'Cluster Macro',
  scoreEco: 'Eixo Econômico', scoreCost: 'Eixo Costumes',
};
