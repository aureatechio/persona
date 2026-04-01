'use client';

import {
  useCalibrationStore,
  PIPELINE_STEPS,
  type StepStatus,
} from '@/app/calibracao/store';
import {
  Globe, Brain, Scale, Users, Search, FileText, Cpu, BarChart3,
  Loader2, CheckCircle2, Circle, AlertCircle, Image, Bot, Sparkles,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ size: number }>> = {
  Globe, Brain, Scale, Users, Search, FileText, Cpu, BarChart3, Image, Bot, Sparkles,
};

// Backend steps end at 'aggregation', frontend steps start after
const BACKEND_FRONTEND_BOUNDARY = 'aggregation';

function StatusDot({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':
      return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />;
    case 'complete':
      return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />;
    case 'error':
      return <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />;
    default:
      return <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0" />;
  }
}

export default function CalibrationPipeline() {
  const { steps, selectedStep, selectStep } = useCalibrationStore();

  return (
    <div className="py-3 px-2">
      <p className="text-[9px] font-medium uppercase tracking-widest text-zinc-700 px-2 mb-2">
        Pipeline
      </p>
      <div className="space-y-0.5">
        {PIPELINE_STEPS.map((stepDef, index) => {
          const step = steps[stepDef.id];
          if (!step) return null;
          const isSelected = selectedStep === stepDef.id;
          const IconComp = ICON_MAP[stepDef.icon] || Circle;

          // Insert separator between backend and frontend steps
          const prevStep = index > 0 ? PIPELINE_STEPS[index - 1] : null;
          const showSeparator = prevStep?.id === BACKEND_FRONTEND_BOUNDARY;

          return (
            <div key={stepDef.id}>
              {showSeparator && (
                <div className="py-2 px-2">
                  <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
                  <p className="text-[8px] font-medium uppercase tracking-widest text-zinc-700 text-center mt-1.5">
                    Pos-processamento
                  </p>
                </div>
              )}
              <button
                onClick={() => selectStep(isSelected ? null : stepDef.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all duration-150 ${
                  isSelected
                    ? 'bg-white/[0.08] border border-white/[0.1]'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className={`p-1 rounded-md shrink-0 ${
                  step.status === 'complete' ? 'text-emerald-400'
                    : step.status === 'running' ? 'text-amber-400'
                    : step.status === 'error' ? 'text-red-400'
                    : 'text-zinc-700'
                }`}>
                  <IconComp size={12} />
                </div>
                <span className={`text-[11px] leading-tight truncate flex-1 ${
                  step.status === 'idle' ? 'text-zinc-600' : 'text-zinc-300'
                }`}>
                  {stepDef.label}
                </span>
                <StatusDot status={step.status} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
