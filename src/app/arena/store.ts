// Arena PWA — Zustand Store + Global SSE Connection
// Ported from mobile arenaStore.ts — SSE runs at module level

'use client';

import { create } from 'zustand';
import type { ArenaLiveData, SegmentItem, AnaliseData, ChatMessage, Attachment, ContentMeta } from './types';
import { EMPTY_SEGMENTS } from './constants';

// ── Helpers ──

function makeZeroedData(question = ''): ArenaLiveData {
  return {
    question,
    phase: 'collecting',
    processedCount: 0,
    totalCount: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    avgScore: 0,
    scoreSum: 0,
    simulation: null,
    totalPersonas: 0,
    segments: { ...EMPTY_SEGMENTS },
    liveComments: [],
    stateBreakdown: {},
    cityBreakdown: {},
    geoCities: [],
  };
}

function mergeSegments(incoming: ArenaLiveData): void {
  if (!incoming.segments || Object.keys(incoming.segments).length === 0) {
    incoming.segments = { ...EMPTY_SEGMENTS };
  } else {
    const merged: any = {};
    for (const key of Object.keys(EMPTY_SEGMENTS)) {
      const preSeeded: SegmentItem[] = (EMPTY_SEGMENTS as any)[key] || [];
      const incomingSeg: SegmentItem[] = (incoming.segments as any)?.[key] || [];
      merged[key] = incomingSeg.length === 0 ? preSeeded.map(s => ({ ...s })) : incomingSeg;
    }
    for (const key of Object.keys(incoming.segments || {})) {
      if (!(key in merged)) merged[key] = (incoming.segments as any)[key];
    }
    incoming.segments = merged;
  }
}

// ── Store ──

interface UserMediaContext {
  text: string;
  attachmentPreviews: { id: string; type: 'image' | 'video'; uri?: string }[];
}

interface ArenaStore {
  data: ArenaLiveData;
  hasEverReceived: boolean;
  isSubmitting: boolean;
  collectingStatus: string | null;
  isStopped: boolean;
  analiseData: AnaliseData | null;
  analiseLoading: boolean;
  analiseError: string;
  chatMessages: ChatMessage[];
  userMediaContext: UserMediaContext | null;
  currentHistoryId: string | null;
  seenDashboard: boolean;
  seenMapa: boolean;

  updateData: (incoming: ArenaLiveData, collectingStatus?: string | null) => void;
  reset: (question?: string) => void;
  setSubmitting: (v: boolean) => void;
  setCollectingStatus: (s: string | null) => void;
  stopLive: () => void;
  setAnaliseData: (data: AnaliseData | null) => void;
  setAnaliseLoading: (v: boolean) => void;
  setAnaliseError: (v: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  setUserMediaContext: (ctx: UserMediaContext | null) => void;
  setCurrentHistoryId: (id: string | null) => void;
  markSeenDashboard: () => void;
  markSeenMapa: () => void;
  loadFromHistory: (data: any) => void;
}

export const useArenaStore = create<ArenaStore>((set, get) => ({
  data: makeZeroedData(),
  hasEverReceived: false,
  isSubmitting: false,
  collectingStatus: null,
  isStopped: false,
  analiseData: null,
  analiseLoading: false,
  analiseError: '',
  chatMessages: [],
  userMediaContext: null,
  currentHistoryId: null,
  seenDashboard: false,
  seenMapa: false,

  updateData: (incoming, collectingStatus) => {
    if (get().isStopped) return;
    mergeSegments(incoming);
    const patch: Partial<ArenaStore> = { data: incoming, hasEverReceived: true };
    if (collectingStatus !== undefined) {
      patch.collectingStatus = collectingStatus;
    }
    set(patch as any);
  },

  reset: (question = '') => {
    set({
      data: makeZeroedData(question),
      hasEverReceived: false,
      isSubmitting: false,
      collectingStatus: null,
      isStopped: false,
      analiseData: null,
      analiseLoading: false,
      analiseError: '',
      chatMessages: [],
      userMediaContext: null,
      currentHistoryId: null,
      seenDashboard: false,
      seenMapa: false,
    });
  },

  stopLive: () => {
    set((state) => ({
      isStopped: true,
      isSubmitting: false,
      data: { ...state.data, phase: 'complete' as const },
    }));
  },

  setSubmitting: (v) => set({ isSubmitting: v }),
  setCollectingStatus: (s) => set({ collectingStatus: s }),
  setAnaliseData: (data) => set({ analiseData: data, analiseLoading: false }),
  setAnaliseLoading: (v) => set({ analiseLoading: v }),
  setAnaliseError: (v) => set({ analiseError: v, analiseLoading: false }),
  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),
  setUserMediaContext: (ctx) => set({ userMediaContext: ctx }),
  setCurrentHistoryId: (id) => set({ currentHistoryId: id }),
  markSeenDashboard: () => set({ seenDashboard: true }),
  markSeenMapa: () => set({ seenMapa: true }),
  loadFromHistory: (record: any) => {
    const ad = record.analise_data || {};
    const ar = record.arena_data || {};
    set({
      analiseData: ad,
      chatMessages: record.chat_messages || [],
      hasEverReceived: true,
      isStopped: true,
      isSubmitting: false,
      analiseLoading: false,
      analiseError: '',
      currentHistoryId: record.id,
      userMediaContext: ar.contentMeta ? {
        text: Array.isArray(ar.contentMeta?.mediaType) ? ar.contentMeta.mediaType.join(', ') : (ar.contentMeta?.mediaType || ''),
        attachmentPreviews: [],
      } : null,
      data: {
        ...makeZeroedData(ar.question || record.question || ''),
        phase: 'complete' as const,
        positive: ar.positive || 0,
        negative: ar.negative || 0,
        neutral: ar.neutral || 0,
        avgScore: ar.avgScore || 0,
        totalPersonas: ar.totalPersonas || 0,
        segments: ar.segments || {},
        contentMeta: ar.contentMeta || undefined,
        stateBreakdown: ar.stateBreakdown || {},
        simulation: ar.simulation || null,
      },
    });
  },
}));

