'use client';

import { useCalibrationStore, type StepState } from '@/app/calibracao/store';
import BatchDetail from './BatchDetail';
import { Copy, Check, ChevronDown, ChevronRight, Clock, Zap } from 'lucide-react';
import { useState } from 'react';

// ── Reusable Components ──

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all duration-200"
      title="Copiar"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

function PromptBlock({ title, content, defaultOpen = false }: { title: string; content: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.04] transition-colors duration-150 text-left"
      >
        {open ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
        <span className="text-sm font-medium text-zinc-300 flex-1">{title}</span>
        <CopyBtn text={content} />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] bg-white/[0.02]">
          <pre className="text-sm text-zinc-300 p-5 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

function MetaBadges({ step }: { step: StepState }) {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-4">
      {step.latencyMs != null && (
        <span className="flex items-center gap-1">
          <Clock size={11} /> {step.latencyMs}ms
        </span>
      )}
      {step.tokens != null && (
        <span className="flex items-center gap-1">
          <Zap size={11} /> {step.tokens} tokens
        </span>
      )}
    </div>
  );
}

function DataBlock({ label, data }: { label: string; data: any }) {
  if (!data) return null;
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return <PromptBlock title={label} content={text} />;
}

// ── Step-Specific Panels ──

function GenericStepPanel({ step }: { step: StepState }) {
  return (
    <div className="space-y-3">
      {step.description && (
        <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>
      )}
      <MetaBadges step={step} />

      {step.input && Object.entries(step.input).map(([key, val]) => (
        <PromptBlock
          key={key}
          title={`Input: ${key.replace(/_/g, ' ')}`}
          content={typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
          defaultOpen={key.includes('prompt') || key.includes('question')}
        />
      ))}

      {step.output && Object.entries(step.output).map(([key, val]) => {
        // Show parsed objects nicely
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          return (
            <div key={key} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
                {key.replace(/_/g, ' ')}
              </h4>
              <div className="space-y-2">
                {Object.entries(val).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{k}</span>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {typeof v === 'string' ? v : JSON.stringify(v)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        return (
          <PromptBlock
            key={key}
            title={`Output: ${key.replace(/_/g, ' ')}`}
            content={typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
            defaultOpen={key.includes('raw') || key.includes('contexto') || key.includes('frame')}
          />
        );
      })}
    </div>
  );
}

function PreClassifierPanel({ step }: { step: StepState }) {
  const parsed = step.output?.parsed;

  return (
    <div className="space-y-4">
      {step.description && (
        <p className="text-sm text-zinc-400">{step.description}</p>
      )}
      <MetaBadges step={step} />

      {/* Parsed result as cards */}
      {parsed && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Resultado da Analise</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Tipo</span>
              <p className="text-sm text-white font-medium">{parsed.type}</p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Modelo</span>
              <p className="text-sm text-zinc-300">GPT-4o-mini</p>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Posicao Central</span>
            <p className="text-sm text-zinc-200 leading-relaxed mt-1">{parsed.core_position}</p>
          </div>

          {parsed.figures?.length > 0 && (
            <div>
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Figuras Detectadas</span>
              <div className="space-y-1.5 mt-1">
                {parsed.figures.map((fig: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-white font-medium">{fig.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      fig.stance === 'attack' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : fig.stance === 'defense' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30'
                    }`}>
                      {fig.stance}
                    </span>
                    <span className="text-xs text-zinc-500">{Math.round((fig.confidence || 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.classification_guide && (
            <div>
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Guia de Classificacao</span>
              <div className="mt-1.5 space-y-1.5">
                <p className="text-sm"><span className="text-emerald-400 font-medium">Score 7-10:</span> <span className="text-zinc-300">{parsed.classification_guide.positive_means}</span></p>
                <p className="text-sm"><span className="text-red-400 font-medium">Score 0-3:</span> <span className="text-zinc-300">{parsed.classification_guide.negative_means}</span></p>
                <p className="text-sm"><span className="text-zinc-500 font-medium">Score 4-6:</span> <span className="text-zinc-300">{parsed.classification_guide.neutral_means}</span></p>
              </div>
            </div>
          )}

          {parsed.relevant_fields?.length > 0 && (
            <div>
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Campos Relevantes</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {parsed.relevant_fields.map((f: string) => (
                  <span key={f} className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-xs text-zinc-400">
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
        <PromptBlock title="System Prompt Enviado" content={step.input.system_prompt} />
      )}
      {step.input?.user_prompt && (
        <PromptBlock title="User Prompt Enviado" content={step.input.user_prompt} defaultOpen />
      )}
      {step.output?.raw_response && (
        <PromptBlock title="Resposta Raw do GPT" content={step.output.raw_response} />
      )}
      {step.output?.disambiguation_block && (
        <PromptBlock title="Bloco de Disambiguacao (injetado no contexto)" content={step.output.disambiguation_block} defaultOpen />
      )}
    </div>
  );
}

function PromptPreviewPanel({ step }: { step: StepState }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>

      {step.input?.model_split && (
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>Batch size: {step.input.batch_size}</span>
          <span>{step.input.model_split}</span>
          <span>{step.input.persona_count} personas no sample</span>
        </div>
      )}

      {step.input?.system_prompt && (
        <PromptBlock title="System Prompt (Arena)" content={step.input.system_prompt} />
      )}
      {step.input?.user_prompt && (
        <PromptBlock title="User Prompt (1o Batch completo)" content={step.input.user_prompt} defaultOpen />
      )}
    </div>
  );
}

function PersonaLoopPanel() {
  return <BatchDetail />;
}

// ── Main Component ──

export default function StepDetail() {
  const { selectedStep, steps } = useCalibrationStore();

  if (!selectedStep) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-zinc-600 text-center">
          Selecione um step do pipeline para ver os prompts e detalhes
        </p>
      </div>
    );
  }

  const step = steps[selectedStep];
  if (!step) return null;

  // Title
  const title = step.label;

  // Pick panel
  let panel: React.ReactNode;
  if (selectedStep === 'pre_classifier') {
    panel = <PreClassifierPanel step={step} />;
  } else if (selectedStep === 'prompt_preview') {
    panel = <PromptPreviewPanel step={step} />;
  } else if (selectedStep === 'persona_loop') {
    panel = <PersonaLoopPanel />;
  } else {
    panel = <GenericStepPanel step={step} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <h3 className="text-base font-semibold text-white tracking-tight mb-4">
        {title}
      </h3>
      {panel}
    </div>
  );
}
