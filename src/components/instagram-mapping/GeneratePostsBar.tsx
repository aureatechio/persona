'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Brain,
  CheckCircle2,
  Database,
  FileText,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

type GenerateState = 'idle' | 'generating' | 'done';

interface GeneratePostsBarProps {
  accountId: string;
  followerCount: number;
  onGenerated: (results: unknown[]) => void;
}

const STEPS = [
  { label: 'Analisando perfis de seguidores...', icon: Users },
  { label: 'Cruzando categorias com banco de dados...', icon: Database },
  { label: 'Gerando postagens personalizadas...', icon: FileText },
  { label: 'Finalizando...', icon: Zap },
];

export function GeneratePostsBar({ accountId, followerCount, onGenerated }: GeneratePostsBarProps) {
  const [state, setState] = useState<GenerateState>('idle');
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [resultCount, setResultCount] = useState(0);

  const handleGenerate = useCallback(async () => {
    setState('generating');
    setActiveStep(0);
    setProgress(0);

    // Animated progress stages
    const stepDurations = [800, 900, 1000, 600];
    let currentStep = 0;

    for (const duration of stepDurations) {
      setActiveStep(currentStep);
      const targetProgress = ((currentStep + 1) / STEPS.length) * 90;

      // Animate progress to target
      const startProgress = currentStep === 0 ? 0 : ((currentStep) / STEPS.length) * 90;
      const increment = (targetProgress - startProgress) / (duration / 50);
      let currentProgress = startProgress;

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          currentProgress += increment;
          if (currentProgress >= targetProgress) {
            currentProgress = targetProgress;
            clearInterval(interval);
            resolve();
          }
          setProgress(Math.round(currentProgress));
        }, 50);
      });

      currentStep++;
    }

    // Now call the actual API
    try {
      const res = await fetch('/api/instagram-mapping/generate-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();

      setProgress(100);
      setResultCount(data.results?.length || 0);

      await new Promise((resolve) => setTimeout(resolve, 300));
      setState('done');
      onGenerated(data.results || []);
    } catch {
      setState('idle');
    }
  }, [accountId, onGenerated]);

  // Reset when accountId changes
  useEffect(() => {
    setState('idle');
    setProgress(0);
    setActiveStep(0);
    setResultCount(0);
  }, [accountId]);

  if (state === 'idle') {
    return (
      <div className="sticky top-16 z-20">
        <div className={cn(
          'bg-zinc-950/90 backdrop-blur-2xl',
          'border border-white/[0.06]',
          'rounded-2xl p-4 md:p-5',
          'flex items-center justify-between gap-4',
          'shadow-xl shadow-black/30',
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white tracking-tight">Gerar Postagens</p>
              <p className="text-[11px] text-zinc-500">
                Criar posts personalizados para {followerCount} seguidores
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={followerCount === 0}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5',
              'bg-emerald-500 hover:bg-emerald-400',
              'text-black font-semibold text-sm',
              'rounded-xl',
              'shadow-lg shadow-emerald-500/25',
              'hover:shadow-emerald-400/30',
              'active:scale-[0.97]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Sparkles size={15} />
            Gerar agora
          </button>
        </div>
      </div>
    );
  }

  if (state === 'generating') {
    return (
      <div className="sticky top-16 z-20">
        <div className={cn(
          'relative bg-zinc-950/90 backdrop-blur-2xl',
          'border border-emerald-500/20',
          'rounded-2xl p-5 md:p-6',
          'shadow-xl shadow-black/30',
          'overflow-hidden',
        )}>
          {/* Ambient glows */}
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

          <div className="relative grid grid-cols-1 md:grid-cols-[140px_1fr] gap-6 items-center">
            {/* Spinner */}
            <div className="flex items-center justify-center">
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 rounded-full border border-emerald-400/20 animate-[spin_8s_linear_infinite]" />
                <div className="absolute inset-2 rounded-full border border-violet-400/15 animate-[spin_5s_linear_infinite_reverse]" />
                <div className="absolute inset-4 rounded-full border border-cyan-400/10 animate-[spin_3s_linear_infinite]" />
                <div className="absolute inset-0 grid place-content-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl grid place-content-center">
                    <Brain size={20} className="text-emerald-300 animate-pulse" />
                  </div>
                </div>
                {/* Orbiting dots */}
                <div className="absolute inset-0" style={{ ['--orbit-radius' as string]: '50px' }}>
                  <div className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-emerald-400 animate-[orbit_4s_linear_infinite]" />
                </div>
                <div className="absolute inset-0" style={{ ['--orbit-radius' as string]: '42px' }}>
                  <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-violet-400 animate-[orbit_3s_linear_infinite_reverse]" />
                </div>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold bg-gradient-to-r from-emerald-300 to-violet-300 bg-clip-text text-transparent">
                  Gerando postagens por IA
                </p>
                <span className="text-xs text-zinc-400 tabular-nums font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-violet-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="space-y-2.5">
                {STEPS.map((step, index) => {
                  const done = activeStep > index || progress > 95;
                  const active = activeStep === index && progress <= 95;
                  const StepIcon = step.icon;
                  return (
                    <div key={index} className="flex items-center gap-2.5">
                      <div className={cn(
                        'p-1 rounded-lg transition-all duration-300',
                        done ? 'bg-emerald-500/10 text-emerald-400' :
                        active ? 'bg-violet-500/10 text-violet-400' :
                        'text-zinc-600',
                      )}>
                        {done ? <CheckCircle2 size={13} /> : <StepIcon size={13} />}
                      </div>
                      <p className={cn(
                        'text-xs transition-colors duration-300',
                        done ? 'text-emerald-300' :
                        active ? 'text-violet-200' :
                        'text-zinc-600',
                      )}>
                        {step.label}
                      </p>
                      {active && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse ml-auto" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // state === 'done'
  return (
    <div className="sticky top-16 z-20">
      <div className={cn(
        'bg-zinc-950/90 backdrop-blur-2xl',
        'border border-emerald-500/20',
        'rounded-2xl p-4 md:p-5',
        'flex items-center justify-between gap-4',
        'shadow-xl shadow-black/30',
      )}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-300 tracking-tight">
              Postagens geradas com sucesso
            </p>
            <p className="text-[11px] text-zinc-500">
              {resultCount} postagens personalizadas criadas
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setState('idle');
            setProgress(0);
            setActiveStep(0);
          }}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2',
            'bg-white/[0.05] hover:bg-white/[0.1]',
            'text-zinc-300 hover:text-white',
            'border border-white/[0.08] hover:border-white/[0.15]',
            'rounded-xl text-xs font-medium',
            'active:scale-[0.97]',
            'transition-all duration-200',
          )}
        >
          Gerar novamente
        </button>
      </div>
    </div>
  );
}