// ══════════════════════════════════════════════════════════════════
// GLOBAL SSE Manager — runs outside React component lifecycle
// ══════════════════════════════════════════════════════════════════

let activeXhr: XMLHttpRequest | null = null;

interface SubmitParams {
  attachments: Attachment[];
  contentMeta: ContentMeta;
}

export async function arenaSubmit(params: SubmitParams) {
  const store = useArenaStore.getState();

  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }

  store.reset('');
  store.setSubmitting(true);
  store.setCollectingStatus('analyzing');

  try {
    let enrichedContext = '';
    let generatedQuestion = '';
    let corePoint = '';
    let politicalFigures: { nome: string; alinhamento: string; posicao_autor?: string }[] = [];

    const imageAtt = params.attachments.find((a) => a.type === 'image');
    const videoAtt = params.attachments.find((a) => a.type === 'video');

    // ── Step 1: Process media ──
    if (imageAtt || videoAtt) {
      store.setCollectingStatus('analyzing');

      try {
        let mediaData = '';
        let mediaType: 'image' | 'video' = 'image';
        let mediaName = '';

        if (imageAtt?.file || imageAtt?.base64) {
          mediaType = 'image';
          mediaName = imageAtt.name || 'photo.jpg';
          store.updateData({ ...store.data, question: 'Preparando imagem...' } as any, 'analyzing');

          if (imageAtt.base64) {
            mediaData = `data:${imageAtt.mimeType || 'image/jpeg'};base64,${imageAtt.base64}`;
          } else if (imageAtt.file) {
            // Convert File to base64
            const base64 = await fileToBase64(imageAtt.file);
            mediaData = `data:${imageAtt.file.type || 'image/jpeg'};base64,${base64}`;
          }
        }

        if (videoAtt?.file && !imageAtt) {
          mediaType = 'video';
          mediaName = videoAtt.name || 'video.mp4';
          store.updateData({ ...store.data, question: 'Preparando vídeo...' } as any, 'analyzing');

          const VIDEO_TIMEOUT = 300_000;
          let storagePath = '';

          try {
            // 1a. Get signed upload URL
            const urlRes = await fetch('/api/transcribe-video/upload-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: mediaName }),
            });
            if (!urlRes.ok) throw new Error(`Upload URL failed: ${urlRes.status}`);
            const { signedUrl: uploadUrl, path } = await urlRes.json();
            storagePath = path;

            // 1b. Upload video
            store.updateData({ ...store.data, question: 'Enviando vídeo...' } as any, 'analyzing');
            const putRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': videoAtt.file!.type || 'video/mp4' },
              body: videoAtt.file,
            });
            if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

            // 1c. Get signed download URL
            store.updateData({ ...store.data, question: 'Processando áudio...' } as any, 'analyzing');
            const dlRes = await fetch('/api/transcribe-video/download-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: storagePath }),
            });
            if (!dlRes.ok) throw new Error(`Download URL failed: ${dlRes.status}`);
            const { signedUrl: downloadUrl } = await dlRes.json();

            // 1d. Transcribe via Whisper
            store.updateData({ ...store.data, question: 'Transcrevendo vídeo com IA...' } as any, 'analyzing');
            const TRANSCRIPTION_BACKEND = 'https://arena-analysis-api-2puat.ondigitalocean.app';
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), VIDEO_TIMEOUT);

            let transcribeRes: Response;
            try {
              transcribeRes = await fetch(`${TRANSCRIPTION_BACKEND}/api/transcribe-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: downloadUrl, filename: mediaName }),
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timer);
            }

            if (transcribeRes.ok) {
              const transcribeData = await transcribeRes.json();
              const transcript = transcribeData.transcript || '';
              mediaData = transcript.length > 10 ? transcript : '__TRANSCRIPTION_FAILED__';
            } else {
              mediaData = '__TRANSCRIPTION_FAILED__';
            }
          } catch (videoErr: any) {
            mediaData = '__TRANSCRIPTION_FAILED__';
          } finally {
            if (storagePath) {
              fetch('/api/transcribe-video/download-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: storagePath, action: 'delete' }),
              }).catch(() => {});
            }
          }
        }

        // ── Step 2: Analyze media via Claude ──
        if (mediaData) {
          store.updateData({ ...store.data, question: 'Analisando conteúdo...' } as any, 'analyzing');

          const mediaRes = await fetch('/api/analyze-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attachments: [{ type: mediaType, data: mediaData, name: mediaName }],
              question: '',
              generate_question: true,
            }),
          });

          if (mediaRes.ok) {
            const result = await mediaRes.json();
            const context = result.context || '';
            corePoint = result.core_point || '';
            generatedQuestion = result.generated_question || '';
            politicalFigures = result.political_figures || [];

            if (mediaType === 'video' && mediaData && mediaData !== '__TRANSCRIPTION_FAILED__') {
              enrichedContext = `--- Transcrição completa da mídia ---\n${mediaData}`;
            } else {
              enrichedContext = `--- Contexto extraído da mídia ---\n${context}`;
            }

            if (politicalFigures.length > 0) {
              enrichedContext += '\n\n--- Figuras políticas mencionadas ---\n';
              enrichedContext += politicalFigures.map((f) =>
                `${f.nome} (alinhamento: ${f.alinhamento}) — autor ${f.posicao_autor || 'neutro'} a essa figura`
              ).join('\n');
            }
          }
        }
      } catch (err: any) {
        console.warn('[Arena] Media pipeline error:', err.message);
      }
    }

    // ── Step 3: Build request body ──
    const finalQuestion = generatedQuestion || corePoint || '';
    const { region, city } = params.contentMeta;
    const body: Record<string, unknown> = {
      question: finalQuestion,
      context_text: enrichedContext,
      verbose: true,
      content_meta: params.contentMeta,
    };
    if (region !== 'brasil') {
      body.geo_filter = { state: region, city: city || null };
    }

    // ── Step 4: SSE via XHR ──
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeXhr = xhr;

      let lastIndex = 0;
      let liveData: ArenaLiveData = {
        question: finalQuestion,
        phase: 'collecting',
        processedCount: 0,
        totalCount: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        avgScore: 0,
        scoreSum: 0,
        simulation: null,
        segments: {},
        stateBreakdown: {},
        cityBreakdown: {},
        liveComments: [],
        geoCities: [],
        contentMeta: params.contentMeta as any,
      };

      let lastFlushTime = 0;
      let pendingCollectingStatus: string | null | undefined = undefined;
      let hasPendingFlush = false;

      function flushToStore(immediate: boolean) {
        const now = Date.now();
        if (!immediate && now - lastFlushTime < 250) {
          if (!hasPendingFlush) {
            hasPendingFlush = true;
            setTimeout(() => {
              hasPendingFlush = false;
              flushToStore(true);
            }, 250 - (now - lastFlushTime));
          }
          return;
        }
        lastFlushTime = now;
        hasPendingFlush = false;
        useArenaStore.getState().updateData({ ...liveData }, pendingCollectingStatus);
        pendingCollectingStatus = undefined;
      }

      let sseBuffer = '';

      xhr.open('POST', '/api/arena/analyze');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');

      function processBuffer(text: string): boolean {
        sseBuffer += text;
        let needsImmediateFlush = false;
        const parts = sseBuffer.split('\n\n');
        sseBuffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const payload = JSON.parse(jsonStr);
            const result = processSSEEvent(payload, liveData);
            liveData = result.data;
            if (result.collectingStatus !== undefined) {
              pendingCollectingStatus = result.collectingStatus;
            }
            if (result.immediate) needsImmediateFlush = true;
          } catch {
            // Fragmented chunk — buffer for next call
          }
        }
        return needsImmediateFlush;
      }

      xhr.onprogress = () => {
        const newData = xhr.responseText.substring(lastIndex);
        lastIndex = xhr.responseText.length;
        if (!newData) return;
        const needsImmediate = processBuffer(newData);
        flushToStore(needsImmediate);
      };

      xhr.onload = () => {
        const remaining = xhr.responseText.substring(lastIndex);
        if (remaining) processBuffer(remaining);
        if (sseBuffer.trim()) {
          const line = sseBuffer.trim();
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              const result = processSSEEvent(payload, liveData);
              liveData = result.data;
              if (result.collectingStatus !== undefined) {
                pendingCollectingStatus = result.collectingStatus;
              }
            } catch { /* skip */ }
          }
        }
        if (liveData.phase !== 'complete' && liveData.simulation) {
          liveData.phase = 'complete';
          pendingCollectingStatus = null;
        }
        flushToStore(true);
        resolve();
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.onabort = () => resolve();
      xhr.send(JSON.stringify(body));
    });
  } catch (err: any) {
    console.error('[Arena] Error:', err);
  } finally {
    useArenaStore.getState().setSubmitting(false);
    activeXhr = null;
  }
}

export function arenaCancel() {
  useArenaStore.getState().stopLive();
  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }
}

// ── SSE Event processor ──

interface SSEResult {
  data: ArenaLiveData;
  collectingStatus?: string | null;
  immediate: boolean;
}

function processSSEEvent(payload: any, current: ArenaLiveData): SSEResult {
  const data = { ...current };
  const eventType = payload.type;
  let collectingStatus: string | null | undefined = undefined;
  let immediate = false;

  switch (eventType) {
    case 'phase': {
      immediate = true;
      const pythonPhase = payload.data?.phase;
      if (pythonPhase === 'aggregating') {
        data.phase = 'aggregating';
        collectingStatus = null;
      } else if (pythonPhase === 'processing_personas') {
        data.phase = 'collecting';
        collectingStatus = 'loading';
      } else {
        const statusMap: Record<string, string> = {
          analyzing_query: 'analyzing',
          web_research: 'researching',
          building_context: 'context',
          loading_personas: 'loading',
        };
        data.phase = 'collecting';
        collectingStatus = statusMap[pythonPhase] || 'analyzing';
      }
      break;
    }
    case 'personas_loaded': {
      const count = payload.data?.count || payload.data?.total || 0;
      data.totalCount = count;
      data.totalPersonas = count;
      collectingStatus = 'loading';
      break;
    }
    case 'geo_resolved': {
      const geoData = payload.data;
      if (geoData?.cities) data.geoCities = geoData.cities;
      if (geoData?.total_personas) {
        data.totalCount = geoData.total_personas;
        data.totalPersonas = geoData.total_personas;
      }
      break;
    }
    case 'progress': {
      const p = payload.data;
      if (!p) break;
      data.processedCount = p.processed ?? data.processedCount;
      data.totalCount = p.total ?? data.totalCount;
      data.positive = p.positive ?? data.positive;
      data.negative = p.negative ?? data.negative;
      data.neutral = p.neutral ?? data.neutral;
      data.avgScore = p.avgScore ?? data.avgScore;
      data.scoreSum = p.scoreSum ?? data.scoreSum;
      if (p.segments) data.segments = p.segments;
      if (p.stateBreakdown) data.stateBreakdown = p.stateBreakdown;
      if (p.cityBreakdown) data.cityBreakdown = p.cityBreakdown;
      if (p.comments && Array.isArray(p.comments)) data.liveComments = p.comments;
      if (data.phase === 'collecting') data.phase = 'streaming';
      collectingStatus = null;
      break;
    }
    case 'results': {
      immediate = true;
      const r = payload.data;
      if (!r) break;
      if (r.segments) { data.segments = r.segments; delete r.segments; }
      if (r.stateBreakdown) { data.stateBreakdown = r.stateBreakdown; delete r.stateBreakdown; }
      if (r.cityBreakdown) { data.cityBreakdown = r.cityBreakdown; delete r.cityBreakdown; }
      if (!r.ideologicalPoints) r.ideologicalPoints = [];
      data.simulation = r;
      data.positive = r.positive ?? data.positive;
      data.negative = r.negative ?? data.negative;
      data.neutral = r.neutral ?? data.neutral;
      break;
    }
    case 'points_chunk': {
      if (data.simulation && Array.isArray(payload.data)) {
        data.simulation = {
          ...data.simulation,
          ideologicalPoints: [...(data.simulation.ideologicalPoints || []), ...payload.data],
        };
      }
      break;
    }
    case 'done': {
      immediate = true;
      data.phase = 'complete';
      const d = payload.data;
      if (d?.total_personas) data.totalPersonas = d.total_personas;
      if (data.simulation) {
        const finalTotal = data.simulation.total || data.totalCount;
        data.processedCount = finalTotal;
        data.totalCount = finalTotal;
      } else {
        data.processedCount = data.totalCount;
      }
      if (d?.segments) data.segments = d.segments;
      if (d?.stateBreakdown) data.stateBreakdown = d.stateBreakdown;
      if (d?.cityBreakdown) data.cityBreakdown = d.cityBreakdown;
      collectingStatus = null;
      break;
    }
  }

  return { data, collectingStatus, immediate };
}

// ── File to base64 helper ──

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
