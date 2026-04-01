'use client';

import { create } from 'zustand';

// ── Types ──

export type StepStatus = 'idle' | 'running' | 'complete' | 'error';

export interface StepState {
  status: StepStatus;
  label: string;
  description: string;
  latencyMs?: number;
  tokens?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
}

export interface PersonaProfile {
  gender?: string;
  region?: string;
  city?: string;
  education?: string;
  generation?: string;
  social_class?: string;
  religion?: string;
  race?: string;
  political_leaning?: string;
  archetype?: string;
  cluster?: string;
  cluster_name?: string;
  score_eco?: number;
  score_cost?: number;
  voto_2022?: string;
  voto_2026?: string;
  aprovacao_lula?: string;
  avaliacao_bolsonaro?: string;
  career?: Record<string, any>;
  demographic?: Record<string, any>;
  psychology?: Record<string, any>;
  beliefs?: Record<string, any>;
}

export interface SegmentItem {
  label: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export type AllSegments = Record<string, SegmentItem[]>;

// Legacy types — kept for backward compatibility with PersonaSampleList/PersonaDrillDown
export interface PersonaBatchDetail {
  id: string;
  name: string;
  state: string;
  age: number;
  sentiment: string;
  score: number;
  comment: string;
  user_prompt?: string;
  profile?: PersonaProfile;
}

export interface BatchData {
  batchIndex: number;
  batchTotal: number;
  model: string;
  personaCount: number;
  personas: PersonaBatchDetail[];
}

// ── Specialist Types ──

export interface SpecialistResult {
  id: string;
  name: string;
  emoji: string;
  verdict: string;
  riskLevel: string;
  keyPoints: string[];
  recommendations: { text: string; priority: string; segment?: string }[];
  dataHighlight?: string;
}

export interface SpecialistPanelData {
  consensus: string;
  divergences: string | null;
  specialists: SpecialistResult[];
  processingTimeMs: number;
}

export interface DudaAnalysis {
  headline: string;
  platformSummaries?: { platform: string; summary: string }[];
  summary?: string;
  score: number;
  projectedScore: number;
  recommendations: any[];
  nextSteps: any[];
  radar: Record<string, number>;
  stats?: { value: string; label: string }[];
  insight?: { title: string; description: string; action: string };
  dashboardHighlights?: any[];
  specialistPanel?: any;
  tags?: string[];
}

// ── Pipeline Steps (mirrors production v3) ──

export const PIPELINE_STEPS = [
  { id: 'media_analysis', label: 'Analise de Midia', icon: 'Image' },
  { id: 'context_builder', label: 'Contextualizacao IA', icon: 'Brain' },
  { id: 'ideological_frame', label: 'Mapeamento Ideologico', icon: 'Scale' },
  { id: 'persona_loader', label: 'Carregamento de Personas', icon: 'Users' },
  { id: 'pre_classifier', label: 'Pre-Classificacao Semantica', icon: 'Search' },
  { id: 'aggregate_engine', label: 'Motor de Inferencia', icon: 'Cpu' },
  { id: 'aggregation', label: 'Agregacao de Resultados', icon: 'BarChart3' },
  { id: 'specialists', label: 'Especialistas IA', icon: 'Bot' },
  { id: 'duda_analysis', label: 'Duda Marqueteira', icon: 'Sparkles' },
] as const;

export type StepId = (typeof PIPELINE_STEPS)[number]['id'];

// ── Store ──

export interface CalibrationStore {
  question: string;
  geoFilter: { state?: string; city?: string } | null;
  isProcessing: boolean;
  error: string | null;

  // Pipeline steps
  steps: Record<string, StepState>;
  selectedStep: string | null;

  // Timing
  startTime: number | null;
  endTime: number | null;

  // Progress
  progress: {
    processed: number;
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    avgScore: number;
    scoreSum: number;
  };

  // Segments
  segments: AllSegments | null;

  // Legacy batches (kept for PersonaSampleList compatibility)
  batches: BatchData[];

  // Cost
  cost: { total_usd: number; aggregate_engine?: any; claude_estimated_usd?: number; pre_classifier_estimated_usd?: number } | null;

  // Specialist & Duda
  specialistPanel: SpecialistPanelData | null;
  dudaAnalysis: DudaAnalysis | null;

