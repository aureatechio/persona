// Arena PWA — AnalysisProgressLoader (exact match of mobile)
// Multi-stage loading with orbiting dot, progress bar, stage dots

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Target, Brain, Zap, Sparkles } from 'lucide-react';

const STAGES = [
  { label: 'Processando dados demográficos...', icon: Activity, pct: 15 },
  { label: 'Analisando performance do conteúdo...', icon: Activity, pct: 35 },
  { label: 'Calculando oportunidades por segmento...', icon: Target, pct: 55 },
  { label: 'Gerando recomendações estratégicas...', icon: Brain, pct: 75 },
  { label: 'Montando plano de ação...', icon: Zap, pct: 90 },
  { label: 'Finalizando análise...', icon: Sparkles, pct: 97 },
];

const DURATIONS = [2000, 2500, 3000, 3500, 4000, 8000];

export function AnalysisProgressLoader() {
  const [stageIdx, setStageIdx] = useState(0);
  const [smoothPct, setSmoothPct] = useState(0);

  // Stage advancement
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const advance = () => {
      setStageIdx((prev) => {
        const next = Math.min(prev + 1, STAGES.length - 1);
        if (next < STAGES.length - 1) timeout = setTimeout(advance, DURATIONS[next] || 3000);
        return next;
      });
    };
    timeout = setTimeout(advance, DURATIONS[0]);
    return () => clearTimeout(timeout);
  }, []);

  // Smooth percentage
  useEffect(() => {
    const target = STAGES[stageIdx].pct;
    const interval = setInterval(() => {
      setSmoothPct((prev) => {
        if (prev >= target) { clearInterval(interval); return target; }
        return prev + 0.5;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [stageIdx]);

  const stage = STAGES[stageIdx];
  const StageIcon = stage.icon;

  return (
    <div className="flex flex-col items-center justify-center gap-5 px-10 h-full">
      {/* Icon with orbiting dot */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <StageIcon size={32} className="text-emerald-400" />
          </motion.div>
        </div>
        <motion.div
          className="absolute w-24 h-24"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute top-0 left-1/2 -ml-1 w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
        </motion.div>
      </div>

      {/* Stage label */}
      <p className="text-[13px] font-semibold text-zinc-300 text-center">{stage.label}</p>

      {/* Progress bar */}
      <div className="w-full max-w-[280px] space-y-1.5">
        <div className="h-2 rounded overflow-hidden" style={{ backgroundColor: '#18181b', border: '0.5px solid rgba(255,255,255,0.04)' }}>
          <div className="h-full rounded bg-emerald-400 transition-all duration-300" style={{ width: `${smoothPct}%` }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-zinc-700 tabular-nums">{Math.round(smoothPct)}%</span>
          <span className="text-[10px] text-zinc-700">Etapa {stageIdx + 1}/{STAGES.length}</span>
        </div>
      </div>

      {/* Stage dots */}
      <div className="flex gap-1.5">
        {STAGES.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === stageIdx ? 16 : 6,
              backgroundColor: i <= stageIdx ? '#34d399' : '#27272a',
            }}
          />
        ))}
      </div>
    </div>
  );
}
