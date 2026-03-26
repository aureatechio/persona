'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { ConversationBlock } from '@/hooks/useConversation';
import type { EnhancedSimulationResult } from '@/lib/arena';
import type { AllSegments } from '@/lib/arena/segments';
import { processAttachmentsForUpload, isYouTubeUrl, type Attachment } from '@/lib/file-utils';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';
import type { ContentMeta } from '@/lib/arena/types';

interface ArenaModeProps {
  personaCache: {
    personas: any[];
    count: number;
    loadAll: (onBatch?: (loaded: number, total: number, batch: any[]) => void) => Promise<any[]>;
  };
  onAddBlock: (block: ConversationBlock) => void;
  onReplaceBlock: (id: string, block: ConversationBlock) => void;
  onProcessing: (processing: boolean) => void;
}

// Persistent BroadcastChannel to send events to /monitor page
const MONITOR_CHANNEL = 'arena-monitor';
let _monitorChannel: BroadcastChannel | null = null;
function getMonitorChannel(): BroadcastChannel | null {
  try {
    if (!_monitorChannel) {
      _monitorChannel = new BroadcastChannel(MONITOR_CHANNEL);
    }
    return _monitorChannel;
  } catch {
    return null;
  }
}
function broadcastToMonitor(event: { type: string; data: any }) {
  const ch = getMonitorChannel();
  if (ch) {
    try {
      ch.postMessage(event);
      console.log('[Arena→Monitor] 📡 Broadcast:', event.type);
    } catch {
      // Channel closed or error — recreate on next call
      _monitorChannel = null;
    }
  }
}

