'use client';

import { useCalibrationStore, type StepState } from '@/app/calibracao/store';
import BatchDetail from './BatchDetail';
import {
  Copy, Check, ChevronDown, ChevronRight, Clock, Zap,
  ArrowRight, Globe, Brain, Search, FileText, Cpu, BarChart3, Scale,
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
  accent?: 'emerald' | 'sky' | 'amber' | 'zinc';
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;

  const accentColors = {
    emerald: 'border-l-emerald-500/40 hover:border-l-emerald-500/60',
    sky: 'border-l-sky-500/40 hover:border-l-sky-500/60',
    amber: 'border-l-amber-500/40 hover:border-l-amber-500/60',
    zinc: 'border-l-zinc-600/40 hover:border-l-zinc-500/60',
  };

  const dotColors = {
    emerald: 'bg-emerald-500/60',
    sky: 'bg-sky-500/60',
    amber: 'bg-amber-500/60',
    zinc: 'bg-zinc-500/60',
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

      {/* Queries */}
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

      {/* Sources */}
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

      {/* Combined context */}
      {context && (
        <PromptViewer title="Contexto Combinado da Web" content={context} defaultOpen accent="sky" />
      )}

      {/* Snippets */}
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
  return (
    <div className="space-y-4">
      <SectionHeader title="Construcao de Contexto" description="Claude gera ficha de contextualizacao factual a partir da pesquisa web" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${step.latencyMs}ms`} />}
        {step.tokens != null && <MetaChip icon={<Zap size={10} />} label="Tokens" value={step.tokens} />}
      </div>

      {/* Output cards */}
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

      {step.output?.raw_text && (
        <PromptViewer title="Resposta Raw do Claude" content={step.output.raw_text} accent="zinc" />
      )}

      {step.input?.web_context && (
        <PromptViewer title="Input: Contexto Web Recebido" content={step.input.web_context} accent="zinc" />
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
      <SectionHeader title="Pre-Classificacao Semantica" description="GPT-4o-mini analisa a pergunta para definir o que significa concordar/discordar" />

      <div className="flex flex-wrap gap-2">
        {step.latencyMs != null && <MetaChip icon={<Clock size={10} />} label="Latencia" value={`${step.latencyMs}ms`} />}
        {step.tokens != null && <MetaChip icon={<Zap size={10} />} label="Tokens" value={step.tokens} />}
        <MetaChip icon={<Brain size={10} />} label="Modelo" value="GPT-4o-mini" />
      </div>

      {/* Parsed result */}
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

          {/* Figures */}
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

          {/* Classification guide */}
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

          {/* Relevant fields */}
          {parsed.relevant_fields?.length > 0 && (
            <div className="pt-3 border-t border-white/[0.04]">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Campos Relevantes da Persona</p>
              <div className="flex flex-wrap gap-1.5">
                {parsed.relevant_fields.map((f: string) => (
                  <span key={f} className="px-2.5 py-1 bg-white/[0.03] border border-white/[0.05] rounded-lg text-xs text-zinc-400 font-mono">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prompts */}
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
        <PromptViewer title="Bloco de Disambiguacao (injetado no contexto das personas)" content={step.output.disambiguation_block} defaultOpen accent="emerald" />
      )}
    </div>
  );
}

function PromptPreviewPanel({ step }: { step: StepState }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Preview do Prompt"
        description="Este e o prompt EXATO enviado para cada persona individualmente"
      />

      <div className="flex flex-wrap gap-2">
        {step.input?.batch_size && <MetaChip icon={<Cpu size={10} />} label="Personas/call" value={step.input.batch_size} />}
        {step.input?.persona_count && <MetaChip icon={<FileText size={10} />} label="Personas no Sample" value={step.input.persona_count} />}
        {step.input?.model_split && <MetaChip icon={<Brain size={10} />} label="Split" value={step.input.model_split} />}
      </div>

      {step.input?.system_prompt && (
        <PromptViewer title="System Prompt (Arena)" content={step.input.system_prompt} accent="sky" />
      )}
      {step.input?.user_prompt && (
        <PromptViewer title="User Prompt (amostra)" content={step.input.user_prompt} defaultOpen accent="emerald" />
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
          <p className="text-xl font-bold text-emerald-400 tabular-nums">{o.positive || 0}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">A Favor</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-zinc-500 tabular-nums">{o.neutral || 0}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Neutro</p>
        </div>
        <div className="bg-red-500/[0.03] border border-red-500/10 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-red-400 tabular-nums">{o.negative || 0}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">Contra</p>
        </div>
      </div>

      {o.avgScore != null && (
        <DataCard label="Score Medio Final" value={o.avgScore.toFixed(2)} subtext="Escala 0 (contra) a 10 (a favor)" />
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

      {/* Input info */}
      {inp && (
        <div className="flex flex-wrap gap-2">
          {inp.tipo && <MetaChip icon={<span className="text-[10px]">📎</span>} label="Tipo" value={inp.tipo} />}
          {inp.nome && <MetaChip icon={<span className="text-[10px]">📄</span>} label="Arquivo" value={inp.nome} />}
          {inp.tamanho && <MetaChip icon={<span className="text-[10px]">📏</span>} label="Tamanho" value={inp.tamanho} />}
        </div>
      )}

      {/* Core point */}
      {o?.core_point && (
        <DataCard label="Ponto Central Extraido" value={o.core_point} />
      )}


      {/* Political figures */}
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

      {/* Raw transcription (video only) */}
      {o?.transcricao_bruta && (
        <PromptViewer title="Transcricao Bruta (Whisper)" content={o.transcricao_bruta} defaultOpen accent="amber" />
      )}

      {/* Extracted context */}
      {o?.contexto_extraido && (
        <PromptViewer title="Contexto Extraido pelo Claude" content={o.contexto_extraido} defaultOpen accent="emerald" />
      )}

      {/* Full Claude response */}
      {o?.resposta_completa_claude && (
        <PromptViewer
          title="Resposta Completa do Claude (JSON)"
          content={typeof o.resposta_completa_claude === 'string' ? o.resposta_completa_claude : JSON.stringify(o.resposta_completa_claude, null, 2)}
          accent="sky"
        />
      )}

      {/* Enriched context (what gets sent to Python) */}
      {o?.contexto_enriquecido && (
        <PromptViewer title="Contexto Enriquecido (enviado ao Python)" content={o.contexto_enriquecido} accent="zinc" />
      )}
    </div>
  );
}

const PANEL_MAP: Record<string, (step: StepState) => React.ReactNode> = {
  media_analysis: (s) => <MediaAnalysisPanel step={s} />,
  web_research: (s) => <WebResearchPanel step={s} />,
  context_builder: (s) => <ContextBuilderPanel step={s} />,
  ideological_frame: (s) => <IdeologicalFramePanel step={s} />,
  persona_loader: (s) => <PersonaLoaderPanel step={s} />,
  pre_classifier: (s) => <PreClassifierPanel step={s} />,
  prompt_preview: (s) => <PromptPreviewPanel step={s} />,
  persona_loop: () => <BatchDetail />,
  aggregation: (s) => <AggregationPanel step={s} />,
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
