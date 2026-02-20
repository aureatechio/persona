'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import type { ConversationBlock } from '@/hooks/useConversation';
import type { Sentiment, EnhancedSimulationResult } from '@/lib/arena';
import {
  CLUSTERS,
  detectTopics,
  buildPersonasForAI,
  generateAIComments,
  runEnhancedSimulation,
} from '@/lib/arena';
import { processAttachmentsForUpload, type Attachment } from '@/lib/file-utils';

interface ArenaModeProps {
  personaCache: {
    personas: any[];
    count: number;
    loadAll: () => Promise<any[]>;
  };
  onAddBlock: (block: ConversationBlock) => void;
  onReplaceBlock: (id: string, block: ConversationBlock) => void;
  onProcessing: (processing: boolean) => void;
}

export function ArenaMode({ personaCache, onAddBlock, onReplaceBlock, onProcessing }: ArenaModeProps) {
  const abortRef = useRef<AbortController | null>(null);
  const processingIdRef = useRef<string | null>(null);

  const handleSubmit = useCallback(async (value: string, contextText?: string, attachments?: Attachment[]) => {
    let q = value.trim();
    const hasMedia = attachments && attachments.length > 0;

    // Must have either text or media
    if (!q && !hasMedia) return;

    onProcessing(true);

    const blockId = crypto.randomUUID();
    processingIdRef.current = blockId;

    // Process attachments to base64
    const processedAttachments = hasMedia
      ? await processAttachmentsForUpload(attachments)
      : undefined;

    let enrichedContext = contextText || '';

    // Keep small previews for the result block (thumbnail), full images for scanner
    const mediaPreviews = hasMedia
      ? attachments.map(a => ({ type: a.type, preview: a.preview, name: a.name }))
      : undefined;

    // Scanner gets the full compressed images for a better display
    const scannerPreviews = hasMedia && processedAttachments
      ? attachments.map((a, i) => ({
          type: a.type,
          preview: processedAttachments[i]?.type === 'image' ? processedAttachments[i].data : a.preview,
          name: a.name,
        }))
      : mediaPreviews;

    // If there are media attachments, use Claude to extract context
    if (processedAttachments?.length) {
      // Show the scanner block while analyzing media
      onAddBlock({
        id: blockId,
        type: 'media-scanning',
        timestamp: new Date(),
        data: {
          previews: scannerPreviews,
          phase: 'Analisando mídia com IA...',
        },
      });

      try {
        const mediaRes = await fetch('/api/analyze-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachments: processedAttachments,
            question: q || undefined,
            generate_question: !q, // Ask AI to generate a question if user didn't provide one
          }),
        });

        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();

          // If no question was provided, use the AI-generated one
          if (!q && mediaData.generated_question) {
            q = mediaData.generated_question;
          }

          if (mediaData.context) {
            enrichedContext = enrichedContext
              ? `${enrichedContext}\n\n--- Contexto extraido da midia ---\n${mediaData.context}`
              : mediaData.context;
          }
        }
      } catch (mediaErr) {
        console.warn('[Arena] Media analysis failed, continuing without:', mediaErr);
      }

      // If still no question after media analysis, create a generic one
      if (!q) {
        q = 'O que voce acha deste conteudo?';
      }

      // Transition from scanner to processing block
      onReplaceBlock(blockId, {
        id: blockId,
        type: 'processing',
        timestamp: new Date(),
        data: {
          type: 'arena',
          question: q,
          pipelinePhase: 'Analisando personas...',
          processedCount: 0,
          totalCount: personaCache.count,
        },
      });
    } else {
      // No media - text only, go straight to processing
      if (!q) return; // Safety: shouldn't happen but just in case
      onAddBlock({
        id: blockId,
        type: 'processing',
        timestamp: new Date(),
        data: {
          type: 'arena',
          question: q,
          pipelinePhase: 'Analisando personas...',
          processedCount: 0,
          totalCount: personaCache.count,
        },
      });
    }

    // Abort previous
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let hasResults = false;
    let useFallback = false;
    let simulation: any = null;

    try {
      const fetchTimeout = setTimeout(() => {
        if (!hasResults && !simulation) controller.abort();
      }, 120000);

      const response = await fetch('/api/arena/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          cluster_filter: null,
          ...(enrichedContext && { context_text: enrichedContext }),
        }),
        signal: controller.signal,
      });

      clearTimeout(fetchTimeout);

      if (!response.ok || !response.body) throw new Error('Python backend unavailable');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;
      let lastEventTime = Date.now();
      let receivedAnyProgress = false;
      let stallThreshold = 30_000;

      const stallCheck = setInterval(() => {
        if (Date.now() - lastEventTime > stallThreshold && !hasResults) {
          clearInterval(stallCheck);
          reader.cancel();
        }
      }, 5000);

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

              switch (payload.type) {
                case 'phase':
                  if (payload.data?.phase === 'aggregating') {
                    onReplaceBlock(blockId, {
                      id: blockId,
                      type: 'processing',
                      timestamp: new Date(),
                      data: {
                        type: 'arena',
                        question: q,
                        pipelinePhase: 'Agregando resultados...',
                        processedCount: simulation?.total || personaCache.count,
                        totalCount: simulation?.total || personaCache.count,
                      },
                    });
                  }
                  break;

                case 'personas_loaded':
                  onReplaceBlock(blockId, {
                    id: blockId,
                    type: 'processing',
                    timestamp: new Date(),
                    data: {
                      type: 'arena',
                      question: q,
                      pipelinePhase: 'Analisando personas...',
                      processedCount: 0,
                      totalCount: payload.data.count,
                    },
                  });
                  break;

                case 'progress':
                  receivedAnyProgress = true;
                  stallThreshold = 90_000;
                  onReplaceBlock(blockId, {
                    id: blockId,
                    type: 'processing',
                    timestamp: new Date(),
                    data: {
                      type: 'arena',
                      question: q,
                      pipelinePhase: 'Processando respostas...',
                      processedCount: payload.data.processed,
                      totalCount: payload.data.total,
                    },
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

                case 'results':
                  simulation = payload.data as EnhancedSimulationResult;
                  hasResults = true;
                  break;

                case 'done':
                  streamDone = true;
                  // Replace processing with result
                  onReplaceBlock(blockId, {
                    id: blockId,
                    type: 'arena-result',
                    timestamp: new Date(),
                    data: { question: q, simulation, totalPersonas: payload.data.total_personas, media: mediaPreviews, mediaContext: enrichedContext || undefined },
                  });
                  onProcessing(false);
                  break;
              }
            } catch {
              // Skip parse errors
            }
          }
        }
      } finally {
        clearInterval(stallCheck);
      }

      if (!streamDone && hasResults) {
        onReplaceBlock(blockId, {
          id: blockId,
          type: 'arena-result',
          timestamp: new Date(),
          data: { question: q, simulation, totalPersonas: simulation?.total || 0, media: mediaPreviews, mediaContext: enrichedContext || undefined },
        });
        onProcessing(false);
      } else if (!streamDone && !hasResults) {
        useFallback = true;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' && hasResults) {
        onReplaceBlock(blockId, {
          id: blockId,
          type: 'arena-result',
          timestamp: new Date(),
          data: { question: q, simulation, totalPersonas: simulation?.total || 0, media: mediaPreviews, mediaContext: enrichedContext || undefined },
        });
        onProcessing(false);
        return;
      }
      if (err?.name === 'AbortError' && !hasResults) {
        useFallback = true;
      } else if (hasResults) {
        onReplaceBlock(blockId, {
          id: blockId,
          type: 'arena-result',
          timestamp: new Date(),
          data: { question: q, simulation, totalPersonas: simulation?.total || 0, media: mediaPreviews, mediaContext: enrichedContext || undefined },
        });
        onProcessing(false);
        return;
      } else {
        useFallback = true;
      }
    }

    // Fallback JS
    if (useFallback) {
      try {
        onReplaceBlock(blockId, {
          id: blockId,
          type: 'processing',
          timestamp: new Date(),
          data: {
            type: 'arena',
            question: q,
            pipelinePhase: 'Simulacao local...',
            processedCount: 0,
            totalCount: personaCache.count,
          },
        });

        const allData = await personaCache.loadAll();
        const effectiveCount = allData.length || personaCache.count;

        // Animate counter
        const animDuration = 5000;
        const animStart = performance.now();
        let animStopped = false;

        const animateCount = (time: number) => {
          if (animStopped) return;
          const progress = Math.min((time - animStart) / animDuration, 1);
          const eased = 1 - Math.pow(1 - progress, 2);
          const count = Math.round(effectiveCount * eased);
          onReplaceBlock(blockId, {
            id: blockId,
            type: 'processing',
            timestamp: new Date(),
            data: {
              type: 'arena',
              question: q,
              pipelinePhase: 'Simulacao local...',
              processedCount: count,
              totalCount: effectiveCount,
            },
          });
          if (progress < 1) requestAnimationFrame(animateCount);
        };
        requestAnimationFrame(animateCount);

        const queryForAnalysis = enrichedContext ? `${q}\n\nContexto: ${enrichedContext}` : q;
        const enhanced = runEnhancedSimulation(queryForAnalysis, effectiveCount, allData);
        const topicScores = detectTopics(queryForAnalysis);
        const personasForAI = buildPersonasForAI(q, allData, topicScores);
        const claudeComments = await generateAIComments(q, personasForAI);

        animStopped = true;
        simulation = { ...enhanced, comments: claudeComments };

        onReplaceBlock(blockId, {
          id: blockId,
          type: 'arena-result',
          timestamp: new Date(),
          data: { question: q, simulation, totalPersonas: effectiveCount, media: mediaPreviews, mediaContext: enrichedContext || undefined },
        });
        onProcessing(false);
      } catch (fallbackErr) {
        console.error('[Arena] Fallback failed:', fallbackErr);
        onReplaceBlock(blockId, {
          id: blockId,
          type: 'arena-result',
          timestamp: new Date(),
          data: { question: q, simulation: null, error: 'Falha ao processar', media: mediaPreviews, mediaContext: enrichedContext || undefined },
        });
        onProcessing(false);
      }
    }
  }, [personaCache, onAddBlock, onReplaceBlock, onProcessing]);

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

  return null; // Logic-only component
}
