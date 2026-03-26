'use client';

import { useCalibrationStore, type CalibrationBatch, type PersonaBatchDetail } from '@/app/calibracao/store';
import { ChevronDown, ChevronRight, Clock, Cpu, Copy, Check, User } from 'lucide-react';
import { useState } from 'react';
import PersonaDrillDown from '../PersonaDrillDown';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
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

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-emerald-400',
  negative: 'bg-red-400',
  neutral: 'bg-zinc-500',
};

function BatchRow({ batch }: { batch: CalibrationBatch }) {
  const [expanded, setExpanded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaBatchDetail | null>(null);

  const pos = batch.sentiments.filter((s) => s === 'positive').length;
  const neg = batch.sentiments.filter((s) => s === 'negative').length;
  const neu = batch.sentiments.length - pos - neg;

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Batch header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.04] transition-colors duration-150 text-left"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-zinc-500 shrink-0" />
        )}
        <span className="text-xs font-medium text-zinc-300">
          Batch {batch.index + 1}/{batch.total}
        </span>
        <div className="flex items-center gap-2 ml-auto text-[10px] text-zinc-600">
          <span className="text-emerald-500">{pos}+</span>
          <span className="text-zinc-500">{neu}~</span>
          <span className="text-red-500">{neg}-</span>
          <span className="flex items-center gap-0.5">
            <Clock size={9} /> {batch.latencyMs}ms
          </span>
          <span>{batch.tokens}tk</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] space-y-2 p-3">
          {/* Prompt toggle */}
          <div>
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
            >
              {showPrompt ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Prompt Enviado
              <CopyButton text={batch.prompt} />
            </button>
            {showPrompt && (
              <pre className="mt-1.5 text-[10px] text-zinc-500 bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                {batch.prompt}
              </pre>
            )}
          </div>

          {/* Raw response toggle */}
          <div>
            <button
              onClick={() => setShowResponse(!showResponse)}
              className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
            >
              {showResponse ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Resposta Raw GPT
              <CopyButton text={batch.rawResponse} />
            </button>
            {showResponse && (
              <pre className="mt-1.5 text-[10px] text-zinc-500 bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">
                {batch.rawResponse}
              </pre>
            )}
          </div>

          {/* Persona list */}
          <div>
            <p className="text-[10px] text-zinc-600 mb-1.5">
              Personas ({batch.personas.length}):
            </p>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {batch.personas.map((p, i) => (
                <button
                  key={`${p.id}-${i}`}
                  onClick={() => setSelectedPersona(p)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors duration-150 text-left"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SENTIMENT_DOT[p.sentiment] || SENTIMENT_DOT.neutral}`} />
                  <User size={10} className="text-zinc-600 shrink-0" />
                  <span className="text-[10px] text-zinc-400 truncate flex-1">
                    {p.name}
                  </span>
                  <span className="text-[10px] text-zinc-600">{p.state}</span>
                  <span className="text-[10px] text-zinc-600">{p.age}a</span>
                  <span
                    className={`text-[10px] font-medium ${
                      p.sentiment === 'positive'
                        ? 'text-emerald-400'
                        : p.sentiment === 'negative'
                          ? 'text-red-400'
                          : 'text-zinc-500'
                    }`}
                  >
                    {p.sentiment}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedPersona && (
        <PersonaDrillDown
          persona={selectedPersona}
          batchIndex={batch.index}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </div>
  );
}

export default function BatchDetail() {
  const { batches, isProcessing, progress } = useCalibrationStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Cpu size={14} className="text-zinc-500" />
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Processamento de Personas
        </h4>
      </div>

      {isProcessing && batches.length === 0 && (
        <p className="text-xs text-zinc-600">Aguardando primeiro batch...</p>
      )}

      <div className="flex items-center gap-3 text-[10px] text-zinc-600">
        <span>{batches.length} batches processados</span>
        {progress.total > 0 && (
          <span>
            {progress.processed}/{progress.total} personas
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {batches.map((batch) => (
          <BatchRow key={batch.index} batch={batch} />
        ))}
      </div>
    </div>
  );
}
