'use client';

interface HeroSentimentBarProps {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export function HeroSentimentBar({ positive, negative, neutral, total }: HeroSentimentBarProps) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const pctPos = pct(positive);
  const pctNeg = pct(negative);
  const pctNeu = pct(neutral);

  return (
    <div className="relative">
      {/* Subtle glow beneath */}
      <div className="absolute inset-x-0 -bottom-3 h-6 bg-gradient-to-r from-emerald-500/10 via-amber-500/5 to-rose-500/10 blur-xl rounded-full pointer-events-none" />

      {/* Bar */}
      <div className="h-10 sm:h-12 rounded-2xl overflow-hidden flex bg-zinc-900/80 border border-white/[0.06]">
        {/* Positive */}
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 flex items-center justify-center transition-all duration-[2500ms] ease-out"
          style={{ width: `${pctPos}%` }}
        >
          {pctPos > 10 && (
            <span className="text-xs sm:text-sm font-black text-white drop-shadow-sm">
              {pctPos}%
            </span>
          )}
        </div>

        {/* Neutral */}
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center transition-all duration-[2500ms] ease-out"
          style={{ width: `${pctNeu}%` }}
        >
          {pctNeu > 10 && (
            <span className="text-xs sm:text-sm font-black text-white drop-shadow-sm">
              {pctNeu}%
            </span>
          )}
        </div>

        {/* Negative */}
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-rose-400 flex items-center justify-center transition-all duration-[2500ms] ease-out"
          style={{ width: `${pctNeg}%` }}
        >
          {pctNeg > 10 && (
            <span className="text-xs sm:text-sm font-black text-white drop-shadow-sm">
              {pctNeg}%
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-between mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-zinc-400 font-medium">Concordam</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-zinc-400 font-medium">Neutros</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-[10px] text-zinc-400 font-medium">Discordam</span>
        </div>
      </div>
    </div>
  );
}