export function ArenaMode({ personaCache, onAddBlock, onReplaceBlock, onProcessing }: ArenaModeProps) {
  const abortRef = useRef<AbortController | null>(null);
  const currentBlockIdRef = useRef<string | null>(null);
  const cancelledBlocksRef = useRef<Set<string>>(new Set());

  /** Helper to build and replace an arena-live block */
  const emitLive = useCallback((blockId: string, data: ArenaLiveData) => {
    if (cancelledBlocksRef.current.has(blockId)) return;
    onReplaceBlock(blockId, {
      id: blockId,
      type: 'arena-live',
      timestamp: new Date(),
      data,
    });
    // Broadcast full ArenaLiveData to presentation screens
    // Use JSON parse/stringify to ensure structured-cloneable data
    try {
      const cloneable = JSON.parse(JSON.stringify(data));
      broadcastToMonitor({ type: 'arena-live-update', data: cloneable });
    } catch (e) {
      console.warn('[Arena] Failed to broadcast ArenaLiveData:', e);
    }
  }, [onReplaceBlock]);

  const handleSubmit = useCallback(async (value: string, contextText?: string, attachments?: Attachment[], contentMeta?: ContentMeta) => {
    let q = value.trim();
    const hasMedia = attachments && attachments.length > 0;

    if (!q && !hasMedia) return;

    onProcessing(true);

    // Reset presentation screens (dashboard/map) immediately
    broadcastToMonitor({ type: 'arena-reset', data: null });

    // Create abort controller early so media analysis can also be cancelled
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const blockId = crypto.randomUUID();
    currentBlockIdRef.current = blockId;

    let enrichedContext = contextText || '';
    let mediaCorePoint = '';
    let politicalFigures: Array<{ nome: string; alinhamento: string; posicao_autor: string }> = [];

    // Broadcast pipeline start EARLY so monitor shows activity immediately
    broadcastToMonitor({
      type: 'pipeline_start',
      data: {
        question: q || '(extraindo do conteudo...)',
        hasMedia: !!hasMedia,
      },
    });

    const mediaPreviews = hasMedia
      ? attachments.map(a => ({ type: a.type, preview: a.preview, name: a.name }))
      : undefined;

    // Show immediate feedback for media uploads BEFORE processing
    if (hasMedia) {
      const hasVideo = attachments.some(a => a.type === 'video');
      const hasYouTube = attachments.some(a => a.type === 'url' && a.url && isYouTubeUrl(a.url));
      const phase = hasYouTube
        ? 'Buscando legenda do YouTube...'
        : hasVideo
          ? 'Transcrevendo video...'
          : 'Processando midia...';
      onAddBlock({
        id: blockId,
        type: 'media-scanning',
        timestamp: new Date(),
        data: { previews: mediaPreviews, phase },
      });
    }

    // Process attachments (transcription happens here — can take time)
    const processedAttachments = hasMedia
      ? await processAttachmentsForUpload(attachments)
      : undefined;

    const scannerPreviews = hasMedia && processedAttachments
      ? attachments.map((a, i) => ({
          type: a.type,
          preview: processedAttachments[i]?.type === 'image' ? processedAttachments[i].data : a.preview,
          name: a.name,
        }))
      : mediaPreviews;

    // ── Extract raw transcript from processed attachments ──────────────────
    let rawTranscript = '';
    let mediaTitle = '';
    let mediaAuthor = '';
    if (processedAttachments?.length) {
      for (const att of processedAttachments) {
        if (att.type === 'video' && att.data && att.data !== '__TRANSCRIPTION_FAILED__') {
          // Extract title/author from YouTube header if present
          const headerMatch = att.data.match(/^\[YouTube: (.+?)(?:\s*—\s*(.+?))?\]\n\n/);
          if (headerMatch) {
            mediaTitle = headerMatch[1] || '';
            mediaAuthor = headerMatch[2] || '';
          }
          rawTranscript += (rawTranscript ? '\n\n' : '') + att.data;
        }
      }
    }

    // ── Media analysis ──────────────────────────────────────────────────────
    if (processedAttachments?.length) {
      // Update phase — transcription done, now analyzing with Claude
      onReplaceBlock(blockId, {
        id: blockId,
        type: 'media-scanning',
        timestamp: new Date(),
        data: { previews: scannerPreviews, phase: 'Analisando midia com IA...' },
      });

      // Notify monitor that context extraction is in progress
      broadcastToMonitor({ type: 'context_extracting', data: { phase: 'analyzing' } });

      try {
        const mediaRes = await fetch('/api/analyze-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachments: processedAttachments,
            question: q || undefined,
          }),
          signal: controller.signal,
        });

        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();
          console.log('[Arena] Media analysis result:', {
            hasContext: !!mediaData.context,
            corePoint: mediaData.core_point || 'none',
          });
          if (mediaData.core_point) {
            mediaCorePoint = mediaData.core_point;
          }

          // Capture political figures
          if (mediaData.political_figures?.length > 0) {
            politicalFigures = mediaData.political_figures;
          }

          // Use RAW TRANSCRIPT as primary context (not the Claude summary)
          // The Claude summary is only used for core_point and generated_question
          if (rawTranscript) {
            enrichedContext = enrichedContext
              ? `${enrichedContext}\n\n--- Transcricao completa da midia ---\n${rawTranscript}`
              : rawTranscript;
          } else if (mediaData.context) {
            // Fallback to Claude summary if no raw transcript (e.g. images)
            enrichedContext = enrichedContext
              ? `${enrichedContext}\n\n--- Contexto extraido da midia ---\n${mediaData.context}`
              : mediaData.context;
          }

          // Append political figures context for personas
          if (politicalFigures.length > 0) {
            const figuresContext = politicalFigures
              .map((f: any) => `${f.nome} (alinhamento: ${f.alinhamento}) — autor ${f.posicao_autor} a essa figura`)
              .join('\n');
            enrichedContext += `\n\n--- Figuras politicas mencionadas ---\n${figuresContext}`;
          }

          // Broadcast context extraction to monitor
          broadcastToMonitor({
            type: 'context_extracted',
            data: {
              rawTranscript: rawTranscript || null,
              title: mediaTitle || null,
              author: mediaAuthor || null,
              corePoint: mediaCorePoint || null,
              claudeSummary: mediaData.context || null,
              enrichedContext: enrichedContext || null,
              generatedQuestion: null,
              politicalFigures: politicalFigures.length > 0 ? politicalFigures : null,
            },
          });
        } else {
          const errBody = await mediaRes.text().catch(() => '');
          console.error('[Arena] Media analysis HTTP error:', mediaRes.status, errBody.slice(0, 500));
        }
      } catch (mediaErr) {
        console.error('[Arena] Media analysis failed, continuing without:', mediaErr);
      }

      // If no question was provided and none was generated, use empty string
      // (the question will be inferred from the media context by the backend)
      if (!q) q = '';
    }

    if (!q && !hasMedia) return;
    // For media-only submissions where no question was generated, derive from corePoint
    if (!q && hasMedia) q = mediaCorePoint || 'Analise este conteudo';

    // ── Show collecting block IMMEDIATELY (zero delay) ──────────────────────
    // Only add block if not already showing media-scanning (which uses same blockId)
    if (!processedAttachments?.length) {
      // Auto-detect political figures in text-only questions and inject partisan context
      // This ensures "Bolsonaro é corrupto?" gets proper partisan framing
      const KNOWN_FIGURES: Record<string, string> = {
        'bolsonaro': 'direita (ex-presidente, PL)',
        'lula': 'esquerda (presidente, PT)',
        'boulos': 'esquerda (PSOL)',
        'pablo marcal': 'direita (empresario)',
        'marçal': 'direita (empresario)',
        'nicolas ferreira': 'direita (PL)',
        'tarcisio': 'centro-direita (Republicanos)',
        'marina silva': 'centro-esquerda (Rede)',
        'ciro gomes': 'centro-esquerda (PDT)',
        'tabata amaral': 'centro (PSB)',
        'tebet': 'centro (MDB)',
        'haddad': 'esquerda (PT)',
        'flavio dino': 'esquerda (PCdoB/PSB)',
        'alexandre de moraes': 'STF - sem alinhamento declarado',
        'sergio moro': 'centro-direita (ex-juiz)',
        'damares': 'direita (Republicanos)',
        'michelle bolsonaro': 'direita (PL)',
      };

      const normQ = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const detectedFigures: Array<{ nome: string; alinhamento: string }> = [];
      for (const [name, alignment] of Object.entries(KNOWN_FIGURES)) {
        if (normQ.includes(name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
          detectedFigures.push({ nome: name.charAt(0).toUpperCase() + name.slice(1), alinhamento: alignment });
        }
      }

      if (detectedFigures.length > 0 && !enrichedContext) {
        const figCtx = detectedFigures
          .map(f => `${f.nome}: alinhamento politico ${f.alinhamento}`)
          .join('; ');
        enrichedContext = `Contexto politico: ${figCtx}. A pergunta se refere especificamente a essa(s) figura(s) politica(s) — as respostas devem refletir o posicionamento ideologico de cada persona em relacao a essa figura.`;
      }

      // Text-only submission — broadcast context_extracted with the question/context
      broadcastToMonitor({
        type: 'context_extracted',
        data: {
          rawTranscript: null,
          title: null,
          author: null,
          corePoint: q,
          claudeSummary: null,
          enrichedContext: enrichedContext || contextText || null,
          generatedQuestion: null,
          politicalFigures: detectedFigures.length > 0 ? detectedFigures : null,
        },
      });

      const immediateData: ArenaLiveData = {
        question: q,
        phase: 'collecting',
        processedCount: 0,
        totalCount: personaCache.count,
        positive: 0,
        negative: 0,
        neutral: 0,
        avgScore: 5.0,
        scoreSum: 0,
        simulation: null,
        totalPersonas: personaCache.count,
        media: mediaPreviews,
        mediaContext: enrichedContext || undefined,
        collectingStatus: 'analyzing',
      };
      onAddBlock({ id: blockId, type: 'arena-live', timestamp: new Date(), data: immediateData });
    }

    // Update monitor with final topic/question after all extraction is done
    broadcastToMonitor({
      type: 'pipeline_topic',
      data: { topic: mediaCorePoint || q, corePoint: mediaCorePoint || null, question: q },
    });

    // ── Full analysis with streaming live block ─────────────────────────────
    const baseLiveData: ArenaLiveData = {
      question: q,
      phase: 'streaming',
      processedCount: 0,
      totalCount: personaCache.count,
      positive: 0,
      negative: 0,
      neutral: 0,
      avgScore: 5.0,
      scoreSum: 0,
      simulation: null,
      totalPersonas: personaCache.count,
      media: mediaPreviews,
      mediaContext: enrichedContext || undefined,
      contentMeta: contentMeta || undefined,
    };

    // Block already created above — just update phase
    {
      const initialPhase = 'collecting';
      emitLive(blockId, {
        ...baseLiveData,
        phase: initialPhase as ArenaLiveData['phase'],
        ...(initialPhase === 'collecting' ? { collectingStatus: 'analyzing' } : {}),
      });
    }

    // ── Python backend ────────────────────────────────────────────────────
    // Start in collecting phase — no metrics shown yet
    emitLive(blockId, {
      ...baseLiveData,
      phase: 'collecting',
      collectingStatus: 'analyzing',
    });

    let hasResults = false;
    let useFallback = false;
    let simulation: any = null;

    // Segments, stateBreakdown, ideology, and live comments come directly from Python backend
    let pythonSegments: AllSegments | undefined;
    let pythonStateBreakdown: Record<string, { count: number; positive: number; negative: number; neutral: number }> | undefined;
    let pythonCityBreakdown: Record<string, any[]> | undefined;
    let liveComments: any[] = [];
    let pythonIdeology: ArenaLiveData['liveIdeology'] | undefined;

    /** Compute avgScore from Python sentiment counts */
    const computeAvgFromCounts = (pos: number, neg: number, neu: number): number => {
      const total = pos + neg + neu;
      if (total === 0) return 5.0;
      return Math.round(((pos * 8.5 + neg * 1.5 + neu * 5.0) / total) * 10) / 10;
    };

    try {
      console.log('[Arena] 🐍 Fetching Python backend...');
      const response = await fetch('/api/arena/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          cluster_filter: null,
          verbose: true,
          ...(enrichedContext && { context_text: enrichedContext }),
          ...(contentMeta && contentMeta.region !== 'brasil' && {
            geo_filter: {
              state: contentMeta.region,
              city: contentMeta.city || null,
              min_personas: 50,
            },
          }),
        }),
        signal: controller.signal,
      });

      console.log(`[Arena] 🐍 Response: status=${response.status}, hasBody=${!!response.body}`);
      if (!response.ok || !response.body) throw new Error(`Python backend unavailable (status=${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;
      let lastEventTime = Date.now();
      let receivedAnyProgress = false;
      let lastScoreSum = 0;
      // Python needs time: query analysis + loading 20k personas + GPT batches
      // Only cancel if truly stalled (no events at all for 2 min)
      let stallThreshold = 120_000;

      const stallCheck = setInterval(() => {
        if (Date.now() - lastEventTime > stallThreshold && !hasResults) {
          console.warn('[Arena] SSE stalled, cancelling');
          clearInterval(stallCheck);
          reader.cancel();
        }
      }, 10_000);

      try {
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;

          lastEventTime = Date.now();
          buffer += decoder.decode(chunk, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const c of chunks) {
            const line = c.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              // Broadcast all SSE events to monitor page
              broadcastToMonitor(payload);

              switch (payload.type) {
                case 'phase': {
                  const pythonPhase = payload.data?.phase;
                  if (pythonPhase === 'aggregating') {
                    emitLive(blockId, {
                      ...baseLiveData,
                      phase: 'aggregating',
                      processedCount: simulation?.total || personaCache.count,
                      totalCount: simulation?.total || personaCache.count,
                      positive: simulation?.positive || 0,
                      negative: simulation?.negative || 0,
                      neutral: simulation?.neutral || 0,
                      segments: pythonSegments,
                      stateBreakdown: pythonStateBreakdown,
                      cityBreakdown: pythonCityBreakdown,
                      liveIdeology: pythonIdeology,
                    });
                  } else if (pythonPhase === 'processing_personas') {
                    // Stay in collecting until first real progress event arrives
                    // This avoids showing 0% streaming for 10-15 seconds
                    emitLive(blockId, {
                      ...baseLiveData,
                      phase: 'collecting',
                      collectingStatus: 'loading',
                    });
                  } else if (pythonPhase !== 'processing_personas') {
                    // Map Python phases to collecting status
                    const statusMap: Record<string, string> = {
                      analyzing_query: 'analyzing',
                      web_research: 'researching',
                      building_context: 'context',
                      loading_personas: 'loading',
                    };
                    const collectingStatus = statusMap[pythonPhase] || 'analyzing';
                    emitLive(blockId, {
                      ...baseLiveData,
                      phase: 'collecting',
                      collectingStatus,
                    });
                  }
                  break;
                }

                case 'personas_loaded':
                  baseLiveData.totalCount = payload.data.count;
                  baseLiveData.totalPersonas = payload.data.count;
                  emitLive(blockId, {
                    ...baseLiveData,
                    phase: 'collecting',
                    collectingStatus: 'loading',
                  });
                  break;

                case 'geo_resolved': {
                  const geoData = payload.data;
                  baseLiveData.geoCities = geoData.cities;
                  baseLiveData.totalCount = geoData.total_personas;
                  baseLiveData.totalPersonas = geoData.total_personas;
                  emitLive(blockId, {
                    ...baseLiveData,
                    phase: 'collecting',
                    collectingStatus: 'loading',
                    geoCities: geoData.cities,
                  });
                  break;
                }

                case 'progress': {
                  receivedAnyProgress = true;
                  stallThreshold = 120_000;
                  // Use segments from Python when available
                  if (payload.data.segments) {
                    pythonSegments = payload.data.segments as AllSegments;
                  }
                  if (payload.data.stateBreakdown) {
                    pythonStateBreakdown = payload.data.stateBreakdown;
                  }
                  if (payload.data.cityBreakdown) {
                    pythonCityBreakdown = payload.data.cityBreakdown;
                  }
                  // Accumulate live comments from progress events
                  if (payload.data.comments && Array.isArray(payload.data.comments)) {
                    liveComments = payload.data.comments;
                  }
                  // Update ideology data (politicalFigures, quadrants, clusterResults)
                  if (payload.data.politicalFigures || payload.data.quadrants || payload.data.clusterResults) {
                    pythonIdeology = {
                      quadrants: payload.data.quadrants || pythonIdeology?.quadrants || [],
                      clusterResults: payload.data.clusterResults || pythonIdeology?.clusterResults || [],
                      politicalFigures: payload.data.politicalFigures || pythonIdeology?.politicalFigures || [],
                    };
                  }
                  // Use avgScore from Python AI scoring when available, fallback to local heuristic
                  const progressAvg = payload.data.avgScore != null
                    ? payload.data.avgScore
                    : computeAvgFromCounts(payload.data.positive, payload.data.negative, payload.data.neutral);
                  const progressScoreSum = payload.data.scoreSum || 0;
                  lastScoreSum = progressScoreSum;
                  emitLive(blockId, {
                    ...baseLiveData,
                    phase: 'streaming',
                    processedCount: payload.data.processed,
                    totalCount: payload.data.total,
                    positive: payload.data.positive,
                    negative: payload.data.negative,
                    neutral: payload.data.neutral,
                    avgScore: progressAvg,
                    scoreSum: progressScoreSum,
                    segments: pythonSegments,
                    stateBreakdown: pythonStateBreakdown,
                    cityBreakdown: pythonCityBreakdown,
                    liveIdeology: pythonIdeology,
                    liveComments,
                  });
                  simulation = {
                    total: payload.data.total,
                    positive: payload.data.positive,
                    negative: payload.data.negative,
                    neutral: payload.data.neutral,
                    archetypes: simulation?.archetypes || [],
                    clusterResults: simulation?.clusterResults || [],
                    comments: simulation?.comments || [],
                    processingTime: simulation?.processingTime || 0,
                    ideologicalPoints: simulation?.ideologicalPoints || [],
                    quadrants: simulation?.quadrants || [],
                    regions: simulation?.regions || [],
                    generations: simulation?.generations || [],
                    educationLevels: simulation?.educationLevels || [],
                    politicalFigures: simulation?.politicalFigures || [],
                    intensityBands: simulation?.intensityBands || [],
                  };
                  break;
                }

                case 'results': {
                  const resultsData = payload.data;
                  if (resultsData.segments) {
                    pythonSegments = resultsData.segments as AllSegments;
                    delete resultsData.segments;
                  }
                  if (resultsData.stateBreakdown) {
                    pythonStateBreakdown = resultsData.stateBreakdown;
                    delete resultsData.stateBreakdown;
                  }
                  if (resultsData.cityBreakdown) {
                    pythonCityBreakdown = resultsData.cityBreakdown;
                    delete resultsData.cityBreakdown;
                  }
                  // ideologicalPoints now arrives via points_chunk events — init empty array
                  if (!resultsData.ideologicalPoints) {
                    resultsData.ideologicalPoints = [];
                  }
                  simulation = resultsData as EnhancedSimulationResult;
                  hasResults = true;
                  break;
                }

                case 'points_chunk': {
                  // Streamed ideological points — append to simulation
                  if (simulation && Array.isArray(payload.data)) {
                    simulation.ideologicalPoints = [
                      ...(simulation.ideologicalPoints || []),
                      ...payload.data,
                    ];
                  }
                  break;
                }

                case 'done': {
                  streamDone = true;
                  const doneTotal = payload.data.total_personas || simulation?.total || 0;
                  // Use avgScore from Python aggregator (AI-based) when available
                  const doneAvg = simulation?.avgScore != null
                    ? simulation.avgScore
                    : computeAvgFromCounts(simulation?.positive || 0, simulation?.negative || 0, simulation?.neutral || 0);

                  emitLive(blockId, {
                    ...baseLiveData,
                    phase: 'complete',
                    processedCount: doneTotal,
                    totalCount: doneTotal,
                    positive: simulation?.positive || 0,
                    negative: simulation?.negative || 0,
                    neutral: simulation?.neutral || 0,
                    avgScore: doneAvg,
                    scoreSum: lastScoreSum,
                    simulation,
                    totalPersonas: doneTotal,
                    segments: pythonSegments,
                    stateBreakdown: pythonStateBreakdown,
                    cityBreakdown: pythonCityBreakdown,
                    liveIdeology: pythonIdeology,
                  });
                  onProcessing(false);
                  break;
                }
              }
            } catch {
              // Skip parse errors
            }
          }
        }
      } finally {
        clearInterval(stallCheck);
      }

      console.log(`[Arena] 🐍 Stream ended. streamDone=${streamDone}, hasResults=${hasResults}, receivedAnyProgress=${receivedAnyProgress}`);
      if (!streamDone && hasResults) {
        console.log('[Arena] 🐍 Stream incomplete but has results — using partial data');
        const total = simulation?.total || 0;
        const partialAvg = computeAvgFromCounts(
          simulation?.positive || 0, simulation?.negative || 0, simulation?.neutral || 0
        );
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: total,
          totalCount: total,
          positive: simulation?.positive || 0,
          negative: simulation?.negative || 0,
          neutral: simulation?.neutral || 0,
          avgScore: partialAvg,
          scoreSum: 0,
          simulation,
          totalPersonas: total,
          segments: pythonSegments,
          stateBreakdown: pythonStateBreakdown,
          cityBreakdown: pythonCityBreakdown,
          liveIdeology: pythonIdeology,
        });
        onProcessing(false);
      } else if (!streamDone && !hasResults && simulation && (simulation.total > 0 || simulation.positive > 0 || simulation.negative > 0)) {
        // Stream died before 'results' event, but we have partial data from progress events
        console.warn('[Arena] ⚠️ Stream incomplete — using partial progress data');
        const total = simulation.total || 0;
        const partialAvg = computeAvgFromCounts(
          simulation.positive || 0, simulation.negative || 0, simulation.neutral || 0
        );
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: total,
          totalCount: total,
          positive: simulation.positive || 0,
          negative: simulation.negative || 0,
          neutral: simulation.neutral || 0,
          avgScore: partialAvg,
          scoreSum: 0,
          simulation,
          totalPersonas: total,
          segments: pythonSegments,
          stateBreakdown: pythonStateBreakdown,
          cityBreakdown: pythonCityBreakdown,
          liveIdeology: pythonIdeology,
        });
        onProcessing(false);
      } else if (!streamDone && !hasResults) {
        console.warn('[Arena] ⚠️ Stream incomplete, no results — no data available');
        useFallback = true;
      }
    } catch (err: any) {
      console.error('[Arena] ❌ Python fetch error:', err?.name, err?.message);
      if (err?.name === 'AbortError' && hasResults) {
        const total = simulation?.total || 0;
        const abortAvg = computeAvgFromCounts(
          simulation?.positive || 0, simulation?.negative || 0, simulation?.neutral || 0
        );
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          simulation,
          positive: simulation?.positive || 0,
          negative: simulation?.negative || 0,
          neutral: simulation?.neutral || 0,
          avgScore: abortAvg,
          scoreSum: 0,
          totalPersonas: total,
          segments: pythonSegments,
          stateBreakdown: pythonStateBreakdown,
          cityBreakdown: pythonCityBreakdown,
          liveIdeology: pythonIdeology,
        });
        onProcessing(false);
        return;
      }
      if (err?.name === 'AbortError' && !hasResults && simulation && (simulation.total > 0)) {
        // Abort but we have partial progress data — use it
        console.warn('[Arena] AbortError with partial data — using progress results');
        const total = simulation.total || 0;
        const abortPartialAvg = computeAvgFromCounts(
          simulation.positive || 0, simulation.negative || 0, simulation.neutral || 0
        );
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          simulation,
          positive: simulation.positive || 0,
          negative: simulation.negative || 0,
          neutral: simulation.neutral || 0,
          avgScore: abortPartialAvg,
          scoreSum: 0,
          totalPersonas: total,
          segments: pythonSegments,
          stateBreakdown: pythonStateBreakdown,
          cityBreakdown: pythonCityBreakdown,
          liveIdeology: pythonIdeology,
        });
        onProcessing(false);
        return;
      } else if (err?.name === 'AbortError' && !hasResults) {
        useFallback = true;
      } else if (hasResults) {
        const total = simulation?.total || 0;
        const errAvg = computeAvgFromCounts(
          simulation?.positive || 0, simulation?.negative || 0, simulation?.neutral || 0
        );
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          simulation,
          positive: simulation?.positive || 0,
          negative: simulation?.negative || 0,
          neutral: simulation?.neutral || 0,
          avgScore: errAvg,
          scoreSum: 0,
          totalPersonas: total,
          segments: pythonSegments,
          stateBreakdown: pythonStateBreakdown,
          cityBreakdown: pythonCityBreakdown,
          liveIdeology: pythonIdeology,
        });
        onProcessing(false);
        return;
      } else if (simulation && (simulation.total > 0)) {
        // Non-abort error, no 'results' event, but have progress data
        console.warn('[Arena] ❌ Error with partial data — using progress results');
        const total = simulation.total || 0;
        const errPartialAvg = computeAvgFromCounts(
          simulation.positive || 0, simulation.negative || 0, simulation.neutral || 0
        );
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          simulation,
          positive: simulation.positive || 0,
          negative: simulation.negative || 0,
          neutral: simulation.neutral || 0,
          avgScore: errPartialAvg,
          scoreSum: 0,
          totalPersonas: total,
          segments: pythonSegments,
          stateBreakdown: pythonStateBreakdown,
          cityBreakdown: pythonCityBreakdown,
          liveIdeology: pythonIdeology,
        });
        onProcessing(false);
        return;
      } else {
        useFallback = true;
      }
    }

    // ── No fallback — show error only if Python is truly unavailable (no data at all) ──
    if (useFallback) {
      console.error('[Arena] Python backend unavailable — no data received');
      emitLive(blockId, {
        ...baseLiveData,
        phase: 'complete',
        error: 'Servidor de analise indisponivel. Tente novamente em alguns instantes.',
      });
      onProcessing(false);
    }
  }, [personaCache, onAddBlock, emitLive, onProcessing]);

  // Listen for submit events from BottomInput (text-only)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.mode === 'arena') {
        handleSubmit(detail.value);
      }
    };
    window.addEventListener('unified-submit', handler);
    return () => window.removeEventListener('unified-submit', handler);
  }, [handleSubmit]);

  // Listen for rich submit events from ArenaRichInput
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      handleSubmit(detail.question, detail.contextText, detail.attachments, detail.contentMeta);
    };
    window.addEventListener('arena-rich-submit', handler);
    return () => window.removeEventListener('arena-rich-submit', handler);
  }, [handleSubmit]);

  // Listen for "Novo Chat" — abort running simulation + broadcast reset to presentation screens
  useEffect(() => {
    const handler = () => {
      // Cancel the current processing block (local loops check this flag)
      if (currentBlockIdRef.current) {
        cancelledBlocksRef.current.add(currentBlockIdRef.current);
        currentBlockIdRef.current = null;
      }
      // Abort any running Python backend request — this propagates to Python via signal
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      // Delay clearing cancelled IDs — pending callbacks may still check this set
      // (fixes race condition where emitLive runs AFTER clear and overwrites reset)
      setTimeout(() => cancelledBlocksRef.current.clear(), 2000);
      broadcastToMonitor({ type: 'arena-reset', data: null });
    };
    window.addEventListener('arena-new-chat', handler);
    return () => window.removeEventListener('arena-new-chat', handler);
  }, []);

  // Broadcast arena-reset when the search page reloads or navigates away
  useEffect(() => {
    const handleUnload = () => {
      try {
        const ch = new BroadcastChannel('arena-monitor');
        ch.postMessage({ type: 'arena-reset', data: null });
        ch.close();
      } catch {}
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return null; // Logic-only component
}
