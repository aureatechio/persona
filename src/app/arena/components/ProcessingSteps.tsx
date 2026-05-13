// Arena PWA — Processing steps (collecting phase + progress bar)

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Brain, Search, Globe, Users, Zap, Check, Square } from 'lucide-react';
import { STATE_NAMES, displayPersonaCount } from '../constants';

function buildSteps(region?: string, totalCount?: number) {
  const isFiltered = region && region !== 'brasil';
  const stateLabel = isFiltered ? (STATE_NAMES[region!] || region) : null;

  let loadingSublabel: string;
  if (isFiltered) {
    loadingSublabel = totalCount && totalCount > 0
      ? `Rodando análise nas ${displayPersonaCount(totalCount).toLocaleString('pt-BR')} personas de ${stateLabel}`
      : `Filtrando personas de ${stateLabel}...`;
  } else {
    loadingSublabel = totalCount && totalCount > 0
      ? `Rodando análise nas ${displayPersonaCount(totalCount).toLocaleString('pt-BR')} personas`
      : 'Rodando análise nas personas';
  }

  return [
    { id: 'analyzing', icon: Brain, label: 'Interpretando seu conteúdo', sublabel: 'Identificando narrativa, tom e intenção', color: '#8b5cf6' },
    { id: 'researching', icon: Search, label: 'Cruzando com comportamento eleitoral', sublabel: 'Comparando com padrões reais de voto', color: '#38bdf8' },
    { id: 'context', icon: Globe, label: 'Projetando reação do público', sublabel: 'Simulando aceitação por perfil ideológico', color: '#34d399' },
    { id: 'loading', icon: Users, label: 'Ativando base de eleitores', sublabel: loadingSublabel, color: '#fbbf24' },
  ] as const;
}

type CollectingStatus = 'analyzing' | 'researching' | 'context' | 'loading';
const STATUS_ORDER: CollectingStatus[] = ['analyzing', 'researching', 'context', 'loading'];

interface ProcessingStepsProps {
  phase: 'collecting' | 'streaming' | 'aggregating' | 'complete';
  processedCount: number;
  totalCount: number;
  collectingStatus?: string;
  onCancel?: () => void;
  region?: string;
  analiseLoading?: boolean;
}

