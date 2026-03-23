// Arena PWA — Sentiment Bars (horizontal distribution)

'use client';

interface SentimentBarsProps {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export function SentimentBars({ positive, negative, neutral, total }: SentimentBarsProps) {
  if (total === 0) return null;

  const pctPos = Math.round((positive / total) * 100);
  const pctNeg = Math.round((negative / total) * 100);
  const pctNeu = Math.round((neutral / total) * 100);

  const items = [
    { label: 'Positivo', pct: pctPos, count: positive, color: '#34d399', bg: 'bg-emerald-400' },
    { label: 'Neutro', pct: pctNeu, count: neutral, color: '#fbbf24', bg: 'bg-amber-400' },
    { label: 'Negativo', pct: pctNeg, count: negative, color: '#fb7185', bg: 'bg-rose-400' },
  ];

  return (
    <div className="space-y-2.5">
      {/* Stacked bar */}
      <div className="h-2 flex rounded-full overflow-hidden bg-white/[0.04]">
        {pctPos > 0 && <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pctPos}%` }} />}
        {pctNeu > 0 && <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${pctNeu}%` }} />}
        {pctNeg > 0 && <div className="h-full bg-rose-400 transition-all duration-500" style={{ width: `${pctNeg}%` }} />}
      </div>

      {/* Legend */}
      <div className="flex justify-between">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${item.bg}`} />
            <span className="text-[10px] font-bold tabular-nums" style={{ color: item.color }}>
              {item.pct}%
            </span>
            <span className="text-[10px] text-zinc-500">{item.label}</span>
            <span className="text-[10px] text-zinc-600 tabular-nums">({item.count.toLocaleString('pt-BR')})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
