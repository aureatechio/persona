'use client';

import type { AllSegments, SegmentItem } from '@/app/calibracao/store';

const SEGMENT_LABELS: Record<string, string> = {
  gender: 'Genero',
  religion: 'Religiao',
  race: 'Raca/Cor',
  region: 'Regiao',
  generation: 'Geracao',
  socialClass: 'Classe Social',
  education: 'Escolaridade',
  politicalLeaning: 'Posicao Politica',
  archetype: 'Arquetipo',
  clusterMacro: 'Cluster Macro',
  scoreEco: 'Eixo Economico',
  scoreCost: 'Eixo Costumes',
};

function MiniBar({ item }: { item: SegmentItem }) {
  const total = item.count || 1;
  const pPct = Math.round((item.positive / total) * 100);
  const nPct = Math.round((item.negative / total) * 100);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-zinc-400 w-36 truncate shrink-0" title={item.label}>
        {item.label}
      </span>
      <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-zinc-800/50">
        {pPct > 0 && (
          <div className="bg-emerald-500/80" style={{ width: `${pPct}%` }} />
        )}
        <div className="flex-1 bg-zinc-700/30" />
        {nPct > 0 && (
          <div className="bg-red-500/80" style={{ width: `${nPct}%` }} />
        )}
      </div>
      <span className="text-[10px] text-zinc-500 w-10 text-right shrink-0">
        {item.count}
      </span>
    </div>
  );
}

function SegmentCard({ label, items }: { label: string; items: SegmentItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
      <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        {label}
      </h4>
      <div className="space-y-0.5">
        {items.slice(0, 8).map((item) => (
          <MiniBar key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function DemographicBreakdown({ segments }: { segments: AllSegments | null }) {
  if (!segments) return null;

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-4">
        Breakdowns Demograficos
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(segments).map(([key, items]) => (
          <SegmentCard
            key={key}
            label={SEGMENT_LABELS[key] || key}
            items={items as SegmentItem[]}
          />
        ))}
      </div>
    </div>
  );
}
