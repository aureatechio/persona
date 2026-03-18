'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Brain, Globe, ShieldCheck, Users,
  Cpu, BarChart3, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle2, Loader2,
  MessageSquare, ArrowDown, Minus, Radio,
  ExternalLink, FileText, Eye, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AllSegments, SegmentItem } from '@/lib/arena/segments';
import type { ArenaLiveData } from '@/components/blocks/ArenaLiveBlock';
import { scoreToEmoji, scoreToLabel, scoreToColor } from '@/lib/arena/types';

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
    score?: number;
  }>;
}

interface ContextExtractionData {
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
interface QueryAnalyzerData {
  needs_research: boolean;
  reason: string;
}

interface WebResearchData {
  queries: string[];
  snippets: string[];
  sources: string[];
}

interface ContextData {
  tema: string;
  contexto: string;
  figuras: Array<Record<string, unknown>>;
  periodo: string;
}

interface ValidatorData {
  verdict: string;
  issues: string[];
  corrections: string;
  fullContext?: string;
  figuras?: Array<Record<string, unknown>>;
}

interface PromptSampleData {
  system_prompt: string;
  user_prompt: string;
  persona_count: number;
  note: string;
}

interface StepDetails {
  queryAnalyzer: QueryAnalyzerData | null;
  webResearch: WebResearchData | null;
  context: ContextData | null;
  validator: ValidatorData | null;
  promptSample: PromptSampleData | null;
  ideologicalFrame: string | null;
}

interface PipelineState {
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

const initialStepDetails: StepDetails = {
  queryAnalyzer: null,
  webResearch: null,
  context: null,
  validator: null,
  promptSample: null,
  ideologicalFrame: null,
};

const initialState: PipelineState = {
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

const MONITOR_CHANNEL = 'arena-monitor';

/* ================================================================
   Node Config
   ================================================================ */

const NODE_ICONS: Record<string, React.ReactNode> = {
  contextExtraction: <FileText size={16} />,
  queryAnalyzer: <Search size={16} />,
  webResearch: <Globe size={16} />,
  contextBuilder: <Brain size={16} />,
  contextValidator: <ShieldCheck size={16} />,
  personaLoader: <Users size={16} />,
  personaLoop: <Cpu size={16} />,
  aggregator: <BarChart3 size={16} />,
};

const NODE_LABELS: Record<string, string> = {
  contextExtraction: 'Extracao de Contexto',
  queryAnalyzer: 'Analise da Pergunta',
  webResearch: 'Pesquisa na Web',
  contextBuilder: 'Construcao de Contexto',
  contextValidator: 'Validacao de Contexto',
  personaLoader: 'Carregamento de Personas',
  personaLoop: 'Processamento de Personas',
  aggregator: 'Agregacao de Resultados',
};

const NODE_DESCRIPTIONS: Record<string, string> = {
  contextExtraction: 'Transcricao e contexto extraidos da midia',
  queryAnalyzer: 'Claude Sonnet 4 decide se precisa pesquisa web',
  webResearch: 'Tavily busca 3 queries na web em paralelo',
  contextBuilder: 'Claude Sonnet 4 cria contexto factual neutro',
  contextValidator: 'Claude Sonnet 4 valida precisao e neutralidade',
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
  hasDetail,
  extra,
}: {
  nodeKey: string;
  status: NodeStatus;
  logCount: number;
  lastLogMessage?: string;
  isSelected: boolean;
  onClick: () => void;
  hasDetail?: boolean;
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
            {hasDetail && (
              <Eye size={10} className="text-violet-400" />
            )}
          </div>
          <p className="text-[9px] text-zinc-600 mt-0.5 truncate">
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
   Context Extraction Panel
   ================================================================ */

function ContextExtractionPanel({ data }: { data: ContextExtractionData }) {
  const [expanded, setExpanded] = useState(false);
  const transcriptPreview = data.rawTranscript
    ? (data.rawTranscript.length > 500 && !expanded
        ? data.rawTranscript.slice(0, 500) + '...'
        : data.rawTranscript)
    : null;

  return (
    <div className="space-y-4">
      <SectionHeader icon={<FileText size={14} />} title="Extracao de Contexto" subtitle="Conteudo extraido da midia enviada" />

      {/* Title / Author */}
      {(data.title || data.author) && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          {data.title && (
            <p className="text-sm font-semibold text-white">{data.title}</p>
          )}
          {data.author && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{data.author}</p>
          )}
        </div>
      )}

      {/* Core Point */}
      {data.corePoint && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-400 mb-1.5">Ponto Central</p>
          <p className="text-[12px] text-zinc-200 leading-relaxed font-medium">{data.corePoint}</p>
        </div>
      )}

      {/* Political Figures */}
      {data.politicalFigures && data.politicalFigures.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400 mb-2.5">Figuras Politicas</p>
          <div className="space-y-2">
            {data.politicalFigures.map((fig, i) => {
              const alignColor: Record<string, string> = {
                'direita': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
                'centro-direita': 'bg-sky-500/15 text-sky-400 border-sky-500/20',
                'centro': 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20',
                'centro-esquerda': 'bg-orange-500/15 text-orange-400 border-orange-500/20',
                'esquerda': 'bg-red-500/15 text-red-400 border-red-500/20',
              };
              const colorClass = alignColor[fig.alinhamento] || alignColor['centro'];
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-[11px] text-white font-medium min-w-0">{fig.nome}</span>
                  <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-medium shrink-0', colorClass)}>
                    {fig.alinhamento}
                  </span>
                  <span className="text-[9px] text-zinc-600 shrink-0">
                    {fig.posicao_autor === 'a favor' ? 'autor a favor' : fig.posicao_autor === 'contra' ? 'autor contra' : 'neutro'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generated Question */}
      {data.generatedQuestion && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 mb-1.5">Pergunta Gerada</p>
          <p className="text-[12px] text-zinc-200 leading-relaxed">{data.generatedQuestion}</p>
        </div>
      )}

      {/* Raw Transcript */}
      {transcriptPreview && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Transcricao Completa</p>
            <span className="text-[9px] text-zinc-600 font-mono">{data.rawTranscript!.length.toLocaleString('pt-BR')} chars</span>
          </div>
          <pre className="text-[10px] text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
            {transcriptPreview}
          </pre>
          {data.rawTranscript && data.rawTranscript.length > 500 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-[10px] text-violet-400 hover:text-violet-300 transition-colors duration-200"
            >
              {expanded ? 'Recolher' : 'Expandir transcricao completa'}
            </button>
          )}
        </div>
      )}

      {/* Claude Summary (for comparison) */}
      {data.claudeSummary && (
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400/70 mb-1.5">Resumo Claude (referencia)</p>
          <p className="text-[10px] text-zinc-400 leading-relaxed">{data.claudeSummary}</p>
        </div>
      )}
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
   Step Detail Panels — Rich visualization per step
   ================================================================ */

function QueryAnalyzerPanel({ data }: { data: QueryAnalyzerData }) {
  return (
    <div className="space-y-3">
      <SectionHeader icon={<Search size={14} />} title="Analise da Pergunta" subtitle="Claude Haiku analisou a pergunta" />
      <div className={cn(
        'rounded-xl border p-4',
        data.needs_research
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-amber-500/5 border-amber-500/20',
      )}>
        <div className="flex items-center gap-2 mb-2">
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
            data.needs_research
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400',
          )}>
            {data.needs_research ? 'Pesquisa Necessaria' : 'Pesquisa Dispensada'}
          </span>
        </div>
        <p className="text-[11px] text-zinc-300 leading-relaxed">{data.reason}</p>
      </div>
    </div>
  );
}

function WebResearchPanel({ data }: { data: WebResearchData }) {
  return (
    <div className="space-y-3">
      <SectionHeader icon={<Globe size={14} />} title="Pesquisa na Web" subtitle={`${data.snippets?.length || 0} trechos de ${data.sources?.length || 0} fontes`} />

      {/* Queries searched */}
      {data.queries?.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Queries pesquisadas</p>
          <div className="space-y-1.5">
            {data.queries.map((q, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <Search size={10} className="text-sky-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-300">{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {data.sources?.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Fontes encontradas</p>
          <div className="space-y-1">
            {data.sources.map((src, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <ExternalLink size={9} className="text-violet-400 shrink-0" />
                <span className="text-[10px] text-sky-400 truncate">{src}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Snippets */}
      {data.snippets?.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Trechos coletados</p>
          <div className="space-y-2">
            {data.snippets.map((snip, i) => (
              <div key={i} className="px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText size={9} className="text-zinc-600" />
                  <span className="text-[9px] text-zinc-600 font-bold">Trecho #{i + 1}</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{snip}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContextPanel({ data }: { data: ContextData }) {
  return (
    <div className="space-y-3">
      <SectionHeader icon={<Brain size={14} />} title="Contexto Gerado" subtitle="Claude Sonnet 4 construiu este contexto" />

      {data.tema && (
        <div className="px-3 py-2.5 rounded-xl bg-violet-500/5 border border-violet-500/20">
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-400/60 mb-1">Tema</p>
          <p className="text-[12px] text-violet-300 font-medium">{data.tema}</p>
        </div>
      )}

      {data.periodo && (
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">Periodo</p>
          <p className="text-[11px] text-zinc-400">{data.periodo}</p>
        </div>
      )}

      {data.contexto && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Texto de contexto enviado as personas</p>
          <div className="px-4 py-3 rounded-xl bg-zinc-900/60 border border-white/[0.04] max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
            <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{data.contexto}</p>
          </div>
        </div>
      )}

      {data.figuras && data.figuras.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Figuras publicas mencionadas</p>
          <div className="flex flex-wrap gap-1.5">
            {data.figuras.map((fig, i) => (
              <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {typeof fig === 'string' ? fig : JSON.stringify(fig)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ValidatorPanel({ data }: { data: ValidatorData }) {
  const isValid = data.verdict?.toUpperCase() === 'PASS' || data.verdict?.toUpperCase() === 'VALID';
  const [showFullContext, setShowFullContext] = useState(false);

  return (
    <div className="space-y-3">
      <SectionHeader icon={<ShieldCheck size={14} />} title="Validacao de Contexto" subtitle="Contexto final que sera enviado as personas" />

      <div className={cn(
        'rounded-xl border p-4',
        isValid
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-amber-500/5 border-amber-500/20',
      )}>
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full',
          isValid
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-amber-500/15 text-amber-400',
        )}>
          {isValid ? 'Contexto Valido' : 'Contexto Revisado'}
        </span>
      </div>

      {data.issues && data.issues.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Problemas encontrados</p>
          <div className="space-y-1.5">
            {data.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <AlertCircle size={10} className="text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[10px] text-amber-300">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.corrections && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Correcoes aplicadas</p>
          <div className="px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.04]">
            <p className="text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{data.corrections}</p>
          </div>
        </div>
      )}

      {/* Figuras politicas detectadas */}
      {data.figuras && data.figuras.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">Figuras politicas no contexto</p>
          <div className="flex flex-wrap gap-1.5">
            {data.figuras.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-300 font-medium">
                {(f.nome as string) || '?'}
                {f.cargo ? <span className="text-violet-500">({String(f.cargo)})</span> : null}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contexto completo enviado as personas */}
      {data.fullContext && (
        <div>
          <button
            onClick={() => setShowFullContext(!showFullContext)}
            className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors duration-200 mb-2 px-1"
          >
            {showFullContext ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Contexto completo enviado ({data.fullContext.length.toLocaleString('pt-BR')} chars)
          </button>
          {showFullContext && (
            <div className="px-4 py-3 rounded-xl bg-zinc-900/60 border border-white/[0.04] max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
              <pre className="text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{data.fullContext}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PromptSamplePanel({ data }: { data: PromptSampleData }) {
  const [showSystem, setShowSystem] = useState(false);

  return (
    <div className="space-y-3">
      <SectionHeader icon={<FileText size={14} />} title="Prompt Enviado as Personas" subtitle={`Amostra do 1o batch — ${data.persona_count} personas`} />

      <div className="px-3 py-2 rounded-lg bg-sky-500/5 border border-sky-500/15">
        <p className="text-[9px] text-sky-400/80">{data.note}</p>
      </div>

      {/* System Prompt (collapsible) */}
      <div>
        <button
          onClick={() => setShowSystem(!showSystem)}
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors duration-200 mb-2 px-1"
        >
          {showSystem ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          System Prompt (instrucoes da IA)
        </button>
        {showSystem && (
          <div className="px-4 py-3 rounded-xl bg-zinc-900/60 border border-white/[0.04] max-h-60 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
            <pre className="text-[10px] text-zinc-500 leading-relaxed whitespace-pre-wrap font-mono">{data.system_prompt}</pre>
          </div>
        )}
      </div>

      {/* User Prompt (full — this is what matters) */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-2 px-1">User Prompt (contexto + perfis das personas)</p>
        <div className="px-4 py-3 rounded-xl bg-zinc-900/60 border border-white/[0.04] max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
          <pre className="text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{data.user_prompt}</pre>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.04]">
      <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-white">{title}</p>
        <p className="text-[9px] text-zinc-600">{subtitle}</p>
      </div>
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
        const snakeKey = selectedNode.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        return l.step === selectedNode || l.step === snakeKey || l.step.includes(snakeKey);
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
            <div className="w-14 h-14 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-4">
              <Radio size={24} className="text-zinc-700" />
            </div>
            <p className="text-sm font-semibold text-zinc-500">Aguardando atividade...</p>
            <p className="text-[11px] text-zinc-700 mt-2 max-w-xs leading-relaxed">
              Abra a tela principal em outra aba e faca uma pergunta na Arena.
              Os logs aparecerao aqui automaticamente em tempo real.
            </p>
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
        <p className="text-[9px] text-zinc-700 mt-1">Os lotes aparecem quando o Python processa personas</p>
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
        const scoresInBatch = batch.personas_summary.filter(p => typeof p.score === 'number').map(p => p.score!);
        const batchAvgScore = scoresInBatch.length > 0 ? scoresInBatch.reduce((a, b) => a + b, 0) / scoresInBatch.length : 0;

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
              {batchAvgScore > 0 && (
                <span className={cn('text-[10px] font-bold tabular-nums', scoreToColor(batchAvgScore))}>
                  {scoreToEmoji(batchAvgScore)} {batchAvgScore.toFixed(1)}
                </span>
              )}
              <div className="flex items-center gap-2 text-[9px] tabular-nums">
                <span className="text-emerald-400">{pos}+</span>
                <span className="text-rose-400">{neg}-</span>
                <span className="text-amber-400">{neu}~</span>
              </div>
              {isExpanded ? <ChevronDown size={12} className="text-zinc-600" /> : <ChevronRight size={12} className="text-zinc-600" />}
            </button>
            {isExpanded && (
              <div className="border-t border-white/[0.04] max-h-80 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-zinc-600 font-semibold uppercase tracking-wider border-b border-white/[0.04] sticky top-0 bg-zinc-950/95 backdrop-blur-sm">
                      <th className="text-left px-3 py-2 w-36">Persona</th>
                      <th className="text-left px-3 py-2 w-12">UF</th>
                      <th className="text-left px-3 py-2 w-10">Idade</th>
                      <th className="text-center px-3 py-2 w-16">Score</th>
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
                          {typeof p.score === 'number' ? (
                            <span className={cn('text-[10px] font-bold tabular-nums', scoreToColor(p.score))}>
                              {scoreToEmoji(p.score)} {p.score.toFixed(1)}
                            </span>
                          ) : (
                            <span className={cn(
                              'inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                              p.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                              p.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-400' :
                              'bg-amber-500/10 text-amber-400',
                            )}>
                              {p.sentiment === 'positive' ? 'A favor' : p.sentiment === 'negative' ? 'Contra' : 'Neutro'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-zinc-400 max-w-xs">
                          <span className="line-clamp-3">{p.comment}</span>
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
   Segments Panel
   ================================================================ */

const SEGMENT_LABELS: Record<string, string> = {
  gender: 'Gênero', religion: 'Religião', race: 'Raça/Cor', region: 'Região',
  generation: 'Geração', socialClass: 'Classe Social', education: 'Escolaridade',
  politicalLeaning: 'Posição Política', voto2022: 'Voto 2022', aprovacaoLula: 'Aprovação Lula',
  voto2026: 'Voto 2026', archetype: 'Arquétipo', clusterMacro: 'Cluster Macro',
  scoreEco: 'Eixo Econômico', scoreCost: 'Eixo Costumes',
};

function SegmentsPanel({ segments }: { segments: AllSegments | null }) {
  if (!segments) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-12 h-12 rounded-xl bg-zinc-900/50 flex items-center justify-center mb-3">
          <Layers size={20} className="text-zinc-700" />
        </div>
        <p className="text-[11px] text-zinc-600">Nenhum segmento disponível</p>
        <p className="text-[9px] text-zinc-700 mt-1">Os segmentos aparecem durante o processamento</p>
      </div>
    );
  }

  const categories = Object.entries(segments).filter(
    ([, items]) => items && items.length > 0,
  ) as [string, SegmentItem[]][];

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-12 h-12 rounded-xl bg-zinc-900/50 flex items-center justify-center mb-3">
          <Layers size={20} className="text-zinc-700" />
        </div>
        <p className="text-[11px] text-zinc-600">Segmentos vazios</p>
      </div>
    );
  }

  const maxCount = Math.max(...categories.flatMap(([, items]) => items.map(i => i.count)));

  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
      {categories.map(([key, items]) => (
        <div key={key}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
            {SEGMENT_LABELS[key] || key}
          </p>
          <div className="space-y-1">
            {items.map(item => (
              <div key={item.label} className="flex items-center gap-2 group">
                <span className="text-[10px] text-zinc-400 w-28 truncate shrink-0">{item.label}</span>
                <span className="text-[9px] text-zinc-600 w-8 text-right tabular-nums shrink-0">{item.count}</span>
                <div className="flex-1 h-3 bg-zinc-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${maxCount > 0 ? (item.count / maxCount) * 100 : 0}%`,
                      background: item.avgScore <= 2 ? '#fb7185' : item.avgScore <= 4 ? '#fb923c' : item.avgScore <= 6 ? '#fbbf24' : item.avgScore <= 8 ? '#34d399' : '#6ee7b7',
                    }}
                  />
                </div>
                <span className={cn('text-[10px] font-bold tabular-nums w-14 text-right shrink-0', scoreToColor(item.avgScore))}>
                  {scoreToEmoji(item.avgScore)} {item.avgScore.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   Progress Stats
   ================================================================ */

function ProgressStats({ progress, startTime, endTime, avgScore }: {
  progress: PipelineState['progress'];
  startTime: number | null;
  endTime: number | null;
  avgScore: number;
}) {
  const elapsed = startTime ? ((endTime || Date.now()) - startTime) / 1000 : 0;
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const rate = elapsed > 0 && progress.processed > 0 ? Math.round(progress.processed / elapsed) : 0;

  const stats = [
    { label: 'Personas', value: `${progress.processed.toLocaleString('pt-BR')}/${progress.total.toLocaleString('pt-BR')}`, color: 'text-white' },
    { label: 'Progresso', value: `${pct}%`, color: 'text-violet-400' },
    ...(avgScore > 0
      ? [{ label: scoreToLabel(avgScore), value: `${scoreToEmoji(avgScore)} ${avgScore.toFixed(1)}`, color: scoreToColor(avgScore) }]
      : []),
    { label: 'Velocidade', value: `${rate}/s`, color: 'text-sky-400' },
  ];

  return (
    <div className={cn('grid gap-2 px-4 py-3', `grid-cols-${stats.length}`)}>
      {stats.map(s => (
        <div key={s.label} className="text-center">
          <p className={cn('text-sm font-bold tabular-nums', s.color)}>{s.value}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   Step Detail View — shown in the right panel when a node is selected
   ================================================================ */

function StepDetailView({ nodeKey, stepDetails, contextExtraction, batches, nodeStatus, progress }: {
  nodeKey: string;
  stepDetails: StepDetails;
  contextExtraction: ContextExtractionData | null;
  batches: BatchDetail[];
  nodeStatus: NodeStatus;
  progress: { processed: number; total: number; positive: number; negative: number; neutral: number };
}) {
  // Skipped steps — show informative message
  if (nodeStatus === 'skipped') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-3">
          <Minus size={20} className="text-zinc-700" />
        </div>
        <p className="text-[11px] text-zinc-500 font-medium">{NODE_LABELS[nodeKey]}</p>
        <p className="text-[9px] text-zinc-700 mt-1.5 max-w-xs leading-relaxed">
          Step pulado — o worker simplificado processa personas diretamente com GPT sem esta etapa intermediaria.
        </p>
      </div>
    );
  }

  // PersonaLoader — show count
  if (nodeKey === 'personaLoader' && progress.total > 0) {
    return (
      <div className="p-4">
        <SectionHeader icon={<Users size={14} />} title="Carregamento de Personas" subtitle="Personas carregadas do banco de dados" />
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Users size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{progress.total.toLocaleString('pt-BR')}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">personas carregadas e prontas para processamento</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (nodeKey === 'contextExtraction' && contextExtraction) {
    return (
      <div className="p-4">
        <ContextExtractionPanel data={contextExtraction} />
      </div>
    );
  }

  if (nodeKey === 'queryAnalyzer' && stepDetails.queryAnalyzer) {
    return (
      <div className="p-4">
        <QueryAnalyzerPanel data={stepDetails.queryAnalyzer} />
      </div>
    );
  }

  if (nodeKey === 'webResearch' && stepDetails.webResearch) {
    return (
      <div className="p-4">
        <WebResearchPanel data={stepDetails.webResearch} />
      </div>
    );
  }

  if (nodeKey === 'contextBuilder' && stepDetails.context) {
    return (
      <div className="p-4">
        <ContextPanel data={stepDetails.context} />
      </div>
    );
  }

  if (nodeKey === 'contextValidator') {
    return (
      <div className="p-4 space-y-4">
        {stepDetails.context && <ContextPanel data={stepDetails.context} />}
        {stepDetails.validator && <ValidatorPanel data={stepDetails.validator} />}
        {stepDetails.ideologicalFrame && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Vies Ideologico</span>
            </div>
            <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono">
              {stepDetails.ideologicalFrame}
            </pre>
          </div>
        )}
        {!stepDetails.context && !stepDetails.validator && !stepDetails.ideologicalFrame && (
          <p className="text-[10px] text-zinc-600 text-center py-4">Aguardando validacao...</p>
        )}
      </div>
    );
  }

  if (nodeKey === 'personaLoop') {
    const hasPrompt = stepDetails.promptSample !== null;
    const hasBatches = batches.length > 0;
    if (!hasPrompt && !hasBatches) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-3">
            <Cpu size={20} className="text-zinc-700" />
          </div>
          <p className="text-[11px] text-zinc-500 font-medium">Processamento de Personas</p>
          <p className="text-[9px] text-zinc-700 mt-1.5 max-w-xs leading-relaxed">Aguardando inicio do processamento...</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {hasPrompt && (
          <div className="p-4">
            <PromptSamplePanel data={stepDetails.promptSample!} />
          </div>
        )}
        {hasBatches && <BatchInspector batches={batches} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-12 h-12 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-3">
        {NODE_ICONS[nodeKey] || <Eye size={20} className="text-zinc-700" />}
      </div>
      <p className="text-[11px] text-zinc-500 font-medium">{NODE_LABELS[nodeKey]}</p>
      <p className="text-[9px] text-zinc-700 mt-1.5 max-w-xs leading-relaxed">
        Os detalhes deste step aparecerao quando o pipeline executar.
      </p>
    </div>
  );
}

/* ================================================================
   Main Component — PASSIVE LISTENER
   ================================================================ */

export function ArenaMonitor() {
  const [state, setState] = useState<PipelineState>({ ...initialState });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'detail' | 'logs' | 'batches' | 'segments'>('detail');
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

  const nodeOrder = ['contextExtraction', 'queryAnalyzer', 'webResearch', 'contextBuilder', 'contextValidator', 'personaLoader', 'personaLoop', 'aggregator'];

  // Auto-switch to detail tab when clicking a node with data
  const handleNodeClick = (key: string) => {
    if (selectedNode === key) {
      setSelectedNode(null);
    } else {
      setSelectedNode(key);
      if (nodeHasDetail(key)) {
        setRightTab('detail');
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* ─── Header ─── */}
      <div className="shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/15 border border-violet-500/20 flex items-center justify-center">
              <Radio size={16} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Monitor da Arena</h1>
              <p className="text-[10px] text-zinc-600">Escutando a tela principal em tempo real</p>
            </div>
          </div>

          {/* Context / Topic display */}
          <div className="flex-1 flex items-center gap-3 max-w-2xl">
            {(state.topic || state.question) ? (
              <div className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">
                  {state.corePoint ? 'Ponto Central' : 'Contexto em analise'}
                </p>
                <p className="text-sm text-white truncate">{state.topic || state.question}</p>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-white/[0.02] border border-dashed border-white/[0.06] rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-zinc-500">Aguardando conteudo na tela principal...</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-semibold">Escutando</span>
            </span>

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
                onClick={() => handleNodeClick(key)}
                hasDetail={nodeHasDetail(key)}
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

        </div>

        {/* ─── Right ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {state.progress.total > 0 && (
            <div className="shrink-0 border-b border-white/[0.06]">
              <ProgressStats progress={state.progress} startTime={state.startTime} endTime={state.endTime} avgScore={state.avgScore} />
            </div>
          )}

          <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/[0.04]">
            {([
              { key: 'detail' as const, label: () => selectedNode ? `Detalhes — ${NODE_LABELS[selectedNode] || selectedNode}` : 'Detalhes' },
              { key: 'logs' as const, label: () => `Logs (${state.logs.length})` },
              { key: 'batches' as const, label: () => `Lotes (${state.batches.length})` },
              { key: 'segments' as const, label: () => `Segmentos` },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200',
                  rightTab === tab.key
                    ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                    : 'text-zinc-600 hover:text-zinc-400 border border-transparent',
                )}
              >
                {tab.label()}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
            {rightTab === 'detail' ? (
              selectedNode ? (
                <StepDetailView
                  nodeKey={selectedNode}
                  stepDetails={state.stepDetails}
                  contextExtraction={state.contextExtraction}
                  batches={state.batches}
                  nodeStatus={state.nodes[selectedNode]}
                  progress={state.progress}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-4">
                    <Eye size={24} className="text-zinc-700" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-500">Selecione um step no fluxo</p>
                  <p className="text-[11px] text-zinc-700 mt-2 max-w-xs leading-relaxed">
                    Clique em qualquer etapa do pipeline para ver os detalhes do que foi gerado naquele step.
                  </p>
                </div>
              )
            ) : rightTab === 'logs' ? (
              <LogPanel logs={state.logs} selectedNode={selectedNode} />
            ) : rightTab === 'segments' ? (
              <SegmentsPanel segments={state.segments} />
            ) : (
              <BatchInspector batches={state.batches} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
