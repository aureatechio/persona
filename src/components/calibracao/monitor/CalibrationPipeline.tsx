'use client';

import {
  useCalibrationStore,
  PIPELINE_STEPS,
  type StepStatus,
} from '@/app/calibracao/store';
import {
  Globe, Brain, Scale, Users, Search, FileText, Cpu, BarChart3,
  Loader2, CheckCircle2, Circle, AlertCircle, Image,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ size: number }>> = {
  Globe, Brain, Scale, Users, Search, FileText, Cpu, BarChart3, Image,
};

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
        Steps
      </p>
      <div className="space-y-0.5">
        {PIPELINE_STEPS.map((stepDef) => {
          const step = steps[stepDef.id];
          if (!step) return null;
          const isSelected = selectedStep === stepDef.id;
          const IconComp = ICON_MAP[stepDef.icon] || Circle;

          return (
            <button
              key={stepDef.id}
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
                {stepDef.label.replace('Construcao de ', '').replace('Carregamento de ', '').replace('Processamento de ', '').replace('Agregacao de ', '')}
              </span>
              <StatusDot status={step.status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
