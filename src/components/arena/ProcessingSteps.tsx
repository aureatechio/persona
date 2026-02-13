'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
}

const STEP_DEFINITIONS = [
  { id: 'load', label: 'Carregando personas...' },
  { id: 'topics', label: 'Detectando temas...' },
  { id: 'ideology', label: 'Análise ideológica 2D...' },
  { id: 'quadrants', label: 'Mapeando quadrantes...' },
  { id: 'regions', label: 'Análise regional...' },
  { id: 'generations', label: 'Perfil geracional...' },
  { id: 'education', label: 'Modulação por escolaridade...' },
  { id: 'figures', label: 'Detecção de figuras políticas...' },
  { id: 'ai', label: 'Gerando comentários (Claude + GPT-4o)...' },
  { id: 'consolidate', label: 'Consolidando resultados...' },
];

export function ProcessingSteps({ progress }: { progress: number }) {
  const [steps, setSteps] = useState<ProcessingStep[]>(
    STEP_DEFINITIONS.map(s => ({ ...s, status: 'pending' as const }))
  );

  useEffect(() => {
    // Map progress (0-1) to which steps are complete
    const totalSteps = STEP_DEFINITIONS.length;
    const stepsComplete = Math.floor(progress * totalSteps);

    setSteps(prev =>
      prev.map((step, idx) => ({
        ...step,
        status: idx < stepsComplete ? 'done' : idx === stepsComplete ? 'active' : 'pending',
      }))
    );
  }, [progress]);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 ${
              step.status === 'done'
                ? 'bg-emerald-500/5 border border-emerald-500/10'
                : step.status === 'active'
                  ? 'bg-violet-500/5 border border-violet-500/15'
                  : 'bg-transparent border border-transparent'
            }`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Icon */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {step.status === 'done' ? (
                <Check size={14} className="text-emerald-400" />
              ) : step.status === 'active' ? (
                <Loader2 size={14} className="text-violet-400 animate-spin" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              )}
            </div>

            {/* Label */}
            <span className={`text-xs font-medium transition-colors duration-300 ${
              step.status === 'done'
                ? 'text-emerald-400/80'
                : step.status === 'active'
                  ? 'text-violet-300'
                  : 'text-zinc-700'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
