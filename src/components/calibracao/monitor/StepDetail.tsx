'use client';

import { useCalibrationStore } from '@/app/calibracao/store';
import PreClassDetail from './PreClassDetail';
import BatchDetail from './BatchDetail';
import { Copy, Check, MapPin, MessageSquare, BarChart3, CheckCircle2 } from 'lucide-react';
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

function QueryReceivedPanel() {
  const { question, geoFilter } = useCalibrationStore();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-zinc-500" />
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Query Recebida
        </h4>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <p className="text-sm text-white leading-relaxed">{question || '—'}</p>
      </div>
      {geoFilter && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <MapPin size={12} />
          <span>
            Filtro: {geoFilter.state}
            {geoFilter.city && ` / ${geoFilter.city}`}
          </span>
        </div>
      )}
    </div>
  );
}

function GeoFilterPanel() {
  const { geoResult } = useCalibrationStore();
  if (!geoResult) return <p className="text-xs text-zinc-600">Aguardando...</p>;

  const removed = geoResult.originalCount - geoResult.filteredCount;
  const pctKept = Math.round((geoResult.filteredCount / geoResult.originalCount) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-zinc-500" />
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Filtro Geografico
        </h4>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-white">
            {geoResult.originalCount.toLocaleString()}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">
            {geoResult.filteredCount.toLocaleString()}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Selecionadas ({pctKept}%)
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-red-400">{removed.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Removidas</p>
        </div>
      </div>

      {geoResult.criteria && (
        <div className="text-xs text-zinc-500">
          Criterio: Estado = {geoResult.criteria.state || 'todos'}
          {geoResult.criteria.city && ` | Cidade = ${geoResult.criteria.city}`}
        </div>
      )}

      {geoResult.sampleRemoved.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-600 mb-1.5">Exemplos removidos:</p>
          <div className="space-y-1">
            {geoResult.sampleRemoved.map((p, i) => (
              <div key={i} className="text-[10px] text-zinc-500 bg-white/[0.02] rounded-lg px-2.5 py-1.5">
                {p.name} — {p.state}/{p.city}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AggregationPanel() {
  const { progress, segments } = useCalibrationStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-zinc-500" />
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Agregacao
        </h4>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{progress.positive}</p>
          <p className="text-[10px] text-zinc-500">Positivos</p>
        </div>
        <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-zinc-400">{progress.neutral}</p>
          <p className="text-[10px] text-zinc-500">Neutros</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-red-400">{progress.negative}</p>
          <p className="text-[10px] text-zinc-500">Negativos</p>
        </div>
      </div>
      {segments && (
        <p className="text-[10px] text-zinc-600">
          {Object.keys(segments).length} dimensoes segmentadas
        </p>
      )}
    </div>
  );
}

function ResultsPanel() {
  const { progress, startTime, endTime } = useCalibrationStore();
  const elapsed = startTime && endTime ? Math.round((endTime - startTime) / 1000) : 0;
  const total = progress.total || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={14} className="text-emerald-500" />
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Resultado Final
        </h4>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Total analisadas</span>
          <span className="text-white font-semibold">{progress.total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-emerald-400">Positivo</span>
          <span className="text-white">{Math.round((progress.positive / total) * 100)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Neutro</span>
          <span className="text-white">{Math.round((progress.neutral / total) * 100)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-red-400">Negativo</span>
          <span className="text-white">{Math.round((progress.negative / total) * 100)}%</span>
        </div>
        {elapsed > 0 && (
          <div className="flex justify-between text-sm pt-2 border-t border-white/[0.06]">
            <span className="text-zinc-500">Tempo total</span>
            <span className="text-zinc-300">{elapsed}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StepDetail() {
  const { selectedNode } = useCalibrationStore();

  if (!selectedNode) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-xs text-zinc-600 text-center">
          Selecione um step do pipeline para ver detalhes
        </p>
      </div>
    );
  }

  const panels: Record<string, React.ReactNode> = {
    queryReceived: <QueryReceivedPanel />,
    geoFilter: <GeoFilterPanel />,
    preClassification: <PreClassDetail />,
    personaProcessing: <BatchDetail />,
    aggregation: <AggregationPanel />,
    results: <ResultsPanel />,
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {panels[selectedNode] || (
        <p className="text-xs text-zinc-600">Dados nao disponiveis</p>
      )}
    </div>
  );
}
