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

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 size={12} className="text-amber-400 animate-spin" />;
    case 'complete':
      return <CheckCircle2 size={12} className="text-emerald-400" />;
    case 'error':
      return <AlertCircle size={12} className="text-red-400" />;
    default:
      return <Circle size={12} className="text-zinc-700" />;
  }
}

export default function CalibrationPipeline() {
  const { steps, selectedStep, selectStep, progress, batches } = useCalibrationStore();

  return (
    <div className="space-y-0.5 p-3">
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-3 px-2">
        Pipeline de Producao
      </h3>
      {PIPELINE_STEPS.map((stepDef, idx) => {
        const step = steps[stepDef.id];
        if (!step) return null;
        const isSelected = selectedStep === stepDef.id;
        const IconComp = ICON_MAP[stepDef.icon] || Circle;

        let sublabel = '';
        if (stepDef.id === 'persona_loop' && progress.total > 0) {
          sublabel = `${progress.processed}/${progress.total} | ${batches.length} batches`;
        }
        if (step.latencyMs) {
          sublabel += sublabel ? ` | ${step.latencyMs}ms` : `${step.latencyMs}ms`;
        }

        return (
          <div key={stepDef.id}>
            {idx > 0 && (
              <div className="flex justify-center py-0.5">
                <div className={`w-px h-2 ${step.status === 'idle' ? 'bg-zinc-800/30' : 'bg-emerald-500/20'}`} />
              </div>
            )}
            <button
              onClick={() => selectStep(isSelected ? null : stepDef.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-white/[0.08] border border-white/[0.12]'
                  : 'hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${
                step.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400'
                  : step.status === 'running' ? 'bg-amber-500/10 text-amber-400'
                  : step.status === 'error' ? 'bg-red-500/10 text-red-400'
                  : 'bg-zinc-800/50 text-zinc-600'
              }`}>
                <IconComp size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${step.status === 'idle' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                  {step.label}
                </p>
                {sublabel && <p className="text-[10px] text-zinc-600">{sublabel}</p>}
              </div>
              <StatusIcon status={step.status} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