function PulsingDots({ color }: { color: string }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export function ProcessingSteps({ phase, processedCount, totalCount, collectingStatus, onCancel, region, analiseLoading }: ProcessingStepsProps) {
  const personaProgress = totalCount > 0 ? processedCount / totalCount : 0;
  const personasDone = phase === 'complete' || phase === 'aggregating' || personaProgress >= 0.99;
  // Analysis is truly finished only when we HAVE the analise data
  const analysisTrulyDone = personasDone && !analiseLoading && analiseLoading !== undefined;

  // Smooth progress: personas = 0-70%, Duda analysis = 70-99%, done = 100%
  // NEVER hits 100% until analiseData is received by parent (component unmounts)
  const [displayProgress, setDisplayProgress] = useState(0);
  const analysisTicker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Phase 1: personas processing (0→70%)
    if (!personasDone) {
      const target = personaProgress * 0.7;
      setDisplayProgress((prev) => Math.max(prev, target));
      return;
    }

    // Phase 2: personas done → specialists + Duda running (70→99% over ~60s)
    // Smooth deceleration: moves steadily, slows near end, NEVER stops
    if (personasDone) {
      if (!analysisTicker.current) {
        setDisplayProgress((prev) => Math.max(prev, 0.7));
        const startTime = Date.now();
        analysisTicker.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000; // seconds since phase 2 started
          setDisplayProgress((prev) => {
            if (prev < 0.70) return 0.70;
            // Logarithmic curve: fast start, smooth deceleration
            // At 10s: ~82%, 20s: ~88%, 30s: ~92%, 40s: ~95%, 60s: ~97%, 120s: ~99%
            const target = 0.70 + 0.29 * (1 - 1 / (1 + elapsed / 15));
            return Math.max(prev, Math.min(target, 0.99));
          });
        }, 200);
      }
      return () => {
        if (analysisTicker.current) { clearInterval(analysisTicker.current); analysisTicker.current = null; }
      };
    }
  }, [personasDone, personaProgress]);

  // Reset on new analysis
  useEffect(() => {
    if (processedCount === 0 && totalCount === 0) {
      setDisplayProgress(0);
      if (analysisTicker.current) clearInterval(analysisTicker.current);
    }
  }, [processedCount, totalCount]);

  const progress = displayProgress;

  // Collecting phase: show pipeline steps
  if (phase === 'collecting') {
    const currentIdx = STATUS_ORDER.indexOf((collectingStatus || 'analyzing') as CollectingStatus);
    const STEPS = buildSteps(region, totalCount);

    return (
      <div className="w-full py-2">
        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/[0.08] border border-rose-500/20 mb-3 ml-auto active:scale-95 transition-all duration-200"
          >
            <Square size={12} className="text-rose-400" />
            <span className="text-xs font-semibold text-rose-400">Parar</span>
          </button>
        )}

        {/* Header with spinner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2.5 mb-3"
        >
          <div className="w-9 h-9 relative flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 border-r-emerald-400/25"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-[5px] rounded-full border border-transparent border-t-violet-400 border-r-violet-400/25"
              animate={{ rotate: -360 }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            />
            <Zap size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-white tracking-tight">Simulando impacto eleitoral</p>
            <p className="text-[11px] text-zinc-500">Prevendo como cada perfil vai reagir</p>
          </div>
        </motion.div>

        {/* Steps */}
        <div className="space-y-1.5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            const isPending = i > currentIdx;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: isPending ? 0.35 : 1, y: 0 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl border transition-all duration-300 ${
                  isActive
                    ? 'border-white/[0.08] bg-white/[0.03]'
                    : isDone
                      ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                }`}
                style={isActive ? { borderColor: `${step.color}40`, backgroundColor: `${step.color}08` } : undefined}
              >
                {/* Badge */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                  isDone ? 'bg-emerald-500/15 text-emerald-400' :
                  isActive ? 'text-white' : 'bg-white/[0.04] text-zinc-600'
                }`}
                  style={isActive ? { backgroundColor: `${step.color}20`, color: step.color } : undefined}
                >
                  {isDone ? <Check size={11} /> : i + 1}
                </div>

                {/* Icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? '' : 'bg-white/[0.03]'
                }`}
                  style={isActive ? { backgroundColor: `${step.color}15` } : undefined}
                >
                  <Icon size={14} style={{ color: isDone ? '#34d399' : isActive ? step.color : '#52525b' }} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold leading-tight ${
                    isDone ? 'text-emerald-400' :
                    isActive ? 'text-white' : 'text-zinc-500'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-[9px] leading-tight mt-0.5 ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {isDone ? 'Concluído' : step.sublabel}
                  </p>
                </div>

                {/* Status */}
                <div className="w-8 flex justify-end shrink-0">
                  {isDone && <Check size={12} className="text-emerald-400" />}
                  {isActive && <PulsingDots color={step.color} />}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Streaming / aggregating: show progress
  return (
    <div className="flex flex-col items-center py-2 gap-3 w-full">
      {onCancel && (
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/[0.08] border border-rose-500/20 ml-auto active:scale-95 transition-all duration-200"
        >
          <Square size={12} className="text-rose-400" />
          <span className="text-xs font-semibold text-rose-400">Parar</span>
        </button>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2"
      >
        <div className="w-3 h-3 rounded-full bg-emerald-400/30 flex items-center justify-center">
          <div className="w-[7px] h-[7px] rounded-full bg-emerald-400" />
        </div>
        <span className="text-[11px] font-black text-emerald-400 tracking-[2px]">
          {personasDone ? 'GERANDO ANÁLISE' : 'ANALISANDO'}
        </span>
      </motion.div>

      <p className="text-[11px] text-zinc-500 text-center">
        {personasDone
          ? 'Consultores analisando e montando recomendações...'
          : !region || region === 'brasil'
            ? 'Analisando todas as pessoas do Brasil...'
            : `Analisando ${totalCount > 0 ? displayPersonaCount(totalCount).toLocaleString('pt-BR') + ' ' : ''}pessoas de ${STATE_NAMES[region] || region}...`}
      </p>

      {/* Progress bar */}
      <div className="w-full h-2 rounded bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded bg-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <span className="text-lg font-black text-emerald-400 tabular-nums">
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
}
