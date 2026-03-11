'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play, Square, Search, Brain, Globe, ShieldCheck, Users,
  Cpu, BarChart3, ChevronDown, ChevronRight,
  Database, Zap, AlertCircle, CheckCircle2, Loader2,
  MessageSquare, ArrowDown, GitBranch, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ================================================================
   Types
   ================================================================ */

type NodeStatus = 'idle' | 'running' | 'complete' | 'error' | 'skipped';

interface LogEntry {
  id: string;
  timestamp: number;
  step: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  detail?: Record<string, unknown>;
}

interface BatchDetail {
  model: string;
  persona_count: number;
  personas_summary: Array<{
    id: string;
    name: string;
    state: string;
    age: number;
    sentiment: string;
    comment: string;
  }>;
}

interface ClassifierDecision {
  route: string;
  fields: string[];
  reason: string;
}

interface PipelineState {
  route: 'unknown' | 'local' | 'python';
  classifierDecision: ClassifierDecision | null;
  nodes: Record<string, NodeStatus>;
  logs: LogEntry[];
  batches: BatchDetail[];
  progress: { processed: number; total: number; positive: number; negative: number; neutral: number };
  startTime: number | null;
  endTime: number | null;
}

const initialState: PipelineState = {
  route: 'unknown',
  classifierDecision: null,
  nodes: {
    classifier: 'idle',
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
  progress: { processed: 0, total: 0, positive: 0, negative: 0, neutral: 0 },
  startTime: null,
  endTime: null,
};

/* ================================================================
   Node Config
   ================================================================ */

const NODE_ICONS: Record<string, React.ReactNode> = {
  classifier: <GitBranch size={16} />,
  queryAnalyzer: <Search size={16} />,
  webResearch: <Globe size={16} />,
  contextBuilder: <Brain size={16} />,
  contextValidator: <ShieldCheck size={16} />,
  personaLoader: <Users size={16} />,
  personaLoop: <Cpu size={16} />,
  aggregator: <BarChart3 size={16} />,
};

const NODE_LABELS: Record<string, string> = {
  classifier: 'Decisao de Rota',
  queryAnalyzer: 'Analise da Pergunta',
  webResearch: 'Pesquisa na Web',
  contextBuilder: 'Construcao de Contexto',
  contextValidator: 'Validacao de Contexto',
  personaLoader: 'Carregamento de Personas',
  personaLoop: 'Processamento de Personas',
  aggregator: 'Agregacao de Resultados',
};

const NODE_DESCRIPTIONS: Record<string, string> = {
  classifier: 'GPT-4o-mini decide: Python IA ou Banco Local',
  queryAnalyzer: 'Claude Haiku decide se precisa pesquisa web',
  webResearch: 'Tavily busca 3 queries na web em paralelo',
  contextBuilder: 'Claude Haiku cria contexto factual neutro',
  contextValidator: 'Claude Haiku valida precisao e neutralidade',
  personaLoader: 'Carrega 20.000 personas do Supabase',
  personaLoop: 'Processa batches em paralelo com Claude + GPT',
  aggregator: 'Agrega sentimentos, segmentos e comentarios',
};

/* ================================================================
   Flow Node
   ================================================================ */

function FlowNode({
  nodeKey,
  status,
  logCount,
  lastLogMessage,
  isSelected,
  onClick,
  extra,
}: {
  nodeKey: string;
  status: NodeStatus;
  logCount: number;
  lastLogMessage?: string;
  isSelected: boolean;
  onClick: () => void;
  extra?: React.ReactNode;
}) {
  const statusIcon = {
    idle: <div className="w-2 h-2 rounded-full bg-zinc-700" />,
    running: <Loader2 size={14} className="text-violet-400 animate-spin" />,
    complete: <CheckCircle2 size={14} className="text-emerald-400" />,
    error: <AlertCircle size={14} className="text-red-400" />,
    skipped: <Minus size={14} className="text-zinc-700" />,
  }[status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border p-3.5 transition-all duration-300',
        status === 'running' ? 'border-violet-500/40 bg-violet-500/5' :
        status === 'complete' ? 'border-emerald-500/30 bg-emerald-500/5' :
        status === 'error' ? 'border-red-500/30 bg-red-500/5' :
        status === 'skipped' ? 'border-zinc-800/30 bg-zinc-950/40 opacity-40' :
        'border-zinc-800/50 bg-zinc-900/40',
        isSelected && 'ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/5',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          status === 'running' ? 'bg-violet-500/15 text-violet-400' :
          status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
          status === 'error' ? 'bg-red-500/10 text-red-400' :
          'bg-zinc-800/50 text-zinc-500',
        )}>
          {NODE_ICONS[nodeKey]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200">{NODE_LABELS[nodeKey]}</span>
            {statusIcon}
          </div>
          <p className="text-[9px] text-zinc-600 mt-0.5">
            {lastLogMessage || NODE_DESCRIPTIONS[nodeKey]}
          </p>
        </div>
        {logCount > 0 && (
          <span className="text-[9px] text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded-md tabular-nums">{logCount}</span>
        )}
      </div>
      {extra}
    </button>
  );
}