  // Actions
  selectStep: (step: string | null) => void;
  updateStep: (stepId: string, update: Partial<StepState>) => void;
  reset: () => void;
}

function initialSteps(): Record<string, StepState> {
  const s: Record<string, StepState> = {};
  for (const step of PIPELINE_STEPS) {
    s[step.id] = { status: 'idle', label: step.label, description: '' };
  }
  return s;
}

export const useCalibrationStore = create<CalibrationStore>((set) => ({
  question: '',
  geoFilter: null,
  isProcessing: false,
  error: null,
  steps: initialSteps(),
  selectedStep: null,
  startTime: null,
  endTime: null,
  progress: { processed: 0, total: 0, positive: 0, negative: 0, neutral: 0, avgScore: 5, scoreSum: 0 },
  segments: null,
  batches: [],
  cost: null,
  specialistPanel: null,
  dudaAnalysis: null,

  selectStep: (step) => set({ selectedStep: step }),
  updateStep: (stepId, update) => set((s) => ({
    steps: {
      ...s.steps,
      [stepId]: { ...s.steps[stepId], ...update },
    },
    selectedStep: update.status === 'running' ? stepId : s.selectedStep,
  })),
  reset: () =>
    set({
      question: '', geoFilter: null, isProcessing: false, error: null,
      steps: initialSteps(), selectedStep: null,
      startTime: null, endTime: null,
      progress: { processed: 0, total: 0, positive: 0, negative: 0, neutral: 0, avgScore: 5, scoreSum: 0 },
      segments: null, batches: [], cost: null,
      specialistPanel: null, dudaAnalysis: null,
    }),
}));

// ── Post-Processing (specialists + Duda) ──

async function triggerPostProcessing() {
  const store = useCalibrationStore;
  const { progress, segments, question } = store.getState();

  // --- Step: Specialists ---
  store.getState().updateStep('specialists', {
    status: 'running',
    label: 'Especialistas IA',
    description: '5 agentes analisando em paralelo via Claude...',
  });

  let specialistData: SpecialistPanelData | null = null;

  try {
    const specialistRes = await fetch('/api/calibracao/specialists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        positive: progress.positive,
        negative: progress.negative,
        neutral: progress.neutral,
        totalPersonas: progress.total,
        segments: segments || {},
        contentMeta: {},
      }),
    });

    if (specialistRes.ok) {
      specialistData = await specialistRes.json();
      store.setState({ specialistPanel: specialistData });
      store.getState().updateStep('specialists', {
        status: 'complete',
        latencyMs: specialistData?.processingTimeMs,
        output: specialistData as any,
      });
    } else {
      throw new Error(`Specialist worker: ${specialistRes.status}`);
    }
  } catch (err) {
    store.getState().updateStep('specialists', {
      status: 'error',
      description: `Erro: ${(err as Error).message}`,
    });
  }

  // --- Step: Duda Analysis ---
  store.getState().updateStep('duda_analysis', {
    status: 'running',
    label: 'Duda Marqueteira',
    description: 'Claude Opus gerando recomendacoes estrategicas...',
  });

  try {
    const dudaRes = await fetch('/api/arena/analise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        positive: progress.positive,
        negative: progress.negative,
        neutral: progress.neutral,
        totalPersonas: progress.total,
        segments: segments || {},
        contentMeta: {},
        // Pass pre-computed specialist panel to avoid double-calling
        ...(specialistData ? { specialistPanel: specialistData } : {}),
      }),
    });

    if (dudaRes.ok) {
      const dudaData = await dudaRes.json();
      store.setState({ dudaAnalysis: dudaData });
      store.getState().updateStep('duda_analysis', {
        status: 'complete',
        output: dudaData,
      });
    } else {
      throw new Error(`Duda: ${dudaRes.status}`);
    }
  } catch (err) {
    store.getState().updateStep('duda_analysis', {
      status: 'error',
      description: `Erro: ${(err as Error).message}`,
    });
  }

  // Mark processing as done
  store.setState({ isProcessing: false, endTime: Date.now() });
}

// ── SSE Submit ──

let activeXhr: XMLHttpRequest | null = null;

