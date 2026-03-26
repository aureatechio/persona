'use client';

interface Props {
  avgScore: number;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 6) return 'text-emerald-500/70';
  if (score <= 3) return 'text-red-400';
  if (score <= 4) return 'text-red-500/70';
  return 'text-zinc-400';
}

function scoreLabel(score: number): string {
  if (score >= 8) return 'Muito a Favor';
  if (score >= 7) return 'A Favor';
  if (score >= 6) return 'Levemente a Favor';
  if (score <= 2) return 'Muito Contra';
  if (score <= 3) return 'Contra';
  if (score <= 4) return 'Levemente Contra';
  return 'Neutro / Dividido';
}

function scoreBgColor(score: number): string {
  if (score >= 7) return 'bg-emerald-500';
  if (score >= 6) return 'bg-emerald-600/70';
  if (score <= 3) return 'bg-red-500';
  if (score <= 4) return 'bg-red-600/70';
  return 'bg-zinc-500';
}

export default function SentimentGauge({ avgScore, positive, negative, neutral, total }: Props) {
  if (total === 0) return null;

  const scorePercent = (avgScore / 10) * 100;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
      {/* Score Hero */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
            Score Geral de Sentimento
          </h3>
          <p className={`text-sm font-medium ${scoreColor(avgScore)}`}>
            {scoreLabel(avgScore)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-5xl font-bold tracking-tight ${scoreColor(avgScore)}`}>
            {avgScore.toFixed(1)}
          </p>
          <p className="text-xs text-zinc-600">de 10</p>
        </div>
      </div>

      {/* Score bar 0-10 */}
      <div className="relative mb-5">
        <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800/50">
          <div
            className={`${scoreBgColor(avgScore)} rounded-full transition-all duration-500`}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
          <span>0 Contra</span>
          <span>5 Neutro</span>
          <span>10 A Favor</span>
        </div>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{positive.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
            A Favor (6-10)
          </p>
          <p className="text-xs text-emerald-400/70 mt-0.5">
            {total > 0 ? Math.round((positive / total) * 100) : 0}%
          </p>
        </div>
        <div className="bg-zinc-800/20 border border-zinc-700/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-400">{neutral.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Neutro (4-6)
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {total > 0 ? Math.round((neutral / total) * 100) : 0}%
          </p>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{negative.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Contra (0-4)
          </p>
          <p className="text-xs text-red-400/70 mt-0.5">
            {total > 0 ? Math.round((negative / total) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.06] text-center">
        <p className="text-xs text-zinc-500">
          {total.toLocaleString()} personas analisadas
        </p>
      </div>
    </div>
  );
}