/* ================================================================
   Classifier Decision Card
   ================================================================ */

function ClassifierCard({ decision }: { decision: ClassifierDecision }) {
  const isPython = decision.route === 'python';

  return (
    <div className={cn(
      'mx-3 mt-3 rounded-xl border p-4 animate-fade-in-up',
      isPython
        ? 'bg-violet-500/5 border-violet-500/20'
        : 'bg-sky-500/5 border-sky-500/20',
    )}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className={cn(
          'w-6 h-6 rounded-lg flex items-center justify-center',
          isPython ? 'bg-violet-500/15' : 'bg-sky-500/15',
        )}>
          {isPython ? <Cpu size={12} className="text-violet-400" /> : <Database size={12} className="text-sky-400" />}
        </div>
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          isPython ? 'text-violet-400' : 'text-sky-400',
        )}>
          {isPython ? 'Caminho: Python IA' : 'Caminho: Banco Local'}
        </span>
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">Motivo da decisao</p>
          <p className="text-[11px] text-zinc-300 leading-relaxed">{decision.reason}</p>
        </div>
        {decision.fields.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Colunas usadas do banco</p>
            <div className="flex flex-wrap gap-1.5">
              {decision.fields.map(f => (
                <span key={f} className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400 border border-white/[0.04]">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
        {!isPython && decision.fields.length === 0 && (
          <p className="text-[10px] text-zinc-500">Nenhuma coluna especifica — usando inferencia geral</p>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   Connection Arrow
   ================================================================ */

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center py-0.5">
      <div className={cn(
        'w-px h-5 transition-colors duration-500',
        active ? 'bg-gradient-to-b from-violet-500/40 to-violet-500/10' : 'bg-zinc-800/30',
      )} />
    </div>
  );
}

/* ================================================================
   Log Panel
   ================================================================ */

function LogPanel({ logs, selectedNode }: { logs: LogEntry[]; selectedNode: string | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filtered = selectedNode
    ? logs.filter(l => {
        const snakeKey = selectedNode.replace(/([A-Z])/g, '_$1').toLowerCase();
        return l.step === selectedNode || l.step === snakeKey || l.step.includes(snakeKey.replace(/^_/, ''));
      })
    : logs;

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  const levelColors: Record<string, string> = {
    info: 'text-sky-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
    debug: 'text-zinc-500',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <MessageSquare size={12} className="text-zinc-500" />
          <span className="text-[11px] font-semibold text-zinc-400">
            Logs {selectedNode ? `— ${NODE_LABELS[selectedNode] || selectedNode}` : '— Todos'}
          </span>
          <span className="text-[9px] text-zinc-600 tabular-nums bg-zinc-800/50 px-1.5 py-0.5 rounded-md">{filtered.length}</span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all duration-200',
            autoScroll
              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
              : 'bg-white/[0.03] text-zinc-600 border border-white/[0.06]',
          )}
        >
          <ArrowDown size={9} />
          Auto-scroll
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 space-y-0.5 font-mono scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50"
        onScroll={(e) => {
          const el = e.currentTarget;
          const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          if (isAtBottom !== autoScroll) setAutoScroll(isAtBottom);
        }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-900/50 flex items-center justify-center mb-3">
              <MessageSquare size={20} className="text-zinc-700" />
            </div>
            <p className="text-[11px] text-zinc-600">Digite uma pergunta acima e clique Executar</p>
            <p className="text-[9px] text-zinc-700 mt-1">Todo o fluxo aparecera aqui em tempo real</p>
          </div>
        ) : (
          filtered.map(log => <LogLine key={log.id} log={log} levelColors={levelColors} />)
        )}
      </div>
    </div>
  );
}

function LogLine({ log, levelColors }: { log: LogEntry; levelColors: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = log.detail && Object.keys(log.detail).length > 0;
  const time = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="group">
      <div
        className={cn(
          'flex items-start gap-2 py-1 rounded-md px-1.5 -mx-1.5 transition-colors duration-150',
          hasDetail ? 'cursor-pointer hover:bg-white/[0.02]' : '',
        )}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <span className="text-[10px] text-zinc-700 tabular-nums shrink-0 mt-px">{time}</span>
        <span className={cn('text-[10px] font-bold uppercase w-10 shrink-0 mt-px', levelColors[log.level] || 'text-zinc-500')}>
          {log.level}
        </span>
        <span className="text-[10px] text-zinc-600 w-28 shrink-0 truncate mt-px">{log.step}</span>
        <span className="text-[10px] text-zinc-300 flex-1 break-words leading-relaxed">{log.message}</span>
        {hasDetail && (
          expanded
            ? <ChevronDown size={10} className="text-zinc-600 shrink-0 mt-1" />
            : <ChevronRight size={10} className="text-zinc-600 shrink-0 mt-1" />
        )}
      </div>
      {expanded && hasDetail && (
        <pre className="ml-[7rem] text-[9px] text-zinc-500 bg-zinc-950/60 rounded-lg p-3 my-1 overflow-x-auto max-h-72 border border-white/[0.03] whitespace-pre-wrap break-words">
          {JSON.stringify(log.detail, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ================================================================
   Batch Inspector
   ================================================================ */

function BatchInspector({ batches }: { batches: BatchDetail[] }) {
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && expandedBatch === null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [batches.length, expandedBatch]);

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-12 h-12 rounded-xl bg-zinc-900/50 flex items-center justify-center mb-3">
          <Cpu size={20} className="text-zinc-700" />
        </div>
        <p className="text-[11px] text-zinc-600">Nenhum lote processado ainda</p>
        <p className="text-[9px] text-zinc-700 mt-1">Os lotes aparecem quando o Python processa as personas</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="overflow-y-auto h-full px-4 py-3 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
      {batches.map((batch, idx) => {
        const isExpanded = expandedBatch === idx;
        const pos = batch.personas_summary.filter(p => p.sentiment === 'positive').length;
        const neg = batch.personas_summary.filter(p => p.sentiment === 'negative').length;
        const neu = batch.personas_summary.filter(p => p.sentiment === 'neutral').length;

        return (
          <div key={idx} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <button
              onClick={() => setExpandedBatch(isExpanded ? null : idx)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors duration-200"
            >
              <span className="text-[10px] font-bold text-zinc-600 tabular-nums w-8">#{idx + 1}</span>
              <span className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                batch.model.startsWith('Claude')
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
              )}>
                {batch.model}
              </span>
              <span className="text-[10px] text-zinc-500">{batch.persona_count} personas</span>
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-[9px] tabular-nums">
                <span className="text-emerald-400">{pos}+</span>
                <span className="text-rose-400">{neg}-</span>
                <span className="text-amber-400">{neu}~</span>
              </div>
              {isExpanded ? <ChevronDown size={12} className="text-zinc-600" /> : <ChevronRight size={12} className="text-zinc-600" />}
            </button>
            {isExpanded && (
              <div className="border-t border-white/[0.04] max-h-64 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-zinc-600 font-semibold uppercase tracking-wider border-b border-white/[0.04]">
                      <th className="text-left px-3 py-2 w-36">Persona</th>
                      <th className="text-left px-3 py-2 w-12">UF</th>
                      <th className="text-left px-3 py-2 w-10">Age</th>
                      <th className="text-center px-3 py-2 w-16">Sent.</th>
                      <th className="text-left px-3 py-2">Resposta da Persona</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.personas_summary.map((p, pi) => (
                      <tr key={pi} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                        <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[144px]">{p.name}</td>
                        <td className="px-3 py-1.5 text-zinc-500">{p.state}</td>
                        <td className="px-3 py-1.5 text-zinc-500 tabular-nums">{p.age}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={cn(
                            'inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                            p.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                            p.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-amber-500/10 text-amber-400',
                          )}>
                            {p.sentiment === 'positive' ? '+' : p.sentiment === 'negative' ? '-' : '~'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-zinc-400 max-w-xs">
                          <span className="line-clamp-2">{p.comment}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   Progress Stats
   ================================================================ */

function ProgressStats({ progress, startTime, endTime }: {
  progress: PipelineState['progress'];
  startTime: number | null;
  endTime: number | null;
}) {
  const elapsed = startTime ? ((endTime || Date.now()) - startTime) / 1000 : 0;
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const rate = elapsed > 0 && progress.processed > 0 ? Math.round(progress.processed / elapsed) : 0;

  return (
    <div className="grid grid-cols-5 gap-2 px-4 py-3">
      {[
        { label: 'Personas', value: `${progress.processed.toLocaleString('pt-BR')}/${progress.total.toLocaleString('pt-BR')}`, color: 'text-white' },
        { label: 'Progresso', value: `${pct}%`, color: 'text-violet-400' },
        { label: 'A Favor', value: progress.positive.toLocaleString('pt-BR'), color: 'text-emerald-400' },
        { label: 'Contra', value: progress.negative.toLocaleString('pt-BR'), color: 'text-rose-400' },
        { label: 'Velocidade', value: `${rate}/s`, color: 'text-sky-400' },
      ].map(s => (
        <div key={s.label} className="text-center">
          <p className={cn('text-sm font-bold tabular-nums', s.color)}>{s.value}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   Main Component
   ================================================================ */

export function ArenaMonitor() {
  const [question, setQuestion] = useState('');
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<PipelineState>({ ...initialState });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'logs' | 'batches'>('logs');
  const abortRef = useRef<AbortController | null>(null);
  const logIdRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tick, setTick] = useState(0);

  // Timer for elapsed display
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

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

  /* ── Handle Submit ─────────────────────────────────────────── */
  const handleSubmit = useCallback(async () => {
    const q = question.trim();
    if (!q || running) return;

    // Reset
    setState({ ...initialState, startTime: Date.now() });
    setRunning(true);
    setSelectedNode(null);
    logIdRef.current = 0;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    addLog('system', 'info', `Pipeline iniciado para: "${q}"`);

    // ── Step 1: Classify Route ──────────────────────────────
    updateNode('classifier', 'running');
    addLog('classifier', 'info', 'Enviando pergunta para GPT-4o-mini decidir caminho...');
    addLog('classifier', 'debug', 'GPT analisa se existem colunas no banco que respondem a pergunta ou se precisa IA generativa');

    let route = 'python';
    let classifierResult: ClassifierDecision | null = null;

    try {
      const res = await fetch('/api/arena/classify-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        route = data.route || 'python';
        classifierResult = {
          route: data.route || 'python',
          fields: data.fields || [],
          reason: data.reason || 'sem razao informada',
        };

        updateNode('classifier', 'complete');
        addLog('classifier', 'info',
          route === 'python'
            ? `➜ PYTHON IA — Motivo: ${classifierResult.reason}`
            : `➜ BANCO LOCAL — Motivo: ${classifierResult.reason}`,
          {
            rota: classifierResult.route,
            campos_banco: classifierResult.fields,
            motivo: classifierResult.reason,
          },
        );

        if (classifierResult.fields.length > 0) {
          addLog('classifier', 'info',
            `Colunas encontradas no banco: ${classifierResult.fields.join(', ')}`,
            { colunas: classifierResult.fields },
          );
        } else if (route === 'python') {
          addLog('classifier', 'info', 'Nenhuma coluna no banco responde essa pergunta — precisa de IA generativa');
        }

        setState(prev => ({
          ...prev,
          route: route as 'local' | 'python',
          classifierDecision: classifierResult,
        }));
      } else {
        updateNode('classifier', 'error');
        addLog('classifier', 'error', `HTTP ${res.status} — fallback para Python`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      updateNode('classifier', 'error');
      addLog('classifier', 'error', `Erro: ${err?.message} — fallback para Python`);
    }

    // ── Local Route ─────────────────────────────────────────
    if (route === 'local') {
      addLog('system', 'info', '🗃️ CAMINHO: BANCO DE DADOS LOCAL');
      addLog('system', 'info', `A pergunta pode ser respondida com colunas existentes: ${classifierResult?.fields.join(', ') || 'colunas gerais'}`);
      addLog('system', 'info', `Motivo da decisao: ${classifierResult?.reason || '?'}`);
      addLog('system', 'info', 'Nao precisa de IA generativa — cada persona ja tem respostas pre-gravadas para esses temas');

      // Nodes pulados
      updateNode('queryAnalyzer', 'skipped');
      addLog('queryAnalyzer', 'debug', 'Pulado — nao vai para Python, nao precisa analisar query');
      updateNode('webResearch', 'skipped');
      addLog('webResearch', 'debug', 'Pulado — tema generico, nao precisa pesquisa web');
      updateNode('contextBuilder', 'skipped');
      addLog('contextBuilder', 'debug', 'Pulado — sem pesquisa web, nao tem contexto para construir');
      updateNode('contextValidator', 'skipped');
      addLog('contextValidator', 'debug', 'Pulado — sem contexto para validar');

      // Carregamento
      updateNode('personaLoader', 'running');
      addLog('personaLoader', 'info', 'Carregando 20.000 personas do cache do navegador...');
      await new Promise(r => setTimeout(r, 500));
      updateNode('personaLoader', 'complete');
      addLog('personaLoader', 'info', 'Personas carregadas com sucesso');

      // Processamento local
      updateNode('personaLoop', 'running');
      addLog('personaLoop', 'info', `Lendo respostas de cada persona nas colunas: ${classifierResult?.fields.join(', ') || '?'}`);
      addLog('personaLoop', 'info', 'Cada persona tem respostas sim/nao ou escala (1-10) para esses temas');
      addLog('personaLoop', 'info', 'O sentimento (a favor/contra/neutro) e calculado a partir dessas respostas');
      await new Promise(r => setTimeout(r, 400));
      updateNode('personaLoop', 'complete');
      addLog('personaLoop', 'info', 'Todas as personas processadas via banco — sem chamada de IA');

      // Agregacao
      updateNode('aggregator', 'running');
      addLog('aggregator', 'info', 'Agregando sentimentos por regiao, geracao, classe social, religiao...');
      await new Promise(r => setTimeout(r, 300));
      updateNode('aggregator', 'complete');
      addLog('aggregator', 'info', 'Resultados agregados — gerando visualizacoes');

      addLog('system', 'info', '✅ Pipeline LOCAL concluido — processamento instantaneo via banco de dados');
      setState(prev => ({ ...prev, endTime: Date.now() }));
      setRunning(false);
      return;
    }

    // ── Python Route ────────────────────────────────────────
    setState(prev => ({ ...prev, route: 'python' }));
    addLog('system', 'info', '🐍 CAMINHO: PYTHON IA (Digital Ocean)');
    addLog('system', 'info', 'A pergunta precisa de IA generativa — nao tem colunas no banco que respondam');
    addLog('system', 'info', 'Conectando ao backend Python na Digital Ocean...');
    updateNode('queryAnalyzer', 'running');

    try {
      const response = await fetch('/api/arena/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Backend indisponivel (status=${response.status})`);
      }

      addLog('system', 'info', '✅ Conexao estabelecida com backend Python');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Process SSE event inline to access all state updaters
      const processEvent = (payload: { type: string; data: any }) => {
        switch (payload.type) {
          case 'route':
            addLog('system', 'debug', `Backend Python confirmou processamento via: ${payload.data.route}`);
            break;

          case 'phase': {
            const phase = payload.data?.phase;
            const msg = payload.data?.message || `Phase: ${phase}`;
            const map: Record<string, { node: string; completeNodes?: string[] }> = {
              analyzing_query: { node: 'queryAnalyzer' },
              web_research: { node: 'webResearch', completeNodes: ['queryAnalyzer'] },
              building_context: { node: 'contextBuilder', completeNodes: ['webResearch'] },
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

            // Auto-update node status from log content
            if (d.step === 'query_analyzer' && d.detail?.needs_research !== undefined) {
              updateNode('queryAnalyzer', 'complete');
              if (!d.detail.needs_research) {
                updateNode('webResearch', 'skipped');
                addLog('webResearch', 'debug', 'Pulado — Claude decidiu que nao precisa pesquisar na web');
                updateNode('contextBuilder', 'skipped');
                addLog('contextBuilder', 'debug', 'Pulado — sem dados da web para construir contexto');
                updateNode('contextValidator', 'skipped');
                addLog('contextValidator', 'debug', 'Pulado — sem contexto para validar');
              }
            }
            if (d.step === 'context_builder') {
              updateNode('contextBuilder', 'complete');
            }
            if (d.step === 'context_validator') {
              updateNode('contextValidator', 'complete');
            }
            break;
          }

          case 'web_complete':
            updateNode('webResearch', 'complete');
            addLog('webResearch', 'info',
              `Pesquisa concluida: ${payload.data.snippets_count} trechos de ${payload.data.sources_count} fontes`,
              payload.data,
            );
            break;

          case 'personas_loaded':
            updateNode('personaLoader', 'complete');
            addLog('personaLoader', 'info', `${payload.data.count?.toLocaleString('pt-BR')} personas carregadas do banco`);
            setState(prev => ({
              ...prev,
              progress: { ...prev.progress, total: payload.data.count },
            }));
            break;

          case 'progress':
            setState(prev => ({
              ...prev,
              progress: {
                processed: payload.data.processed,
                total: payload.data.total,
                positive: payload.data.positive,
                negative: payload.data.negative,
                neutral: payload.data.neutral,
              },
            }));
            break;

          case 'batch_detail':
            setState(prev => ({
              ...prev,
              batches: [...prev.batches, payload.data],
            }));
            addLog('personaLoop', 'debug',
              `Lote ${payload.data.model}: ${payload.data.persona_count} personas → ${payload.data.personas_summary?.filter((p: any) => p.sentiment === 'positive').length} a favor, ${payload.data.personas_summary?.filter((p: any) => p.sentiment === 'negative').length} contra, ${payload.data.personas_summary?.filter((p: any) => p.sentiment === 'neutral').length} neutros`,
            );
            break;

          case 'results':
            updateNode('aggregator', 'complete');
            updateNode('personaLoop', 'complete');
            addLog('aggregator', 'info', `Resultados agregados: ${payload.data.total} personas | A favor: ${payload.data.positive} | Contra: ${payload.data.negative} | Neutros: ${payload.data.neutral}`, {
              total: payload.data.total,
              a_favor: payload.data.positive,
              contra: payload.data.negative,
              neutros: payload.data.neutral,
              comentarios: payload.data.comments?.length || 0,
            });
            break;

          case 'done':
            addLog('system', 'info',
              `✅ Pipeline PYTHON finalizado em ${(payload.data.processing_time_ms / 1000).toFixed(1)}s — ${payload.data.total_personas?.toLocaleString('pt-BR')} personas analisadas`,
              payload.data,
            );
            setState(prev => {
              const updated = { ...prev.nodes };
              for (const key of Object.keys(updated)) {
                if (updated[key] === 'running') updated[key] = 'complete';
              }
              return { ...prev, nodes: updated };
            });
            break;

          default:
            addLog('system', 'debug', `Evento: ${payload.type}`, payload.data);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const c of chunks) {
          const line = c.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            processEvent(JSON.parse(line.slice(6)));
          } catch {
            // skip
          }
        }
      }

      addLog('system', 'info', 'Stream SSE encerrado');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        addLog('system', 'warn', 'Pipeline cancelado');
        return;
      }
      addLog('system', 'error', `Erro na conexao: ${err?.message}`);
    }

    setState(prev => ({ ...prev, endTime: Date.now() }));
    setRunning(false);
  }, [question, running, addLog, updateNode]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    addLog('system', 'warn', 'Pipeline cancelado pelo usuario');
    setState(prev => ({ ...prev, endTime: Date.now() }));
  }, [addLog]);

  const elapsed = state.startTime
    ? (((state.endTime || Date.now()) - state.startTime) / 1000).toFixed(0)
    : '0';

  // Count logs per node
  const logCountFor = (key: string) => {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    return state.logs.filter(l => l.step === key || l.step === snakeKey || l.step.includes(snakeKey)).length;
  };
  const lastLogFor = (key: string) => {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    const matching = state.logs.filter(l => l.step === key || l.step === snakeKey || l.step.includes(snakeKey));
    return matching[matching.length - 1]?.message;
  };

  const nodeOrder = ['classifier', 'queryAnalyzer', 'webResearch', 'contextBuilder', 'contextValidator', 'personaLoader', 'personaLoop', 'aggregator'];

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* ─── Header ─── */}
      <div className="shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/15 border border-violet-500/20 flex items-center justify-center">
              <Cpu size={16} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Monitor da Arena</h1>
              <p className="text-[10px] text-zinc-600">Fluxo de analise em tempo real</p>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-2 max-w-2xl">
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Digite uma pergunta para monitorar o fluxo..."
              disabled={running}
              className="flex-1 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-violet-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-violet-500/20 transition-all duration-200 disabled:opacity-50"
            />
            {running ? (
              <button
                onClick={handleStop}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-semibold text-sm active:scale-[0.97] transition-all duration-200"
              >
                <Square size={14} /> Parar
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!question.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-400 text-black font-semibold text-sm rounded-xl shadow-lg shadow-violet-500/25 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={14} /> Executar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            {state.route !== 'unknown' && (
              <span className={cn(
                'px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border',
                state.route === 'python'
                  ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/20',
              )}>
                {state.route === 'python' ? 'Python IA' : 'Banco Local'}
              </span>
            )}
            {state.startTime && (
              <span className="text-zinc-500 tabular-nums font-mono">{elapsed}s</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main ─── */}
      <div className="flex-1 flex min-h-0">
        {/* ─── Left: Flow ─── */}
        <div className="w-72 shrink-0 border-r border-white/[0.06] bg-zinc-950/40 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 px-2 mb-3">Fluxo do Pipeline</p>

          {nodeOrder.map((key, i) => (
            <div key={key}>
              <FlowNode
                nodeKey={key}
                status={state.nodes[key]}
                logCount={logCountFor(key)}
                lastLogMessage={lastLogFor(key)}
                isSelected={selectedNode === key}
                onClick={() => setSelectedNode(selectedNode === key ? null : key)}
                extra={key === 'personaLoop' && state.progress.total > 0 ? (
                  <div className="mt-2.5">
                    <div className="h-1.5 rounded-full bg-zinc-900/80 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.round((state.progress.processed / state.progress.total) * 100)}%`,
                          background: 'linear-gradient(90deg, rgb(139,92,246), rgb(236,72,153))',
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-1 tabular-nums">
                      {state.progress.processed.toLocaleString('pt-BR')}/{state.progress.total.toLocaleString('pt-BR')}
                    </p>
                  </div>
                ) : undefined}
              />
              {i < nodeOrder.length - 1 && (
                <FlowArrow active={state.nodes[key] === 'complete' || state.nodes[key] === 'running'} />
              )}
            </div>
          ))}

          {/* Classifier Decision Card */}
          {state.classifierDecision && (
            <ClassifierCard decision={state.classifierDecision} />
          )}
        </div>

        {/* ─── Right ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Progress Stats */}
          {state.progress.total > 0 && (
            <div className="shrink-0 border-b border-white/[0.06]">
              <ProgressStats progress={state.progress} startTime={state.startTime} endTime={state.endTime} />
            </div>
          )}

          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/[0.04]">
            {(['logs', 'batches'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setBottomTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200',
                  bottomTab === tab
                    ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                    : 'text-zinc-600 hover:text-zinc-400 border border-transparent',
                )}
              >
                {tab === 'logs' ? `Logs (${state.logs.length})` : `Lotes (${state.batches.length})`}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {bottomTab === 'logs' ? (
              <LogPanel logs={state.logs} selectedNode={selectedNode} />
            ) : (
              <BatchInspector batches={state.batches} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
