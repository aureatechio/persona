'use client';

import { create } from 'zustand';
import type { NodeStatus } from '@/components/monitor/types';

// ── Types ──

export interface PreClassResult {
  type: string;
  figures: Array<{ name: string; stance: string; confidence: number }>;
  core_position: string;
  classification_guide: {
    positive_means: string;
    negative_means: string;
    neutral_means: string;
  };
  relevant_fields: string[];
}

export interface CalibrationBatch {
  index: number;
  total: number;
  prompt: string;
  personaSummaries: string[];
  rawResponse: string;
  sentiments: string[];
  personas: PersonaBatchDetail[];
  latencyMs: number;
  tokens: number;
}

export interface PersonaBatchDetail {
  id: string;
  name: string;
  state: string;
  age: number;
  political_leaning: string;
  sentiment: string;
  summary: string;
}

export interface SegmentItem {
  label: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export type AllSegments = Record<string, SegmentItem[]>;

export interface CalibrationStore {
  // Query
  question: string;
  geoFilter: { state?: string; city?: string } | null;
  isProcessing: boolean;
  error: string | null;

  // Pipeline
  nodes: Record<string, NodeStatus>;
  selectedNode: string | null;
  startTime: number | null;
  endTime: number | null;

  // Pre-classification
  preClassification: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    parsed: PreClassResult;
    latencyMs: number;
    tokens: number;
  } | null;

  // Prompt sample (first batch prompt for inspection)
  promptSample: {
    systemPrompt: string;
    userPrompt: string;
    personaCount: number;
  } | null;

  // Geo filter result
  geoResult: {
    originalCount: number;
    filteredCount: number;
    criteria: { state?: string; city?: string } | null;
    sampleRemoved: Array<{ name: string; state: string; city: string }>;
  } | null;

  // Batches
  batches: CalibrationBatch[];
  progress: { processed: number; total: number; positive: number; negative: number; neutral: number };

  // Segments
  segments: AllSegments | null;

  // Actions
  selectNode: (node: string | null) => void;
  reset: () => void;
}

// ── Node definitions ──

export const CAL_NODE_ORDER = [
  'queryReceived',
  'geoFilter',
  'preClassification',
  'personaProcessing',
  'aggregation',
  'results',
] as const;

export const CAL_NODE_LABELS: Record<string, string> = {
  queryReceived: 'Query Recebida',
  geoFilter: 'Filtro Geografico',
  preClassification: 'Pre-Classificacao Semantica',
  personaProcessing: 'Processamento de Personas',
  aggregation: 'Agregacao de Resultados',
  results: 'Resultado Final',
};

function initialNodes(): Record<string, NodeStatus> {
  const nodes: Record<string, NodeStatus> = {};
  for (const n of CAL_NODE_ORDER) {
    nodes[n] = 'idle';
  }
  return nodes;
}

// ── Store ──

export const useCalibrationStore = create<CalibrationStore>((set) => ({
  question: '',
  geoFilter: null,
  isProcessing: false,
  error: null,
  nodes: initialNodes(),
  selectedNode: null,
  startTime: null,
  endTime: null,
  preClassification: null,
  promptSample: null,
  geoResult: null,
  batches: [],
  progress: { processed: 0, total: 0, positive: 0, negative: 0, neutral: 0 },
  segments: null,

  selectNode: (node) => set({ selectedNode: node }),
  reset: () =>
    set({
      question: '',
      geoFilter: null,
      isProcessing: false,
      error: null,
      nodes: initialNodes(),
      selectedNode: null,
      startTime: null,
      endTime: null,
      preClassification: null,
      promptSample: null,
      geoResult: null,
      batches: [],
      progress: { processed: 0, total: 0, positive: 0, negative: 0, neutral: 0 },
      segments: null,
    }),
}));

// ── SSE Submit ──

let activeXhr: XMLHttpRequest | null = null;

export async function calibrationSubmit(
  question: string,
  geoFilter?: { state: string; city?: string },
) {
  const store = useCalibrationStore;

  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }

  store.getState().reset();
  store.setState({
    question,
    geoFilter: geoFilter || null,
    isProcessing: true,
    startTime: Date.now(),
    nodes: { ...initialNodes(), queryReceived: 'complete' },
    selectedNode: 'queryReceived',
  });

  const body: Record<string, unknown> = { question };
  if (geoFilter) {
    body.geo_filter = geoFilter;
  }

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
          const payload = JSON.parse(line.slice(6));
          handleEvent(payload);
        } catch {
          // fragmented, wait for next
        }
      }
    }

    function handleEvent(payload: { type: string; data: any }) {
      const { type, data } = payload;
      const s = store.getState;

      switch (type) {
        case 'cal_start':
          store.setState({
            nodes: { ...s().nodes, queryReceived: 'complete', geoFilter: 'running' },
          });
          break;

        case 'cal_geo_filter':
          store.setState({
            geoResult: {
              originalCount: data.original_count,
              filteredCount: data.filtered_count,
              criteria: data.criteria,
              sampleRemoved: data.sample_removed || [],
            },
            nodes: { ...s().nodes, geoFilter: 'complete', preClassification: 'running' },
            selectedNode: 'geoFilter',
          });
          break;

        case 'cal_pre_classify':
          store.setState({
            preClassification: {
              systemPrompt: data.system_prompt,
              userPrompt: data.user_prompt,
              rawResponse: data.raw_response,
              parsed: data.parsed,
              latencyMs: data.latency_ms,
              tokens: data.tokens,
            },
            nodes: { ...s().nodes, preClassification: 'complete', personaProcessing: 'running' },
            selectedNode: 'preClassification',
          });
          break;

        case 'cal_prompt_sample':
          store.setState({
            promptSample: {
              systemPrompt: data.system_prompt || '',
              userPrompt: data.user_prompt || '',
              personaCount: data.persona_count || 0,
            },
          });
          break;

        case 'cal_batch_start':
          // Update progress indicator
          break;

        case 'cal_batch_result': {
          const newBatch: CalibrationBatch = {
            index: data.batch_index,
            total: data.batch_total,
            prompt: data.prompt,
            personaSummaries: [],
            rawResponse: data.raw_response,
            sentiments: data.sentiments,
            personas: data.personas || [],
            latencyMs: data.latency_ms,
            tokens: data.tokens,
          };
          store.setState({ batches: [...s().batches, newBatch] });
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
            },
            segments: data.segments || null,
          });
          break;

        case 'cal_results':
          store.setState({
            segments: data.segments || null,
            progress: {
              processed: data.total,
              total: data.total,
              positive: data.positive,
              negative: data.negative,
              neutral: data.neutral,
            },
            nodes: {
              ...s().nodes,
              personaProcessing: 'complete',
              aggregation: 'complete',
              results: 'complete',
            },
          });
          break;

        case 'cal_done':
          store.setState({
            isProcessing: false,
            endTime: Date.now(),
            nodes: {
              ...s().nodes,
              personaProcessing: 'complete',
              aggregation: 'complete',
              results: 'complete',
            },
            selectedNode: 'results',
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
      if (sseBuffer.trim()) {
        const line = sseBuffer.trim();
        if (line.startsWith('data: ')) {
          try {
            handleEvent(JSON.parse(line.slice(6)));
          } catch { /* skip */ }
        }
      }
      store.setState({ isProcessing: false, endTime: Date.now() });
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
  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }
  useCalibrationStore.setState({ isProcessing: false, endTime: Date.now() });
}
