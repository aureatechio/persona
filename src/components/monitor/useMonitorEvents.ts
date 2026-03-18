'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';
import type {
  PipelineState,
  LogEntry,
  NodeStatus,
} from './types';
import {
  initialState,
  initialStepDetails,
  MONITOR_CHANNEL,
  NODE_LABELS,
} from './types';

/* ================================================================
   useMonitorEvents — BroadcastChannel listener hook
   ================================================================ */

export function useMonitorEvents(): {
  state: PipelineState;
  selectedNode: string | null;
  setSelectedNode: (node: string | null) => void;
  elapsed: string;
  logCountFor: (key: string) => number;
  lastLogFor: (key: string) => string | undefined;
  nodeHasDetail: (key: string) => boolean;
} {
  const [state, setState] = useState<PipelineState>({ ...initialState });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const logIdRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tick, setTick] = useState(0);

  // Timer for elapsed display
  useEffect(() => {
    if (!state.startTime || state.endTime) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.startTime, state.endTime]);

  const addLog = useCallback((step: string, level: LogEntry['level'], message: string, detail?: Record<string, unknown>) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, {
        id: `log-${logIdRef.current++}`,
        timestamp: Date.now(),
        step,
        level,
        message,
        detail,
      }],
    }));
  }, []);

  const updateNode = useCallback((key: string, status: NodeStatus) => {
    setState(prev => ({
      ...prev,
      nodes: { ...prev.nodes, [key]: status },
    }));
  }, []);

  /* ── Listen to BroadcastChannel from main Arena page ─────── */
  useEffect(() => {
    console.log('[Monitor] Criando BroadcastChannel listener...');
    const channel = new BroadcastChannel(MONITOR_CHANNEL);

    channel.onmessage = (event) => {
      const payload = event.data;
      console.log('[Monitor] Evento recebido:', payload?.type, payload);
      if (!payload || !payload.type) return;

      switch (payload.type) {
        /* ── Events from ArenaMode.tsx ─────────────────────── */

        case 'pipeline_start': {
          logIdRef.current = 0;
          const hasMedia = payload.data.hasMedia;
          setState({
            ...initialState,
            question: payload.data.question,
            topic: payload.data.question,
            corePoint: '',
            startTime: Date.now(),
            listening: true,
            nodes: {
              ...initialState.nodes,
              // Media: contextExtraction will go through running → complete
              // Text-only: contextExtraction completes immediately via context_extracted
              contextExtraction: hasMedia ? 'running' : 'idle',
            },
          });
          addLog('system', 'info', `Pipeline iniciado: "${payload.data.question}"`);
          if (hasMedia) {
            addLog('contextExtraction', 'info', 'Extraindo conteudo da midia...');
          }
          break;
        }

        case 'context_extracting': {
          updateNode('contextExtraction', 'running');
          addLog('contextExtraction', 'info', 'Analisando midia com IA...');
          break;
        }

        case 'context_extracted': {
          const d = payload.data;
          updateNode('contextExtraction', 'complete');
          addLog('contextExtraction', 'info',
            d.rawTranscript
              ? `Transcricao extraida: ${d.rawTranscript.length.toLocaleString('pt-BR')} caracteres`
              : 'Contexto recebido',
          );
          if (d.corePoint) {
            addLog('contextExtraction', 'info', `Ponto central: ${d.corePoint}`);
          }
          if (d.politicalFigures?.length > 0) {
            addLog('contextExtraction', 'info',
              `Figuras politicas: ${d.politicalFigures.map((f: any) => `${f.nome} (${f.alinhamento})`).join(', ')}`,
            );
          }
          setState(prev => ({
            ...prev,
            contextExtraction: d,
            topic: d.corePoint || prev.topic || prev.question,
            corePoint: d.corePoint || prev.corePoint,
          }));
          break;
        }

        case 'pipeline_topic': {
          setState(prev => ({
            ...prev,
            topic: payload.data.topic || prev.topic,
            corePoint: payload.data.corePoint || prev.corePoint,
            question: payload.data.question || prev.question,
          }));
          break;
        }

        /* ── SSE events forwarded from Python backend ─────── */

        case 'route':
          addLog('system', 'debug', `Backend Python confirmou: ${payload.data?.route}`);
          break;

        case 'phase': {
          const phase = payload.data?.phase;
          const msg = payload.data?.message || `Fase: ${phase}`;

          const map: Record<string, { node: string; completeNodes?: string[] }> = {
            analyzing_query: { node: 'queryAnalyzer' },
            web_research: { node: 'webResearch', completeNodes: ['queryAnalyzer'] },
            building_context: { node: 'contextBuilder', completeNodes: ['webResearch'] },
            validating_context: { node: 'contextValidator', completeNodes: ['contextBuilder'] },
            loading_personas: {
              node: 'personaLoader',
              completeNodes: ['queryAnalyzer', 'webResearch', 'contextBuilder', 'contextValidator'],
            },
            processing_personas: { node: 'personaLoop', completeNodes: ['personaLoader'] },
            aggregating: { node: 'aggregator', completeNodes: ['personaLoop'] },
          };

          const m = map[phase];
          if (m) {
            m.completeNodes?.forEach(n => {
              setState(prev => {
                if (prev.nodes[n] === 'running') {
                  return { ...prev, nodes: { ...prev.nodes, [n]: 'complete' } };
                }
                // idle → skipped (step never ran, don't show as complete)
                // Exception: queryAnalyzer may have detail from log event, mark complete instead
                if (prev.nodes[n] === 'idle') {
                  if (n === 'queryAnalyzer' && prev.stepDetails.queryAnalyzer) {
                    return { ...prev, nodes: { ...prev.nodes, [n]: 'complete' } };
                  }
                  return { ...prev, nodes: { ...prev.nodes, [n]: 'skipped' } };
                }
                return prev;
              });
            });
            updateNode(m.node, 'running');
            addLog(m.node, 'info', msg);
          }
          break;
        }

        case 'log': {
          const d = payload.data;
          addLog(d.step || 'system', d.level || 'info', d.message || '', d.detail);

          // Store structured step details for rich panels
          if (d.step === 'query_analyzer' && d.detail?.needs_research !== undefined) {
            updateNode('queryAnalyzer', 'complete');
            setState(prev => ({
              ...prev,
              stepDetails: {
                ...prev.stepDetails,
                queryAnalyzer: {
                  needs_research: d.detail.needs_research as boolean,
                  reason: (d.detail.reason as string) || d.message || '',
                },
              },
            }));
            if (!d.detail.needs_research) {
              updateNode('webResearch', 'skipped');
              addLog('webResearch', 'debug', 'Pulado — Claude decidiu que nao precisa pesquisa');
              updateNode('contextBuilder', 'skipped');
              updateNode('contextValidator', 'skipped');
            }
          }
          if (d.step === 'web_research' && d.detail) {
            setState(prev => ({
              ...prev,
              stepDetails: {
                ...prev.stepDetails,
                webResearch: {
                  queries: (d.detail.queries as string[]) || [],
                  snippets: (d.detail.snippets as string[]) || [],
                  sources: (d.detail.sources as string[]) || [],
                },
              },
            }));
          }
          if (d.step === 'context_builder' && d.detail) {
            updateNode('contextBuilder', 'complete');
            // Context built → validator starts
            updateNode('contextValidator', 'running');
            addLog('contextValidator', 'info', 'Validando precisao e neutralidade do contexto...');
            setState(prev => ({
              ...prev,
              stepDetails: {
                ...prev.stepDetails,
                context: {
                  tema: (d.detail.tema as string) || '',
                  contexto: (d.detail.contexto as string) || '',
                  figuras: (d.detail.figuras as Array<Record<string, unknown>>) || [],
                  periodo: (d.detail.periodo as string) || '',
                },
              },
            }));
          }
          if (d.step === 'context_validator' && d.detail) {
            updateNode('contextValidator', 'complete');
            setState(prev => ({
              ...prev,
              stepDetails: {
                ...prev.stepDetails,
                validator: {
                  verdict: (d.detail.verdict as string) || '',
                  issues: (d.detail.issues as string[]) || [],
                  corrections: (d.detail.corrections as string) || '',
                  fullContext: (d.detail.full_context as string) || '',
                  figuras: (d.detail.figuras as Array<Record<string, unknown>>) || [],
                },
              },
            }));
          }
          if (d.step === 'ideological_frame' && d.detail) {
            const frame = (d.detail.frame as string) || '';
            addLog('contextValidator', 'info', 'Vies ideologico mapeado para o tema');
            setState(prev => ({
              ...prev,
              stepDetails: {
                ...prev.stepDetails,
                ideologicalFrame: frame,
              },
            }));
          }
          break;
        }

        case 'web_complete':
          updateNode('webResearch', 'complete');
          addLog('webResearch', 'info',
            `Pesquisa concluida: ${payload.data.snippets_count} trechos de ${payload.data.sources_count} fontes`,
            payload.data,
          );
          // If webResearch detail wasn't populated by a log event, populate from web_complete
          setState(prev => {
            if (prev.stepDetails.webResearch) return prev; // already populated
            return {
              ...prev,
              stepDetails: {
                ...prev.stepDetails,
                webResearch: {
                  queries: (payload.data.queries as string[]) || [],
                  snippets: (payload.data.snippets as string[]) || [],
                  sources: (payload.data.sources as string[]) || [],
                },
              },
            };
          });
          break;

        case 'personas_loaded': {
          const count = payload.data.count;
          addLog('personaLoader', 'info', `${count?.toLocaleString('pt-BR')} personas carregadas do banco`);
          // If intermediate steps are still idle, the simple worker skipped them
          setState(prev => {
            const nodes = { ...prev.nodes };
            ['queryAnalyzer', 'webResearch', 'contextBuilder', 'contextValidator'].forEach(n => {
              if (nodes[n] === 'idle') nodes[n] = 'skipped';
            });
            nodes.personaLoader = 'complete';
            return { ...prev, nodes, progress: { ...prev.progress, total: count } };
          });
          break;
        }

        case 'progress':
          updateNode('personaLoop', 'running');
          setState(prev => ({
            ...prev,
            progress: {
              processed: payload.data.processed,
              total: payload.data.total,
              positive: payload.data.positive,
              negative: payload.data.negative,
              neutral: payload.data.neutral,
            },
            avgScore: payload.data.avgScore ?? prev.avgScore,
          }));
          break;

        case 'batch_detail':
          // Check if this is a prompt sample (first event before actual batches)
          if (payload.data.type === 'prompt_sample') {
            setState(prev => ({
              ...prev,
              stepDetails: {
                ...prev.stepDetails,
                promptSample: {
                  system_prompt: payload.data.system_prompt || '',
                  user_prompt: payload.data.user_prompt || '',
                  persona_count: payload.data.persona_count || 0,
                  note: payload.data.note || '',
                },
              },
            }));
            addLog('personaLoop', 'info', `Prompt montado — ${payload.data.persona_count} personas no batch de amostra`);
          } else {
            setState(prev => ({
              ...prev,
              batches: [...prev.batches, payload.data],
            }));
            addLog('personaLoop', 'debug',
              `Lote ${payload.data.model}: ${payload.data.persona_count} personas → ${payload.data.personas_summary?.filter((p: any) => p.sentiment === 'positive').length} a favor, ${payload.data.personas_summary?.filter((p: any) => p.sentiment === 'negative').length} contra`,
            );
          }
          break;

        case 'results':
          updateNode('aggregator', 'complete');
          updateNode('personaLoop', 'complete');
          addLog('aggregator', 'info', `Resultados: ${payload.data.total} personas | A favor: ${payload.data.positive} | Contra: ${payload.data.negative} | Neutros: ${payload.data.neutral}`, {
            total: payload.data.total,
            a_favor: payload.data.positive,
            contra: payload.data.negative,
            neutros: payload.data.neutral,
          });
          break;

        case 'done':
          addLog('system', 'info',
            `Pipeline finalizado em ${(payload.data.processing_time_ms / 1000).toFixed(1)}s — ${payload.data.total_personas?.toLocaleString('pt-BR')} personas`,
            payload.data,
          );
          setState(prev => {
            const updated = { ...prev.nodes };
            // Mark aggregator as complete explicitly
            updated.aggregator = 'complete';
            for (const key of Object.keys(updated)) {
              if (updated[key] === 'running') updated[key] = 'complete';
            }
            return { ...prev, nodes: updated, endTime: Date.now() };
          });
          break;

        /* ── Live update from ArenaMode (score-based) ─────── */
        case 'arena-live-update': {
          const live = payload.data as ArenaLiveData;
          setState(prev => ({
            ...prev,
            question: prev.question || live.question || '',
            avgScore: live.avgScore ?? prev.avgScore,
            segments: live.segments ?? prev.segments,
            progress: {
              processed: live.processedCount ?? prev.progress.processed,
              total: live.totalCount ?? prev.progress.total,
              positive: live.positive ?? prev.progress.positive,
              negative: live.negative ?? prev.progress.negative,
              neutral: live.neutral ?? prev.progress.neutral,
            },
          }));
          break;
        }

        case 'arena-reset': {
          logIdRef.current = 0;
          setState({
            ...initialState,
            listening: true,
          });
          break;
        }
      }
    };

    setState(prev => ({ ...prev, listening: true }));

    return () => channel.close();
  }, [addLog, updateNode]);

  /* ── Computed helpers ─────── */

  const elapsed = state.startTime
    ? (((state.endTime || Date.now()) - state.startTime) / 1000).toFixed(0)
    : '0';

  const logCountFor = (key: string) => {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    return state.logs.filter(l => l.step === key || l.step === snakeKey || l.step.includes(snakeKey)).length;
  };

  const lastLogFor = (key: string) => {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    const matching = state.logs.filter(l => l.step === key || l.step === snakeKey || l.step.includes(snakeKey));
    return matching[matching.length - 1]?.message;
  };

  const nodeHasDetail = (key: string): boolean => {
    // Skipped steps always have detail (the "skipped" message)
    if (state.nodes[key] === 'skipped') return true;
    if (key === 'contextExtraction') return !!state.contextExtraction;
    if (key === 'queryAnalyzer') return !!state.stepDetails.queryAnalyzer;
    if (key === 'webResearch') return !!state.stepDetails.webResearch;
    if (key === 'contextBuilder') return !!state.stepDetails.context;
    if (key === 'contextValidator') return !!state.stepDetails.validator;
    if (key === 'personaLoader') return state.progress.total > 0;
    if (key === 'personaLoop') return state.batches.length > 0 || state.progress.processed > 0;
    return false;
  };

  return {
    state,
    selectedNode,
    setSelectedNode,
    elapsed,
    logCountFor,
    lastLogFor,
    nodeHasDetail,
  };
}
