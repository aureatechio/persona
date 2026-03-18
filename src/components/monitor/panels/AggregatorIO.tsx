'use client';

import { cn } from '@/lib/utils';
import {
  scoreToEmoji,
  scoreToColor,
  scoreToLabel,
} from '@/lib/arena/types';
import type { AllSegments, SegmentItem } from '@/lib/arena/segments';
import { InputSection, OutputSection, DataField } from './IOWrapper';

const SEGMENT_LABELS: Record<string, string> = {
  gender: 'Genero',
  religion: 'Religiao',
  race: 'Raca/Cor',
  region: 'Regiao',
  generation: 'Geracao',
  socialClass: 'Classe Social',
  education: 'Escolaridade',
  politicalLeaning: 'Posicao Politica',
  voto2022: 'Voto 2022',
  aprovacaoLula: 'Aprovacao Lula',
  voto2026: 'Voto 2026',
  archetype: 'Arquetipo',
  clusterMacro: 'Cluster Macro',
  scoreEco: 'Eixo Economico',
  scoreCost: 'Eixo Costumes',
};

function scoreToBarHex(score: number): string {
  if (score <= 2) return '#fb7185';
  if (score <= 4) return '#fb923c';
  if (score <= 6) return '#fbbf24';
  if (score <= 8) return '#34d399';
  return '#6ee7b7';
}

function SegmentCategory({
  label,
  items,
  maxCount,
}: {
  label: string;
  items: SegmentItem[];
  maxCount: number;
}) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 group">
            <span className="text-xs text-zinc-400 w-32 truncate shrink-0">
              {item.label}
            </span>
            <span className="text-xs text-zinc-600 w-8 text-right tabular-nums shrink-0">
              {item.count}
            </span>
            <div className="flex-1 h-4 bg-zinc-900/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${maxCount > 0 ? (item.count / maxCount) * 100 : 0}%`,
                  background: scoreToBarHex(item.avgScore),
                }}
              />
            </div>
            <span
              className={cn(
                'text-sm font-bold tabular-nums w-14 text-right shrink-0',
                scoreToColor(item.avgScore),
              )}
            >
              {scoreToEmoji(item.avgScore)} {item.avgScore.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AggregatorIO({
  progress,
  avgScore,
  segments,
}: {
  progress: {
    processed: number;
    total: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  avgScore: number;
  segments: AllSegments | null;
}) {
  return (
    <div className="space-y-4">
      {/* ── INPUT ── */}
      <InputSection>
        <DataField
          label="Dados brutos"
          value={`${progress.processed.toLocaleString('pt-BR')} respostas brutas de personas`}
        />
      </InputSection>

      {/* ── OUTPUT ── */}
      <OutputSection>
        {/* Stats summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="Total processado"
            value={`${progress.processed.toLocaleString('pt-BR')}/${progress.total.toLocaleString('pt-BR')}`}
            color="text-white"
          />
          <StatCard
            label="Positivos"
            value={progress.positive.toLocaleString('pt-BR')}
            color="text-emerald-400"
          />
          <StatCard
            label="Negativos"
            value={progress.negative.toLocaleString('pt-BR')}
            color="text-rose-400"
          />
          <StatCard
            label="Neutros"
            value={progress.neutral.toLocaleString('pt-BR')}
            color="text-amber-400"
          />
          {avgScore > 0 && (
            <StatCard
              label={scoreToLabel(avgScore)}
              value={`${scoreToEmoji(avgScore)} ${avgScore.toFixed(1)}`}
              color={scoreToColor(avgScore)}
            />
          )}
        </div>

        {/* Segments display */}
        {segments && <SegmentsDisplay segments={segments} />}
      </OutputSection>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
      <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mt-1">
        {label}
      </p>
    </div>
  );
}

function SegmentsDisplay({ segments }: { segments: AllSegments }) {
  const categories = Object.entries(segments).filter(
    ([, items]) => items && items.length > 0,
  ) as [string, SegmentItem[]][];

  if (categories.length === 0) return null;

  const maxCount = Math.max(
    ...categories.flatMap(([, items]) => items.map((i) => i.count)),
  );

  return (
    <div className="space-y-5 mt-4">
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Segmentos demograficos
      </span>
      {categories.map(([key, items]) => (
        <SegmentCategory
          key={key}
          label={SEGMENT_LABELS[key] || key}
          items={items}
          maxCount={maxCount}
        />
      ))}
    </div>
  );
}
