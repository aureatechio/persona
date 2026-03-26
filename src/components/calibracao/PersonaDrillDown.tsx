'use client';

import { X, User, Brain, FileText, Copy, Check } from 'lucide-react';
import { useCalibrationStore, type PersonaBatchDetail } from '@/app/calibracao/store';
import { useState } from 'react';

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  negative: 'bg-red-500/10 text-red-400 border-red-500/20',
  neutral: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded-lg hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all duration-200"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

interface Props {
  persona: PersonaBatchDetail;
  batchIndex: number;
  onClose: () => void;
}

export default function PersonaDrillDown({ persona, batchIndex, onClose }: Props) {
  const { batches } = useCalibrationStore();
  const batch = batches.find((b) => b.index === batchIndex);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800/50">
              <User size={18} className="text-zinc-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{persona.name}</h2>
              <p className="text-xs text-zinc-500">
                {persona.age} anos | {persona.state} | {persona.political_leaning}
              </p>
            </div>
            <span
              className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${SENTIMENT_STYLE[persona.sentiment] || SENTIMENT_STYLE.neutral}`}
            >
              {persona.sentiment}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-all duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Profile Summary */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} className="text-zinc-500" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Perfil Enviado ao GPT
              </h3>
              <CopyButton text={persona.summary} />
            </div>
            <pre className="text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
              {persona.summary || 'Nao disponivel'}
            </pre>
          </section>

          {/* Batch Prompt */}
          {batch && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Brain size={14} className="text-zinc-500" />
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Prompt do Batch #{batchIndex + 1}
                </h3>
                <CopyButton text={batch.prompt} />
              </div>
              <pre className="text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                {batch.prompt}
              </pre>
            </section>
          )}

          {/* Raw Response */}
          {batch && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Brain size={14} className="text-emerald-500/50" />
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Resposta Raw do GPT
                </h3>
                <CopyButton text={batch.rawResponse} />
              </div>
              <pre className="text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                {batch.rawResponse}
              </pre>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-600">
                <span>Latencia: {batch.latencyMs}ms</span>
                <span>Tokens: {batch.tokens}</span>
                <span>Batch: {batch.index + 1}/{batch.total}</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
