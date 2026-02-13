'use client';

export function DonutChart({ positive, negative, neutral, size = 200 }: {
  positive: number;
  negative: number;
  neutral: number;
  size?: number;
}) {
  const total = positive + negative + neutral;
  if (total === 0) return null;

  const radius = size / 2 - 24;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const pPos = positive / total;
  const pNeg = negative / total;

  const posLen = pPos * circumference;
  const negLen = pNeg * circumference;
  const neuLen = (1 - pPos - pNeg) * circumference;

  const posOff = 0;
  const negOff = posLen;
  const neuOff = posLen + negLen;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={28} />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#10b981" strokeWidth={28}
          strokeDasharray={`${posLen} ${circumference}`} strokeDashoffset={-posOff}
          strokeLinecap="round" className="transition-all duration-[2500ms] ease-out" />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f43f5e" strokeWidth={28}
          strokeDasharray={`${negLen} ${circumference}`} strokeDashoffset={-negOff}
          strokeLinecap="round" className="transition-all duration-[2500ms] ease-out" />
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f59e0b" strokeWidth={28}
          strokeDasharray={`${neuLen} ${circumference}`} strokeDashoffset={-neuOff}
          strokeLinecap="round" className="transition-all duration-[2500ms] ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-black text-white tabular-nums">{total.toLocaleString('pt-BR')}</p>
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">respostas</p>
      </div>
    </div>
  );
}
