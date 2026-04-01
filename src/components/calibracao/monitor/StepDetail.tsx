'use client';

import { useCalibrationStore, type StepState } from '@/app/calibracao/store';
import {
  Copy, Check, ChevronDown, ChevronRight, Clock, Zap,
  ArrowRight, Globe, Brain, Search, FileText, Cpu, BarChart3, Scale,
  Bot, Sparkles, ShieldCheck, Church, TrendingUp, Target,
} from 'lucide-react';
import { useState } from 'react';

// ── Design Primitives ──

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
      className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-300 border border-white/[0.04] hover:border-white/[0.1] transition-all duration-200 active:scale-[0.93] cursor-pointer inline-flex"
      title="Copiar"
    >
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </span>
  );
}

function PromptViewer({ title, content, defaultOpen = false, accent = 'zinc' }: {
  title: string; content: string; defaultOpen?: boolean;
  accent?: 'emerald' | 'sky' | 'amber' | 'zinc' | 'violet';
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;

  const accentColors = {
    emerald: 'border-l-emerald-500/40 hover:border-l-emerald-500/60',
    sky: 'border-l-sky-500/40 hover:border-l-sky-500/60',
    amber: 'border-l-amber-500/40 hover:border-l-amber-500/60',
    zinc: 'border-l-zinc-600/40 hover:border-l-zinc-500/60',
    violet: 'border-l-violet-500/40 hover:border-l-violet-500/60',
  };

  const dotColors = {
    emerald: 'bg-emerald-500/60',
    sky: 'bg-sky-500/60',
    amber: 'bg-amber-500/60',
    zinc: 'bg-zinc-500/60',
    violet: 'bg-violet-500/60',
  };

  return (
    <div className={`rounded-xl overflow-hidden border border-white/[0.04] border-l-2 ${accentColors[accent]} transition-all duration-200`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors duration-150 text-left"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[accent]}`} />
        {open ? <ChevronDown size={13} className="text-zinc-500 shrink-0" /> : <ChevronRight size={13} className="text-zinc-500 shrink-0" />}
        <span className="text-sm font-medium text-zinc-200 flex-1">{title}</span>
        <span className="text-[10px] text-zinc-600 tabular-nums">{content.length.toLocaleString()} chars</span>
        <CopyBtn text={content} />
      </button>
      {open && (
        <div className="border-t border-white/[0.04] bg-zinc-950/50">
          <pre className="text-[13px] text-zinc-300 p-6 overflow-x-auto whitespace-pre-wrap font-mono leading-[1.7] max-h-[80vh] overflow-y-auto selection:bg-emerald-500/20">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

function MetaChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] text-[11px]">
      <span className="text-zinc-600">{icon}</span>
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300 font-medium tabular-nums">{value}</span>
    </div>
  );
}

function DataCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm text-zinc-200 font-medium leading-relaxed">{value}</p>
      {subtext && <p className="text-[11px] text-zinc-500 mt-1">{subtext}</p>}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

// ── Step-Specific Panels ──

function WebResearchPanel({ step }: { step: StepState }) {
  const queries = step.input?.queries || [];
  const snippets = step.output?.snippets || [];
  const sources = step.output?.sources || [];
  const context = step.output?.combined_context || '';

  return (
    <div className="space-y-4">
      <SectionHeader title="Pesquisa na Web" description="Tavily Search busca contexto factual sobre o tema" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${step.latencyMs}ms`} />}
        <MetaChip icon={<Globe size={10} />} label="Fontes" value={sources.length} />
        <MetaChip icon={<Search size={10} />} label="Snippets" value={snippets.length} />
      </div>

      {queries.length > 0 && (
        <div>
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Queries Enviadas</p>
          <div className="space-y-1.5">
            {queries.map((q: string, i: number) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-zinc-600 font-mono">Q{i + 1}</span>
                <span className="text-sm text-zinc-300">{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Fontes Encontradas</p>
          <div className="space-y-1">
            {sources.map((s: string, i: number) => (
              <p key={i} className="text-xs text-zinc-500 truncate">{s}</p>
            ))}
          </div>
        </div>
      )}

      {context && (
        <PromptViewer title="Contexto Combinado da Web" content={context} defaultOpen accent="sky" />
      )}

      {snippets.length > 0 && (
        <PromptViewer
          title={`Snippets (${snippets.length})`}
          content={snippets.map((s: string, i: number) => `[${i + 1}] ${s}`).join('\n\n')}
          accent="zinc"
        />
      )}
    </div>
  );
}

function ContextBuilderPanel({ step }: { step: StepState }) {
  const smartSearch = step.input?.smart_search;

  return (
    <div className="space-y-4">
      <SectionHeader title="Contextualizacao IA" description="Claude analisa o conteudo, decide se precisa buscar na web, e contextualiza" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${step.latencyMs}ms`} />}
        {step.tokens != null && <MetaChip icon={<Zap size={10} />} label="Tokens" value={step.tokens} />}
        {smartSearch && (
          <MetaChip
            icon={<Globe size={10} />}
            label="Busca Web"
            value={smartSearch.searched ? `Sim (${smartSearch.queries?.length || 0} queries)` : 'Nao necessaria'}
          />
        )}
      </div>

      {smartSearch && (
        <div className={`px-4 py-3 rounded-xl border text-sm ${
          smartSearch.searched
            ? 'bg-sky-500/[0.03] border-sky-500/10 text-sky-300'
            : 'bg-zinc-800/20 border-zinc-700/20 text-zinc-400'
        }`}>
          <span className="font-medium">{smartSearch.searched ? 'Buscou na web' : 'Usou conhecimento proprio'}</span>
          {smartSearch.reason && <span className="text-zinc-500 ml-2">— {smartSearch.reason}</span>}
          {smartSearch.queries?.length > 0 && (
            <div className="mt-2 space-y-1">
              {smartSearch.queries.map((q: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                  <Search size={10} className="text-sky-400 shrink-0" />
                  <span>{q}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step.output?.tema && <DataCard label="Tema Detectado" value={step.output.tema} />}

      {step.output?.contexto && (
        <PromptViewer title="Contexto Gerado" content={step.output.contexto} defaultOpen accent="emerald" />
      )}

      {step.output?.figuras && Array.isArray(step.output.figuras) && step.output.figuras.length > 0 && (
        <div>
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Figuras Identificadas</p>
          <div className="grid gap-2">
            {step.output.figuras.map((fig: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-sm font-semibold text-white">{fig.nome || fig.name}</span>
                {fig.cargo && <span className="text-xs text-zinc-500">{fig.cargo}</span>}
                {fig.relevancia && <span className="text-xs text-zinc-600 ml-auto">{fig.relevancia}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {step.output?.periodo && <DataCard label="Periodo" value={step.output.periodo} />}

      {step.output?.web_data && (
        <PromptViewer title="Dados da Web (busca inteligente)" content={step.output.web_data} accent="sky" />
      )}

      {step.output?.raw_text && (
        <PromptViewer title="Resposta Raw do Claude" content={step.output.raw_text} accent="zinc" />
      )}
    </div>
  );
}

function IdeologicalFramePanel({ step }: { step: StepState }) {
  const frame = step.output?.frame || '';

  return (
    <div className="space-y-4">
      <SectionHeader title="Mapeamento Ideologico" description="Claude mapeia como esquerda e direita veem este tema" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${step.latencyMs}ms`} />}
      </div>

      {frame && (
        <PromptViewer title="Frame Ideologico Gerado" content={frame} defaultOpen accent="amber" />
      )}

      {step.output?.error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10 text-sm text-red-400">
          Erro: {step.output.error}
        </div>
      )}
    </div>
  );
}

function PreClassifierPanel({ step }: { step: StepState }) {
  const parsed = step.output?.parsed;

  return (
    <div className="space-y-4">
      <SectionHeader title="Pre-Classificacao Semantica" description="GPT-4o-mini analisa a pergunta para definir concordar/discordar" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${step.latencyMs}ms`} />}
        {step.tokens != null && <MetaChip icon={<Zap size={10} />} label="Tokens" value={step.tokens} />}
        <MetaChip icon={<Brain size={10} />} label="Modelo" value="GPT-4o-mini" />
      </div>

      {parsed && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DataCard label="Tipo Detectado" value={parsed.type} />
            <DataCard
              label="Confianca"
              value={parsed.figures?.length > 0 ? `${parsed.figures.length} figuras` : 'Nenhuma figura'}
            />
          </div>

          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Posicao Central</p>
            <p className="text-base text-white font-medium leading-relaxed">{parsed.core_position}</p>
          </div>

          {parsed.figures?.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Figuras Politicas</p>
              {parsed.figures.map((fig: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="text-sm text-white font-semibold">{fig.name}</span>
                  <ArrowRight size={12} className="text-zinc-700" />
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    fig.stance === 'attack' ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                      : fig.stance === 'defense' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                      : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30'
                  }`}>
                    {fig.stance === 'attack' ? 'Ataque' : fig.stance === 'defense' ? 'Defesa' : 'Mencao'}
                  </span>
                  <span className="text-xs text-zinc-600 ml-auto tabular-nums">{Math.round((fig.confidence || 0) * 100)}%</span>
                </div>
              ))}
            </div>
          )}

          {parsed.classification_guide && (
            <div className="space-y-2 pt-3 border-t border-white/[0.04]">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Guia de Classificacao</p>
              <div className="grid gap-2">
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10">
                  <span className="text-emerald-400 font-bold text-xs shrink-0 mt-0.5">7-10</span>
                  <span className="text-sm text-zinc-300">{parsed.classification_guide.positive_means}</span>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-red-500/[0.03] border border-red-500/10">
                  <span className="text-red-400 font-bold text-xs shrink-0 mt-0.5">0-3</span>
                  <span className="text-sm text-zinc-300">{parsed.classification_guide.negative_means}</span>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/20 border border-zinc-700/20">
                  <span className="text-zinc-500 font-bold text-xs shrink-0 mt-0.5">4-6</span>
                  <span className="text-sm text-zinc-400">{parsed.classification_guide.neutral_means}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step.input?.system_prompt && (
        <PromptViewer title="System Prompt Enviado ao GPT" content={step.input.system_prompt} accent="sky" />
      )}
      {step.input?.user_prompt && (
        <PromptViewer title="User Prompt Enviado" content={step.input.user_prompt} defaultOpen accent="emerald" />
      )}
      {step.output?.raw_response && (
        <PromptViewer title="Resposta Raw do GPT" content={step.output.raw_response} accent="amber" />
      )}
      {step.output?.disambiguation_block && (
        <PromptViewer title="Bloco de Disambiguacao (injetado no contexto)" content={step.output.disambiguation_block} defaultOpen accent="emerald" />
      )}
    </div>
  );
}

function PersonaLoaderPanel({ step }: { step: StepState }) {
  const o = step.output;
  if (!o) return <p className="text-sm text-zinc-600">Aguardando...</p>;

  const filtered = o.filtered_count ?? o.original_count;
  const removed = (o.original_count ?? 0) - filtered;
  const pctKept = o.original_count ? Math.round((filtered / o.original_count) * 100) : 100;

  return (
    <div className="space-y-4">
      <SectionHeader title="Carregamento de Personas" description="Personas carregadas do Supabase e filtradas por localizacao" />

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-zinc-300 tabular-nums">{(o.original_count || 0).toLocaleString()}</p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">Total no Banco</p>
        </div>
        <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{filtered.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">Selecionadas ({pctKept}%)</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-zinc-500 tabular-nums">{removed.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">Removidas</p>
        </div>
      </div>

      {o.geo_filter && (
        <DataCard
          label="Filtro Geografico"
          value={`Estado: ${o.geo_filter.state || 'Todos'}${o.geo_filter.city ? ` | Cidade: ${o.geo_filter.city}` : ''}`}
        />
      )}

      {o.geo_cities?.length > 0 && (
        <div>
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Cidades Incluidas</p>
          <div className="space-y-1">
            {o.geo_cities.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02] text-xs">
                <span className="text-zinc-300">{c.city} ({c.state})</span>
                <span className="text-zinc-500 tabular-nums">{c.personaCount} personas</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AggregationPanel({ step }: { step: StepState }) {
  const o = step.output;
  if (!o) return <p className="text-sm text-zinc-600">Aguardando agregacao...</p>;

  return (
    <div className="space-y-4">
      <SectionHeader title="Agregacao de Resultados" description="Sentimentos agregados por segmento demografico" />

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-zinc-300 tabular-nums">{(o.total || 0).toLocaleString()}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Total</p>
        </div>
        <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-emerald-400 tabular-nums">{(o.positive || 0).toLocaleString()}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">A Favor</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-zinc-500 tabular-nums">{(o.neutral || 0).toLocaleString()}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Neutro</p>
        </div>
        <div className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-red-400 tabular-nums">{(o.negative || 0).toLocaleString()}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Contra</p>
        </div>
      </div>

      {o.avgScore != null && (
        <DataCard label="Score Medio Final" value={o.avgScore.toFixed(2)} subtext="Escala 0 (contra) a 10 (a favor)" />
      )}
    </div>
  );
}

// ── NEW: Aggregate Engine Panel ──

function AggregateEnginePanel({ step }: { step: StepState }) {
  const o = step.output;
  const inp = step.input;

  if (step.status === 'running') {
    return (
      <div className="space-y-4">
        <SectionHeader title="Motor de Inferencia Agregada" description="1 chamada GPT-4o que deriva sentimento por segmento a partir do perfil estatistico" />
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.03] border border-amber-500/10">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-amber-300">{step.description || 'Processando...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Motor de Inferencia Agregada" description="1 chamada GPT-4o que deriva sentimento por segmento a partir do perfil estatistico" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${(step.latencyMs / 1000).toFixed(1)}s`} />}
        {inp?.model && <MetaChip icon={<Cpu size={10} />} label="Modelo" value={inp.model} />}
        {inp?.profile_meta?.total_personas && (
          <MetaChip icon={<Brain size={10} />} label="Perfil" value={`${inp.profile_meta.total_personas.toLocaleString()} personas`} />
        )}
      </div>

      {/* Results summary */}
      {o && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-zinc-300 tabular-nums">{(o.total || 0).toLocaleString()}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">Total</p>
          </div>
          <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{(o.positive || 0).toLocaleString()}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">A Favor</p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-zinc-500 tabular-nums">{(o.neutral || 0).toLocaleString()}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">Neutro</p>
          </div>
          <div className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-3.5 text-center">
            <p className="text-lg font-bold text-red-400 tabular-nums">{(o.negative || 0).toLocaleString()}</p>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">Contra</p>
          </div>
        </div>
      )}

      {o?.avgScore != null && (
        <DataCard label="Score Medio Derivado" value={o.avgScore.toFixed(2)} subtext="Escala 0 (contra) a 10 (a favor)" />
      )}

      {o?.comments_count != null && (
        <div className="flex gap-3">
          <DataCard label="Comentarios Gerados" value={String(o.comments_count)} />
          {o?.cluster_count != null && <DataCard label="Clusters Analisados" value={String(o.cluster_count)} />}
        </div>
      )}

      {/* Prompts */}
      {inp?.system_prompt && (
        <PromptViewer title="System Prompt (Aggregate Engine)" content={inp.system_prompt} accent="sky" />
      )}
      {inp?.user_prompt && (
        <PromptViewer title="User Prompt (Perfil + Conteudo)" content={inp.user_prompt} accent="emerald" />
      )}
    </div>
  );
}

// ── NEW: Specialist Agents Panel ──

const SPECIALIST_EMOJI_MAP: Record<string, React.FC<{ size: number; className?: string }>> = {
  bullseye: Target,
  church: Church,
  'trending-up': TrendingUp,
  brain: Brain,
  'shield-check': ShieldCheck,
};

const RISK_COLORS: Record<string, string> = {
  baixo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medio: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  alto: 'bg-red-500/10 text-red-400 border-red-500/20',
  critico: 'bg-red-500/15 text-red-300 border-red-500/30',
};

function SpecialistAgentsPanel({ step }: { step: StepState }) {
  const { specialistPanel } = useCalibrationStore();
  const panel = specialistPanel || step.output;

  if (step.status === 'running') {
    return (
      <div className="space-y-4">
        <SectionHeader title="Especialistas IA" description="5 agentes Claude analisam o conteudo em paralelo" />
        <div className="space-y-2">
          {['Comunicacao Politica', 'Assuntos Religiosos', 'Marketing Digital', 'Psicologia Social', 'Compliance Legal'].map((name) => (
            <div key={name} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-zinc-400">{name}</span>
              <span className="text-[10px] text-zinc-600 ml-auto">Analisando...</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!panel?.specialists?.length) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Especialistas IA" description="5 agentes Claude analisam o conteudo em paralelo" />
        <p className="text-sm text-zinc-600">{step.status === 'error' ? step.description : 'Aguardando...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Especialistas IA" description="5 agentes Claude analisaram o conteudo em paralelo" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${(step.latencyMs / 1000).toFixed(1)}s`} />}
        <MetaChip icon={<Bot size={10} />} label="Agentes" value={panel.specialists.length} />
      </div>

      {/* Consensus */}
      {panel.consensus && (
        <div className="bg-emerald-500/[0.04] border border-emerald-500/15 rounded-xl p-4">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Consenso</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{panel.consensus}</p>
        </div>
      )}

      {/* Divergences */}
      {panel.divergences && (
        <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-4">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Divergencia</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{panel.divergences}</p>
        </div>
      )}

      {/* Specialist Cards */}
      <div className="space-y-3">
        {panel.specialists.map((spec: any) => {
          const EmojiIcon = SPECIALIST_EMOJI_MAP[spec.emoji] || Bot;
          const riskClass = RISK_COLORS[spec.riskLevel] || RISK_COLORS.medio;

          return (
            <div key={spec.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-white/[0.04]">
                  <EmojiIcon size={14} className="text-zinc-400" />
                </div>
                <span className="text-sm font-semibold text-white flex-1">{spec.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${riskClass}`}>
                  {spec.riskLevel}
                </span>
              </div>

              {/* Verdict */}
              <p className="text-sm text-zinc-200 font-medium leading-relaxed">{spec.verdict}</p>

              {/* Key Points */}
              {spec.keyPoints?.length > 0 && (
                <div className="space-y-1.5">
                  {spec.keyPoints.map((point: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                      <span className="w-1 h-1 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
                      <span className="leading-relaxed">{point}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {spec.recommendations?.length > 0 && (
                <div className="pt-2 border-t border-white/[0.04] space-y-1.5">
                  {spec.recommendations.map((rec: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                        rec.priority === 'urgente' ? 'bg-red-500/10 text-red-400'
                          : rec.priority === 'importante' ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-sky-500/10 text-sky-400'
                      }`}>
                        {rec.priority}
                      </span>
                      <span className="text-zinc-300 leading-relaxed">{rec.text}</span>
                      {rec.segment && <span className="text-zinc-600 ml-auto shrink-0">({rec.segment})</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Data Highlight */}
              {spec.dataHighlight && (
                <div className="px-3 py-2 rounded-lg bg-violet-500/[0.04] border border-violet-500/10">
                  <p className="text-[10px] text-violet-400 font-semibold mb-0.5">Dado Surpreendente</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{spec.dataHighlight}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── NEW: Duda Analysis Panel ──

function DudaAnalysisPanel({ step }: { step: StepState }) {
  const { dudaAnalysis } = useCalibrationStore();
  const data = dudaAnalysis || step.output;

  if (step.status === 'running') {
    return (
      <div className="space-y-4">
        <SectionHeader title="Duda Marqueteira" description="Claude Opus gera recomendacoes estrategicas" />
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/[0.03] border border-violet-500/10">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-sm text-violet-300">Gerando analise estrategica com Claude Opus...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Duda Marqueteira" description="Claude Opus gera recomendacoes estrategicas" />
        <p className="text-sm text-zinc-600">{step.status === 'error' ? step.description : 'Aguardando...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Duda Marqueteira" description="Claude Opus — analise estrategica completa" />

      {/* Headline */}
      {data.headline && (
        <div className="relative rounded-2xl p-px bg-gradient-to-r from-emerald-500/30 via-transparent to-violet-500/30">
          <div className="bg-zinc-950 rounded-2xl p-5">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Headline da Duda</p>
            <p className="text-lg font-bold text-white tracking-tight leading-relaxed">{data.headline}</p>
          </div>
        </div>
      )}

      {/* Score + Projected */}
      {data.score != null && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Score Atual</p>
            <p className="text-3xl font-bold text-white tabular-nums">{data.score.toFixed(1)}</p>
          </div>
          <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl p-4 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Score Projetado</p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-3xl font-bold text-emerald-400 tabular-nums">{data.projectedScore?.toFixed(1) || '—'}</p>
              {data.projectedScore && data.score && (
                <span className="text-xs text-emerald-400 font-semibold">+{(data.projectedScore - data.score).toFixed(1)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Platform Summaries */}
      {data.platformSummaries?.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Analise por Plataforma</p>
          <div className="space-y-2">
            {data.platformSummaries.map((ps: any, i: number) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">{ps.platform}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{ps.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Radar */}
      {data.radar && (
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Radar de Performance</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(data.radar).map(([key, val]) => (
              <div key={key} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-zinc-300 tabular-nums">{(val as number).toFixed(1)}</p>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5 capitalize">{key}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations?.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Recomendacoes</p>
          <div className="space-y-2">
            {data.recommendations.map((rec: any, i: number) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-zinc-600 mt-0.5">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-200 font-medium leading-relaxed">{rec.text}</p>
                    {rec.gain && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                        {rec.gain}
                      </span>
                    )}
                    {rec.detail && <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{rec.detail}</p>}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                    rec.priority === 'prioridade' ? 'bg-red-500/10 text-red-400'
                      : rec.priority === 'importante' ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-sky-500/10 text-sky-400'
                  }`}>
                    {rec.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {data.nextSteps?.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Proximos Passos</p>
          <div className="space-y-2">
            {data.nextSteps.map((step: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/[0.06] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-zinc-200 font-medium">{step.title}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">{step.benefit}</p>
                </div>
                {step.deadline && (
                  <span className="text-[10px] text-zinc-600 shrink-0">{step.deadline}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      {data.insight && (
        <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-emerald-400 mb-1">{data.insight.title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed mb-2">{data.insight.description}</p>
          <div className="px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
            <p className="text-xs font-semibold text-emerald-300 leading-relaxed">{data.insight.action}</p>
          </div>
        </div>
      )}

      {/* Full JSON for debugging */}
      <PromptViewer
        title="JSON Completo da Duda"
        content={JSON.stringify(data, null, 2)}
        accent="violet"
      />
    </div>
  );
}

function MediaAnalysisPanel({ step }: { step: StepState }) {
  if (!step.input && !step.output) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Analise de Midia" description={step.description || 'Processando midia...'} />
        {step.status === 'running' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.03] border border-amber-500/10">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-amber-300">{step.description}</span>
          </div>
        )}
      </div>
    );
  }

  const o = step.output;
  const inp = step.input;

  return (
    <div className="space-y-4">
      <SectionHeader title="Analise de Midia" description="Claude analisou o conteudo da imagem/video e extraiu contexto" />

      {inp && (
        <div className="flex flex-wrap gap-2">
          {inp.tipo && <MetaChip icon={<span className="text-[10px]">📎</span>} label="Tipo" value={inp.tipo} />}
          {inp.nome && <MetaChip icon={<span className="text-[10px]">📄</span>} label="Arquivo" value={inp.nome} />}
          {inp.tamanho && <MetaChip icon={<span className="text-[10px]">📏</span>} label="Tamanho" value={inp.tamanho} />}
        </div>
      )}

      {o?.core_point && (
        <DataCard label="Ponto Central Extraido" value={o.core_point} />
      )}

      {o?.figuras_politicas && Array.isArray(o.figuras_politicas) && o.figuras_politicas.length > 0 && (
        <div>
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Figuras Politicas Detectadas</p>
          <div className="grid gap-2">
            {o.figuras_politicas.map((fig: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-sm font-semibold text-white">{fig.nome}</span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                  fig.posicao_autor === 'contra' ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                    : fig.posicao_autor === 'a favor' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                    : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30'
                }`}>
                  {fig.posicao_autor || 'neutro'}
                </span>
                <span className="text-xs text-zinc-500 ml-auto">{fig.alinhamento}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {o?.transcricao_bruta && (
        <PromptViewer title="Transcricao Bruta (Whisper)" content={o.transcricao_bruta} defaultOpen accent="amber" />
      )}

      {o?.contexto_extraido && (
        <PromptViewer title="Contexto Extraido pelo Claude" content={o.contexto_extraido} defaultOpen accent="emerald" />
      )}

      {o?.resposta_completa_claude && (
        <PromptViewer
          title="Resposta Completa do Claude (JSON)"
          content={typeof o.resposta_completa_claude === 'string' ? o.resposta_completa_claude : JSON.stringify(o.resposta_completa_claude, null, 2)}
          accent="sky"
        />
      )}

      {o?.contexto_enriquecido && (
        <PromptViewer title="Contexto Enriquecido (enviado ao Python)" content={o.contexto_enriquecido} accent="zinc" />
      )}
    </div>
  );
}

function GenericStepPanel({ step }: { step: StepState }) {
  return (
    <div className="space-y-4">
      <SectionHeader title={step.label} description={step.description || undefined} />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${step.latencyMs}ms`} />}
        {step.tokens != null && <MetaChip icon={<Zap size={10} />} label="Tokens" value={step.tokens} />}
      </div>

      {step.input && Object.entries(step.input).map(([key, val]) => (
        <PromptViewer
          key={key}
          title={`Input: ${key.replace(/_/g, ' ')}`}
          content={typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
          defaultOpen={key.includes('prompt') || key.includes('question')}
          accent={key.includes('system') ? 'sky' : key.includes('user') ? 'emerald' : 'zinc'}
        />
      ))}

      {step.output && Object.entries(step.output).map(([key, val]) => (
        <PromptViewer
          key={key}
          title={`Output: ${key.replace(/_/g, ' ')}`}
          content={typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
          defaultOpen={key.includes('raw') || key.includes('contexto')}
          accent="amber"
        />
      ))}
    </div>
  );
}

// ── Route to Panel ──

const PANEL_MAP: Record<string, (step: StepState) => React.ReactNode> = {
  media_analysis: (s) => <MediaAnalysisPanel step={s} />,
  web_research: (s) => <WebResearchPanel step={s} />,
  context_builder: (s) => <ContextBuilderPanel step={s} />,
  ideological_frame: (s) => <IdeologicalFramePanel step={s} />,
  persona_loader: (s) => <PersonaLoaderPanel step={s} />,
  pre_classifier: (s) => <PreClassifierPanel step={s} />,
  aggregate_engine: (s) => <AggregateEnginePanel step={s} />,
  aggregation: (s) => <AggregationPanel step={s} />,
  specialists: (s) => <SpecialistAgentsPanel step={s} />,
  duda_analysis: (s) => <DudaAnalysisPanel step={s} />,
};

export default function StepDetail() {
  const { selectedStep, steps } = useCalibrationStore();

  if (!selectedStep) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="p-4 rounded-2xl bg-zinc-900/30 mb-3">
          <BarChart3 size={24} className="text-zinc-700" />
        </div>
        <p className="text-sm text-zinc-600 text-center">
          Selecione um step do pipeline
        </p>
        <p className="text-xs text-zinc-700 text-center mt-1">
          para ver prompts, respostas e detalhes
        </p>
      </div>
    );
  }

  const step = steps[selectedStep];
  if (!step) return null;

  const renderPanel = PANEL_MAP[selectedStep] || ((s: StepState) => <GenericStepPanel step={s} />);

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {renderPanel(step)}
    </div>
  );
}
