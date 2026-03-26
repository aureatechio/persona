'use client';

import {
  useCalibrationStore,
  CAL_NODE_ORDER,
  CAL_NODE_LABELS,
} from '@/app/calibracao/store';
import type { NodeStatus } from '@/components/monitor/types';
import {
  MessageSquare, MapPin, Brain, Cpu, BarChart3, CheckCircle2,
  Loader2, Circle, AlertCircle,
} from 'lucide-react';
import { createElement } from 'react';

const NODE_ICONS: Record<string, React.ReactNode> = {
  queryReceived: createElement(MessageSquare, { size: 14 }),
  geoFilter: createElement(MapPin, { size: 14 }),
  preClassification: createElement(Brain, { size: 14 }),
  personaProcessing: createElement(Cpu, { size: 14 }),
  aggregation: createElement(BarChart3, { size: 14 }),
  results: createElement(CheckCircle2, { size: 14 }),
};

function StatusIcon({ status }: { status: NodeStatus }) {
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
  const { nodes, selectedNode, selectNode, progress } = useCalibrationStore();

  return (
    <div className="space-y-1 p-3">
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-3 px-2">
        Pipeline
      </h3>
      {CAL_NODE_ORDER.map((nodeId, idx) => {
        const status = nodes[nodeId] || 'idle';
        const isSelected = selectedNode === nodeId;
        const label = CAL_NODE_LABELS[nodeId] || nodeId;

        // Show batch count for persona processing
        let sublabel = '';
        if (nodeId === 'personaProcessing' && progress.total > 0) {
          sublabel = `${progress.processed}/${progress.total}`;
        }

        return (
          <div key={nodeId}>
            {idx > 0 && (
              <div className="flex justify-center py-0.5">
                <div
                  className={`w-px h-3 ${
                    status === 'idle' ? 'bg-zinc-800/50' : 'bg-emerald-500/30'
                  }`}
                />
              </div>
            )}
            <button
              onClick={() => selectNode(isSelected ? null : nodeId)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-white/[0.08] border border-white/[0.12]'
                  : 'hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  status === 'complete'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : status === 'running'
                      ? 'bg-amber-500/10 text-amber-400'
                      : status === 'error'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-zinc-800/50 text-zinc-600'
                }`}
              >
                {NODE_ICONS[nodeId]}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-medium truncate ${
                    status === 'idle' ? 'text-zinc-600' : 'text-zinc-300'
                  }`}
                >
                  {label}
                </p>
                {sublabel && (
                  <p className="text-[10px] text-zinc-600">{sublabel}</p>
                )}
              </div>
              <StatusIcon status={status} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