export async function calibrationSubmit(
  question: string,
  geoFilter?: { state: string; city?: string },
  contextText?: string,
  mode?: 'batch' | 'individual',
) {
  const store = useCalibrationStore;

  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }

  // Preserve media_analysis step if it was already completed by CalibrationInput
  const prevMediaStep = store.getState().steps.media_analysis;
  const mediaWasCompleted = prevMediaStep.status === 'complete';

  store.getState().reset();
  store.setState({
    question,
    geoFilter: geoFilter || null,
    isProcessing: true,
    startTime: Date.now(),
    ...(mediaWasCompleted && {
      steps: {
        ...initialSteps(),
        media_analysis: prevMediaStep,
      },
    }),
  });

  const body: Record<string, unknown> = { question };
  if (geoFilter) body.geo_filter = geoFilter;
  if (contextText) body.context_text = contextText;
  if (mode) body.mode = mode;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    activeXhr = xhr;
    let lastIndex = 0;
    let sseBuffer = '';

    xhr.open('POST', '/api/calibracao/analyze');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');

    function processChunk(text: string) {
      sseBuffer += text;
      const parts = sseBuffer.split('\n\n');
      sseBuffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          handleEvent(JSON.parse(line.slice(6)));
        } catch { /* fragmented */ }
      }
    }

    function handleEvent(payload: { type: string; data: any }) {
      const { type, data } = payload;
      const s = store.getState;

      switch (type) {
        case 'cal_start':
          break;

        case 'cal_step': {
          const stepId = data.step;
          const current = s().steps[stepId];
          if (current) {
            store.setState({
              steps: {
                ...s().steps,
                [stepId]: {
                  ...current,
                  status: data.status,
                  label: data.label || current.label,
                  description: data.description || current.description,
                },
              },
              selectedStep: data.status === 'running' ? stepId : s().selectedStep,
            });
          }
          break;
        }

        case 'cal_step_detail': {
          const stepId = data.step;
          const current = s().steps[stepId];
          if (current) {
            store.setState({
              steps: {
                ...s().steps,
                [stepId]: {
                  ...current,
                  status: data.status || current.status,
                  latencyMs: data.latency_ms ?? current.latencyMs,
                  tokens: data.tokens ?? current.tokens,
                  input: data.input ?? current.input,
                  output: data.output ?? current.output,
                },
              },
              selectedStep: stepId,
            });
          }
          break;
        }

        case 'cal_progress':
          store.setState({
            progress: {
              processed: data.processed,
              total: data.total,
              positive: data.positive,
              negative: data.negative,
              neutral: data.neutral,
              avgScore: data.avgScore ?? 5,
              scoreSum: data.scoreSum ?? 0,
            },
            segments: data.segments ?? s().segments,
          });
          break;

        case 'cal_results':
          store.setState({
            segments: data.segments ?? s().segments,
            progress: {
              ...s().progress,
              processed: data.total,
              total: data.total,
              positive: data.positive,
              negative: data.negative,
              neutral: data.neutral,
              avgScore: data.avgScore ?? 5,
            },
            steps: {
              ...s().steps,
              aggregate_engine: { ...s().steps.aggregate_engine, status: 'complete' },
              aggregation: { ...s().steps.aggregation, status: 'complete' },
            },
          });
          // Trigger frontend post-processing (specialists + Duda)
          triggerPostProcessing();
          break;

        case 'cal_done':
          // Backend is done — but post-processing may still be running
          // isProcessing is set to false by triggerPostProcessing when complete
          store.setState({
            cost: data.cost ?? null,
          });
          break;
      }
    }

    xhr.onprogress = () => {
      const newData = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;
      if (newData) processChunk(newData);
    };

    xhr.onload = () => {
      const remaining = xhr.responseText.substring(lastIndex);
      if (remaining) processChunk(remaining);
      if (sseBuffer.trim().startsWith('data: ')) {
        try { handleEvent(JSON.parse(sseBuffer.trim().slice(6))); } catch {}
      }
      // Don't set isProcessing false here — post-processing handles that
      resolve();
    };

    xhr.onerror = () => {
      store.setState({ isProcessing: false, error: 'Erro de rede', endTime: Date.now() });
      reject(new Error('Network error'));
    };

    xhr.onabort = () => {
      store.setState({ isProcessing: false, endTime: Date.now() });
      resolve();
    };

    xhr.send(JSON.stringify(body));
  });
}

export function calibrationCancel() {
  if (activeXhr) { activeXhr.abort(); activeXhr = null; }
  useCalibrationStore.setState({ isProcessing: false, endTime: Date.now() });
}
