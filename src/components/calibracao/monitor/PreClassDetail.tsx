'use client';

import { useCalibrationStore } from '@/app/calibracao/store';
import { Brain, Clock, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded-lg hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-400 transition-all duration-200"
    >
      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
    </button>
  );
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
  copyText,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  copyText?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.04] transition-colors duration-150 text-left"
      >
        {open ? (
          <ChevronDown size={12} className="text-zinc-500" />
        ) : (
          <ChevronRight size={12} className="text-zinc-500" />
        )}
        <span className="text-xs font-medium text-zinc-400 flex-1">{title}</span>
        {copyText && <CopyButton text={copyText} />}
      </button>
      {open && (
        <div className="border-t border-white/[0.06]">
          {children}
        </div>
      )}
    </div>
  );
}

export default function PreClassDetail() {
  const { preClassification } = useCalibrationStore();

  if (!preClassification) {
    return <p className="text-xs text-zinc-600">Aguardando pre-classificacao...</p>;
  }

  const { systemPrompt, userPrompt, rawResponse, parsed, latencyMs, tokens } = preClassification;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain size={14} className="text-zinc-500" />
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Pre-Classificacao Semantica
        </h4>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <Clock size={10} /> {latencyMs}ms
        </span>
        <span>{tokens} tokens</span>
        <span>GPT-4o-mini</span>
      </div>

      {/* Parsed Result (always visible) */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
        <div>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Tipo</span>
          <p className="text-xs text-white">{parsed.type}</p>
        </div>
        <div>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Posicao Central</span>
          <p className="text-xs text-zinc-300 leading-relaxed">{parsed.core_position}</p>
        </div>
        {parsed.figures.length > 0 && (
          <div>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Figuras</span>
            <div className="space-y-1 mt-1">
              {parsed.figures.map((fig, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-white">{fig.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      fig.stance === 'attack'
                        ? 'bg-red-500/10 text-red-400'
                        : fig.stance === 'defense'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-zinc-700/50 text-zinc-400'
                    }`}
                  >
                    {fig.stance}
                  </span>
                  <span className="text-zinc-600">{Math.round(fig.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Guia de Classificacao</span>
          <div className="mt-1 space-y-1 text-xs">
            <p>
              <span className="text-emerald-400">+ Positivo:</span>{' '}
              <span className="text-zinc-400">{parsed.classification_guide.positive_means}</span>
            </p>
            <p>
              <span className="text-red-400">- Negativo:</span>{' '}
              <span className="text-zinc-400">{parsed.classification_guide.negative_means}</span>
            </p>
            <p>
              <span className="text-zinc-500">~ Neutro:</span>{' '}
              <span className="text-zinc-400">{parsed.classification_guide.neutral_means}</span>
            </p>
          </div>
        </div>
        {parsed.relevant_fields && parsed.relevant_fields.length > 0 && (
          <div>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Campos Relevantes</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {parsed.relevant_fields.map((f) => (
                <span
                  key={f}
                  className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] text-zinc-400"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Collapsible: System Prompt */}
      <Collapsible title="System Prompt" copyText={systemPrompt}>
        <pre className="text-[10px] text-zinc-500 p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
          {systemPrompt}
        </pre>
      </Collapsible>

      {/* Collapsible: User Prompt */}
      <Collapsible title="User Prompt" defaultOpen copyText={userPrompt}>
        <pre className="text-[10px] text-zinc-500 p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
          {userPrompt}
        </pre>
      </Collapsible>

      {/* Collapsible: Raw Response */}
      <Collapsible title="Resposta Raw" copyText={rawResponse}>
        <pre className="text-[10px] text-zinc-500 p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
          {rawResponse}
        </pre>
      </Collapsible>
    </div>
  );
}
