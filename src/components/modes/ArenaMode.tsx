'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { ConversationBlock } from '@/hooks/useConversation';
import type { EnhancedSimulationResult } from '@/lib/arena';
import {
  detectTopics,
  buildPersonasForAI,
  generateAIComments,
  runEnhancedSimulation,
  computePersonaSentiment,
  computeAllSegments,
  SegmentAccumulator,
  IdeologyAccumulator,
  LiveCommentAccumulator,
  classifyQuickPersona,
  StateAccumulator,
} from '@/lib/arena';
import type { AllSegments } from '@/lib/arena/segments';
import { detectQuickAnswer, runQuickAnswer } from '@/lib/arena/quick-answer';
import { processAttachmentsForUpload, isYouTubeUrl, type Attachment } from '@/lib/file-utils';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';

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

  /** Helper to build and replace an arena-live block */
  const emitLive = useCallback((blockId: string, data: ArenaLiveData) => {
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

  const handleSubmit = useCallback(async (value: string, contextText?: string, attachments?: Attachment[]) => {
    let q = value.trim();
    const hasMedia = attachments && attachments.length > 0;

    if (!q && !hasMedia) return;

    onProcessing(true);

    // Reset presentation screens (dashboard/map) immediately
    broadcastToMonitor({ type: 'arena-reset', data: null });

    const blockId = crypto.randomUUID();

    let enrichedContext = contextText || '';
    let mediaCorePoint = '';

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

    // ── Media analysis ──────────────────────────────────────────────────────
    if (processedAttachments?.length) {
      // Update phase — transcription done, now analyzing with Claude
      onReplaceBlock(blockId, {
        id: blockId,
        type: 'media-scanning',
        timestamp: new Date(),
        data: { previews: scannerPreviews, phase: 'Analisando midia com IA...' },
      });

      try {
        const mediaRes = await fetch('/api/analyze-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachments: processedAttachments,
            question: q || undefined,
            generate_question: !q,
          }),
        });

        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();
          console.log('[Arena] Media analysis result:', {
            hasContext: !!mediaData.context,
            hasQuestion: !!mediaData.generated_question,
            corePoint: mediaData.core_point || 'none',
            fidelityCorrected: mediaData.fidelity_corrected || false,
          });
          if (mediaData.fidelity_corrected) {
            console.warn('[Arena] Fidelity correction applied:', mediaData.fidelity_issue);
          }
          if (!q && mediaData.generated_question) q = mediaData.generated_question;
          if (mediaData.core_point) {
            mediaCorePoint = mediaData.core_point;
          }
          if (mediaData.context) {
            enrichedContext = enrichedContext
              ? `${enrichedContext}\n\n--- Contexto extraido da midia ---\n${mediaData.context}`
              : mediaData.context;
          }
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
    // For media-only submissions where no question was generated, use a neutral question
    if (!q && hasMedia) q = 'Analise este conteudo';

    // ── Show collecting block IMMEDIATELY (zero delay) ──────────────────────
    // Only add block if not already showing media-scanning (which uses same blockId)
    if (!processedAttachments?.length) {
      const immediateData: ArenaLiveData = {
        question: q,
        phase: 'collecting',
        processedCount: 0,
        totalCount: personaCache.count,
        positive: 0,
        negative: 0,
        neutral: 0,
        simulation: null,
        totalPersonas: personaCache.count,
        media: mediaPreviews,
        mediaContext: enrichedContext || undefined,
        collectingStatus: 'analyzing',
      };
      onAddBlock({ id: blockId, type: 'arena-live', timestamp: new Date(), data: immediateData });
    }

    // ── Quick Answer check ──────────────────────────────────────────────────
    const quickMatch = detectQuickAnswer(q);
    if (quickMatch) {
      broadcastToMonitor({ type: 'pipeline_start', data: { question: q } });
      broadcastToMonitor({ type: 'classify_result', data: { route: 'local', reason: `Quick answer — coluna "${quickMatch.column}" (${quickMatch.label})`, fields: [quickMatch.column] } });
      broadcastToMonitor({ type: 'local_start', data: { question: q } });
      const baseLiveData: ArenaLiveData = {
        question: q,
        phase: 'streaming',
        processedCount: 0,
        totalCount: personaCache.count,
        positive: 0,
        negative: 0,
        neutral: 0,
        simulation: null,
        totalPersonas: personaCache.count,
        media: mediaPreviews,
        mediaContext: enrichedContext || undefined,
        isQuickAnswer: true,
      };

      // Block already created above — just update it to streaming
      emitLive(blockId, baseLiveData);

      try {
        let pos = 0, neg = 0, neu = 0;
        const segAcc = new SegmentAccumulator();
        const ideoAcc = new IdeologyAccumulator(q);
        const commentAcc = new LiveCommentAccumulator(q);
        const stateAcc = new StateAccumulator();
        const BATCH = 100;
        let liveComments: import('@/lib/arena/types').CommentResult[] = [];
        let aiCommentsFired = false;

        const getDelay = (progress: number) => {
          if (progress < 0.3) return 450;
          if (progress < 0.7) return 350;
          return 250;
        };

        const processBatch = (batch: any[], processed: number, total: number) => {
          for (const p of batch) {
            const sentiment = classifyQuickPersona(p, quickMatch, q);
            if (sentiment === 'positive') pos++;
            else if (sentiment === 'negative') neg++;
            else neu++;
            segAcc.addPersona(p, sentiment);
            ideoAcc.addPersona(p, sentiment);
            commentAcc.addPersona(p, sentiment);
            stateAcc.addPersona(p, sentiment);
          }
          emitLive(blockId, {
            ...baseLiveData,
            phase: 'streaming',
            processedCount: processed,
            totalCount: total,
            positive: pos,
            negative: neg,
            neutral: neu,
            totalPersonas: total,
            segments: segAcc.toSegments(),
            liveIdeology: ideoAcc.toResults(),
            liveComments,
            stateBreakdown: stateAcc.toStateBreakdown(),
          });
        };

        let pendingPersonas: any[] = [];

        const allData = await personaCache.loadAll((loaded, total, batch) => {
          pendingPersonas.push(...batch);
          commentAcc.setTotal(total);
          emitLive(blockId, {
            ...baseLiveData,
            phase: 'streaming',
            processedCount: 0,
            totalCount: total,
          });
        });

        const toProcess = pendingPersonas.length > 0 ? pendingPersonas : allData;
        const total = toProcess.length;
        commentAcc.setTotal(total);

        for (let offset = 0; offset < total; offset += BATCH) {
          const batch = toProcess.slice(offset, offset + BATCH);
          const processed = Math.min(offset + BATCH, total);
          processBatch(batch, processed, total);

          // At ~25% progress, fire AI comment generation in background
          const progress = processed / total;
          if (!aiCommentsFired && progress >= 0.25 && commentAcc.count >= 8) {
            aiCommentsFired = true;
            const selectedSnapshot = [...commentAcc.selectedPersonas];
            generateAIComments(q, selectedSnapshot).then(aiComments => {
              liveComments = aiComments;
            }).catch(() => {});
          }

          await new Promise(r => setTimeout(r, getDelay(progress)));
        }

        // Final complete state
        const qaResult = runQuickAnswer(quickMatch, allData, q);
        const qaSegments = segAcc.toSegments();
        const qaStateBreakdown = stateAcc.toStateBreakdown();

        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: total,
          totalCount: total,
          positive: pos,
          negative: neg,
          neutral: neu,
          totalPersonas: total,
          segments: qaSegments,
          quickAnswer: qaResult,
          liveComments,
          stateBreakdown: qaStateBreakdown,
        });

        onProcessing(false);

        // Enrich with full simulation in background
        (async () => {
          try {
            const queryForAnalysis = enrichedContext ? `${q}\n\nContexto: ${enrichedContext}` : q;
            const enhanced = runEnhancedSimulation(queryForAnalysis, total, allData);

            emitLive(blockId, {
              ...baseLiveData,
              phase: 'complete',
              processedCount: total,
              totalCount: total,
              positive: pos,
              negative: neg,
              neutral: neu,
              totalPersonas: total,
              segments: qaSegments,
              quickAnswer: qaResult,
              simulation: { ...enhanced, comments: [] },
              stateBreakdown: qaStateBreakdown,
            });

            // Generate full AI comments with all personas if not already done
            const topicScores = detectTopics(queryForAnalysis);
            const personasForAI = buildPersonasForAI(q, allData, topicScores);
            const claudeComments = await generateAIComments(q, personasForAI);

            emitLive(blockId, {
              ...baseLiveData,
              phase: 'complete',
              processedCount: total,
              totalCount: total,
              positive: pos,
              negative: neg,
              neutral: neu,
              totalPersonas: total,
              segments: qaSegments,
              quickAnswer: qaResult,
              simulation: { ...enhanced, comments: claudeComments },
              stateBreakdown: qaStateBreakdown,
            });
          } catch (err) {
            console.warn('[Arena] Quick answer enrichment failed:', err);
          }
        })();
      } catch (err) {
        console.error('[Arena] Quick answer failed:', err);
        emitLive(blockId, { ...baseLiveData, phase: 'complete', error: 'Falha ao processar' });
        onProcessing(false);
      }
      return;
    }

    // ── Ask AI whether to process locally or use Python backend ────────────
    // Always use GPT classify-route for semantic analysis (no keyword shortcut)
    let useLocalProcessing = false;
    try {
      const classifyRes = await fetch('/api/arena/classify-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          context: enrichedContext || undefined,
          core_point: mediaCorePoint || undefined,
        }),
      });
      if (classifyRes.ok) {
        const classification = await classifyRes.json();
        console.log('[Arena] Route classification:', classification);
        useLocalProcessing = classification.route === 'local';
        // Broadcast to monitor
        broadcastToMonitor({ type: 'pipeline_start', data: { question: q } });
        broadcastToMonitor({ type: 'classify_result', data: classification });
      }
    } catch {
      // On error, fall through to Python backend
    }

    // ── Full analysis with streaming live block ─────────────────────────────
    const baseLiveData: ArenaLiveData = {
      question: q,
      phase: 'streaming',
      processedCount: 0,
      totalCount: personaCache.count,
      positive: 0,
      negative: 0,
      neutral: 0,
      simulation: null,
      totalPersonas: personaCache.count,
      media: mediaPreviews,
      mediaContext: enrichedContext || undefined,
    };

    // Block already created above — just update phase
    {
      const initialPhase = useLocalProcessing ? 'streaming' : 'collecting';
      emitLive(blockId, {
        ...baseLiveData,
        phase: initialPhase as ArenaLiveData['phase'],
        ...(initialPhase === 'collecting' ? { collectingStatus: 'analyzing' } : {}),
      });
    }

    // ── If local processing is sufficient, skip Python backend ──────────────
    if (useLocalProcessing) {
      broadcastToMonitor({ type: 'local_start', data: { question: q } });
      try {
        const queryForAnalysis = enrichedContext ? `${q}\n\nContexto: ${enrichedContext}` : q;
        let pos = 0, neg = 0, neu = 0;
        const segAcc = new SegmentAccumulator();
        const ideoAcc = new IdeologyAccumulator(q);
        const commentAcc = new LiveCommentAccumulator(q);
        const stateAcc = new StateAccumulator();
        const BATCH = 100;
        let liveComments: import('@/lib/arena/types').CommentResult[] = [];
        let aiCommentsFired = false;

        const getDelay = (progress: number) => {
          if (progress < 0.3) return 450;
          if (progress < 0.7) return 350;
          return 250;
        };

        let pendingPersonas: any[] = [];

        const allData = await personaCache.loadAll((loaded, total, batch) => {
          pendingPersonas.push(...batch);
          commentAcc.setTotal(total);
          emitLive(blockId, {
            ...baseLiveData,
            phase: 'streaming',
            processedCount: 0,
            totalCount: total,
          });
        });

        const toProcess = pendingPersonas.length > 0 ? pendingPersonas : allData;
        const effectiveCount = toProcess.length;
        commentAcc.setTotal(effectiveCount);

        for (let offset = 0; offset < effectiveCount; offset += BATCH) {
          const batch = toProcess.slice(offset, offset + BATCH);
          const processed = Math.min(offset + BATCH, effectiveCount);

          for (const p of batch) {
            const sentiment = computePersonaSentiment(p, queryForAnalysis);
            if (sentiment === 'positive') pos++;
            else if (sentiment === 'negative') neg++;
            else neu++;
            segAcc.addPersona(p, sentiment);
            ideoAcc.addPersona(p, sentiment);
            commentAcc.addPersona(p, sentiment);
            stateAcc.addPersona(p, sentiment);
          }

          emitLive(blockId, {
            ...baseLiveData,
            phase: 'streaming',
            processedCount: processed,
            totalCount: effectiveCount,
            positive: pos,
            negative: neg,
            neutral: neu,
            segments: segAcc.toSegments(),
            liveIdeology: ideoAcc.toResults(),
            liveComments,
            stateBreakdown: stateAcc.toStateBreakdown(),
          });

          // Fire AI comment generation at ~25% with selected personas
          const progress = processed / effectiveCount;
          if (!aiCommentsFired && progress >= 0.25 && commentAcc.count >= 8) {
            aiCommentsFired = true;
            const selectedSnapshot = [...commentAcc.selectedPersonas];
            generateAIComments(q, selectedSnapshot).then(aiComments => {
              liveComments = aiComments;
            }).catch(() => {});
          }

          await new Promise(r => setTimeout(r, getDelay(progress)));
        }

        // Enrichment: simulation
        const enhanced = runEnhancedSimulation(queryForAnalysis, effectiveCount, allData);

        const simWithoutComments = { ...enhanced, comments: [] as any[] };
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: effectiveCount,
          totalCount: effectiveCount,
          positive: simWithoutComments.positive,
          negative: simWithoutComments.negative,
          neutral: simWithoutComments.neutral,
          simulation: simWithoutComments,
          totalPersonas: effectiveCount,
          segments: segAcc.toSegments(),
          liveComments,
          stateBreakdown: stateAcc.toStateBreakdown(),
        });
        onProcessing(false);

        // Generate full AI comments with all personas
        const topicScores = detectTopics(q);
        const personasForAI = buildPersonasForAI(q, allData, topicScores);
        const claudeComments = await generateAIComments(q, personasForAI);

        const sim = { ...enhanced, comments: claudeComments };
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: effectiveCount,
          totalCount: effectiveCount,
          positive: sim.positive,
          negative: sim.negative,
          neutral: sim.neutral,
          simulation: sim,
          totalPersonas: effectiveCount,
          segments: segAcc.toSegments(),
          stateBreakdown: stateAcc.toStateBreakdown(),
        });
        return;
      } catch (localErr) {
        console.warn('[Arena] Local processing failed, trying Python:', localErr);
        // Fall through to Python backend
      }
    }

    // ── Python backend (for questions without local column match) ────────────
    // Abort previous
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Start in collecting phase — no metrics shown yet
    emitLive(blockId, {
      ...baseLiveData,
      phase: 'collecting',
      collectingStatus: 'analyzing',
    });

    let hasResults = false;
    let useFallback = false;
    let simulation: any = null;

    // ── Progressive accumulators fed by Python progress events ──────────
    const segAcc = new SegmentAccumulator();
    const ideoAcc = new IdeologyAccumulator(q);
    const commentAcc = new LiveCommentAccumulator(q);
    const stateAcc = new StateAccumulator();
    let liveComments: import('@/lib/arena/types').CommentResult[] = [];
    let aiCommentsFired = false;

    // Pre-load persona data for accumulators (fast, from cache)
    let allPersonas: any[] = [];
    let personaIndex = 0; // tracks how many personas we've fed to accumulators
    const personaLoadPromise = personaCache.loadAll().then(data => {
      allPersonas = data;
      commentAcc.setTotal(data.length);
    }).catch(() => {});

    /** Feed next N personas to ideology/comment accumulators based on Python progress */
    const feedAccumulators = (pythonProcessed: number, pythonTotal: number) => {
      if (allPersonas.length === 0) return;
      // Map Python progress proportionally to local personas
      const targetIndex = Math.min(
        Math.floor((pythonProcessed / pythonTotal) * allPersonas.length),
        allPersonas.length,
      );
      const queryForLocal = enrichedContext ? `${q}\n\nContexto: ${enrichedContext}` : q;
      while (personaIndex < targetIndex) {
        const p = allPersonas[personaIndex];
        const sentiment = computePersonaSentiment(p, queryForLocal);
        segAcc.addPersona(p, sentiment);
        ideoAcc.addPersona(p, sentiment);
        commentAcc.addPersona(p, sentiment);
        stateAcc.addPersona(p, sentiment);
        personaIndex++;
      }
      // NOTE: We do NOT generate local AI comments for the Python path.
      // The Python backend generates contextual comments with full persona profiles.
      // Local generateAIComments lacks the context (e.g., who Vorcaro is) and produces wrong comments.
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
                      segments: segAcc.toSegments(),
                      liveIdeology: ideoAcc.toResults(),
                      liveComments,
                      stateBreakdown: stateAcc.toStateBreakdown(),
                    });
                  } else if (pythonPhase === 'processing_personas') {
                    // Transition from collecting to streaming
                    emitLive(blockId, {
                      ...baseLiveData,
                      phase: 'streaming',
                      processedCount: 0,
                      totalCount: baseLiveData.totalCount,
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

                case 'progress': {
                  receivedAnyProgress = true;
                  stallThreshold = 120_000;
                  // Feed accumulators proportionally to Python progress
                  feedAccumulators(payload.data.processed, payload.data.total);
                  // Emit with Python sentiment + progressive ideology/comments
                  emitLive(blockId, {
                    ...baseLiveData,
                    phase: 'streaming',
                    processedCount: payload.data.processed,
                    totalCount: payload.data.total,
                    positive: payload.data.positive,
                    negative: payload.data.negative,
                    neutral: payload.data.neutral,
                    segments: payload.data.segments || segAcc.toSegments(),
                    liveIdeology: ideoAcc.toResults(),
                    liveComments,
                    stateBreakdown: stateAcc.toStateBreakdown(),
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
                  const backendSegments = resultsData.segments;
                  delete resultsData.segments;
                  simulation = resultsData as EnhancedSimulationResult;
                  if (backendSegments) {
                    (simulation as any)._backendSegments = backendSegments;
                  }
                  hasResults = true;
                  break;
                }

                case 'done': {
                  streamDone = true;
                  await personaLoadPromise;
                  // Feed remaining personas to accumulators
                  feedAccumulators(payload.data.total_personas || simulation?.total || allPersonas.length, payload.data.total_personas || simulation?.total || allPersonas.length);
                  const doneTotal = payload.data.total_personas || simulation?.total || 0;
                  const doneSegments = (simulation as any)?._backendSegments;
                  const liveIdeo = ideoAcc.toResults();
                  const doneStateBreakdown = stateAcc.toStateBreakdown();

                  // Build complete snapshot — all subsequent emissions extend this
                  const completeBase = {
                    ...baseLiveData,
                    phase: 'complete' as const,
                    processedCount: doneTotal,
                    totalCount: doneTotal,
                    positive: simulation?.positive || 0,
                    negative: simulation?.negative || 0,
                    neutral: simulation?.neutral || 0,
                    simulation,
                    totalPersonas: doneTotal,
                    segments: doneSegments || segAcc.toSegments(),
                    liveIdeology: liveIdeo,
                    liveComments,
                    stateBreakdown: doneStateBreakdown,
                  };

                  emitLive(blockId, completeBase);
                  onProcessing(false);

                  // Compute segments locally if backend didn't provide them
                  if (!doneSegments && allPersonas.length > 0) {
                    const queryForSeg = enrichedContext ? `${q}\n\nContexto: ${enrichedContext}` : q;
                    const segs = computeAllSegments(allPersonas, (p) => computePersonaSentiment(p, queryForSeg));
                    completeBase.segments = segs;
                    emitLive(blockId, completeBase);
                  }

                  // Generate full AI comments if not already available
                  if (!simulation?.comments?.length) {
                    const topicScores = detectTopics(enrichedContext ? `${q}\n\nContexto: ${enrichedContext}` : q);
                    const personasForAI = buildPersonasForAI(q, allPersonas.length > 0 ? allPersonas : await personaCache.loadAll(), topicScores);
                    const claudeComments = await generateAIComments(q, personasForAI);
                    simulation = { ...simulation, comments: claudeComments };
                    completeBase.simulation = simulation;
                    emitLive(blockId, completeBase);
                  }
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
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: total,
          totalCount: total,
          positive: simulation?.positive || 0,
          negative: simulation?.negative || 0,
          neutral: simulation?.neutral || 0,
          simulation,
          totalPersonas: total,
          segments: segAcc.toSegments(),
          liveIdeology: ideoAcc.toResults(),
          liveComments,
          stateBreakdown: stateAcc.toStateBreakdown(),
        });
        onProcessing(false);
      } else if (!streamDone && !hasResults) {
        console.warn('[Arena] ⚠️ Stream incomplete, no results — FALLING BACK TO LOCAL');
        useFallback = true;
      }
    } catch (err: any) {
      console.error('[Arena] ❌ Python fetch error:', err?.name, err?.message);
      if (err?.name === 'AbortError' && hasResults) {
        const total = simulation?.total || 0;
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          simulation,
          positive: simulation?.positive || 0,
          negative: simulation?.negative || 0,
          neutral: simulation?.neutral || 0,
          totalPersonas: total,
          segments: segAcc.toSegments(),
          liveIdeology: ideoAcc.toResults(),
          liveComments,
          stateBreakdown: stateAcc.toStateBreakdown(),
        });
        onProcessing(false);
        return;
      }
      if (err?.name === 'AbortError' && !hasResults) {
        useFallback = true;
      } else if (hasResults) {
        const total = simulation?.total || 0;
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          simulation,
          positive: simulation?.positive || 0,
          negative: simulation?.negative || 0,
          neutral: simulation?.neutral || 0,
          totalPersonas: total,
          segments: segAcc.toSegments(),
          liveIdeology: ideoAcc.toResults(),
          liveComments,
          stateBreakdown: stateAcc.toStateBreakdown(),
        });
        onProcessing(false);
        return;
      } else {
        useFallback = true;
      }
    }

    // ── Fallback: local JS simulation with progressive segments ────────────
    if (useFallback) {
      console.warn('[Arena] 🔄 Running LOCAL FALLBACK (Python unavailable)');
      try {
        const queryForAnalysis = enrichedContext ? `${q}\n\nContexto: ${enrichedContext}` : q;
        let pos = 0, neg = 0, neu = 0;
        const segAcc = new SegmentAccumulator();
        const ideoAcc = new IdeologyAccumulator(q);
        const commentAcc = new LiveCommentAccumulator(q);
        const stateAccFb = new StateAccumulator();
        const BATCH = 100;
        let liveComments: import('@/lib/arena/types').CommentResult[] = [];
        let aiCommentsFired = false;

        const getDelay = (progress: number) => {
          if (progress < 0.3) return 450;
          if (progress < 0.7) return 350;
          return 250;
        };

        let pendingPersonas: any[] = [];

        const allData = await personaCache.loadAll((loaded, total, batch) => {
          pendingPersonas.push(...batch);
          commentAcc.setTotal(total);
          emitLive(blockId, {
            ...baseLiveData,
            phase: 'streaming',
            processedCount: 0,
            totalCount: total,
          });
        });

        const toProcess = pendingPersonas.length > 0 ? pendingPersonas : allData;
        const effectiveCount = toProcess.length;
        commentAcc.setTotal(effectiveCount);

        for (let offset = 0; offset < effectiveCount; offset += BATCH) {
          const batch = toProcess.slice(offset, offset + BATCH);
          const processed = Math.min(offset + BATCH, effectiveCount);

          for (const p of batch) {
            const sentiment = computePersonaSentiment(p, queryForAnalysis);
            if (sentiment === 'positive') pos++;
            else if (sentiment === 'negative') neg++;
            else neu++;
            segAcc.addPersona(p, sentiment);
            ideoAcc.addPersona(p, sentiment);
            commentAcc.addPersona(p, sentiment);
            stateAccFb.addPersona(p, sentiment);
          }

          emitLive(blockId, {
            ...baseLiveData,
            phase: 'streaming',
            processedCount: processed,
            totalCount: effectiveCount,
            positive: pos,
            negative: neg,
            neutral: neu,
            segments: segAcc.toSegments(),
            liveIdeology: ideoAcc.toResults(),
            liveComments,
            stateBreakdown: stateAccFb.toStateBreakdown(),
          });

          // Fire AI comment generation at ~25% with selected personas
          const progress = processed / effectiveCount;
          if (!aiCommentsFired && progress >= 0.25 && commentAcc.count >= 8) {
            aiCommentsFired = true;
            const selectedSnapshot = [...commentAcc.selectedPersonas];
            generateAIComments(q, selectedSnapshot).then(aiComments => {
              liveComments = aiComments;
            }).catch(() => {});
          }

          await new Promise(r => setTimeout(r, getDelay(progress)));
        }

        // Enrichment: simulation
        const enhanced = runEnhancedSimulation(queryForAnalysis, effectiveCount, allData);

        const simWithoutComments = { ...enhanced, comments: [] as any[] };
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: effectiveCount,
          totalCount: effectiveCount,
          positive: simWithoutComments.positive,
          negative: simWithoutComments.negative,
          neutral: simWithoutComments.neutral,
          simulation: simWithoutComments,
          totalPersonas: effectiveCount,
          segments: segAcc.toSegments(),
          liveComments,
          stateBreakdown: stateAccFb.toStateBreakdown(),
        });
        onProcessing(false);

        // Generate full AI comments with all personas
        const topicScores = detectTopics(q);
        const personasForAI = buildPersonasForAI(q, allData, topicScores);
        const claudeComments = await generateAIComments(q, personasForAI);

        const sim = { ...enhanced, comments: claudeComments };
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          processedCount: effectiveCount,
          totalCount: effectiveCount,
          positive: sim.positive,
          negative: sim.negative,
          neutral: sim.neutral,
          simulation: sim,
          totalPersonas: effectiveCount,
          segments: segAcc.toSegments(),
          stateBreakdown: stateAccFb.toStateBreakdown(),
        });
      } catch (fallbackErr) {
        console.error('[Arena] Fallback failed:', fallbackErr);
        emitLive(blockId, {
          ...baseLiveData,
          phase: 'complete',
          error: 'Falha ao processar',
        });
        onProcessing(false);
      }
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
      handleSubmit(detail.question, detail.contextText, detail.attachments);
    };
    window.addEventListener('arena-rich-submit', handler);
    return () => window.removeEventListener('arena-rich-submit', handler);
  }, [handleSubmit]);

  // Listen for "Novo Chat" — abort running simulation + broadcast reset to presentation screens
  useEffect(() => {
    const handler = () => {
      // Abort any running Python backend request
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      broadcastToMonitor({ type: 'arena-reset', data: null });
    };
    window.addEventListener('arena-new-chat', handler);
    return () => window.removeEventListener('arena-new-chat', handler);
  }, []);

  return null; // Logic-only component
}
