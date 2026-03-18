'use client';

import { Eye, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NODE_ICONS, NODE_LABELS, NODE_DESCRIPTIONS } from './types';
import type { PipelineState, NodeStatus } from './types';
import { LogStream } from './LogStream';
import { ContextExtractionIO } from './panels/ContextExtractionIO';
import { QueryAnalyzerIO } from './panels/QueryAnalyzerIO';
import { WebResearchIO } from './panels/WebResearchIO';
import { ContextBuilderIO } from './panels/ContextBuilderIO';
import { ContextValidatorIO } from './panels/ContextValidatorIO';
import { PersonaLoaderIO } from './panels/PersonaLoaderIO';
import { PersonaLoopIO } from './panels/PersonaLoopIO';
import { AggregatorIO } from './panels/AggregatorIO';

/* ── Step Header ── */

function StepHeader({ nodeKey, status }: { nodeKey: string; status: NodeStatus }) {
  const statusLabel = {
    idle: 'Aguardando',
    running: 'Executando...',
    complete: 'Concluido',
    error: 'Erro',
    skipped: 'Pulado',
  }[status];

  const statusColor = {
    idle: 'text-zinc-500 bg-zinc-800/50 border-zinc-700/30',
    running: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    complete: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
    skipped: 'text-zinc-500 bg-zinc-800/50 border-zinc-700/30',
  }[status];

  return (
    <div className="flex items-center gap-4 pb-5 border-b border-white/[0.06]">
      <div className={cn(
        'w-12 h-12 rounded-2xl flex items-center justify-center',
        status === 'running' ? 'bg-violet-500/15 text-violet-400' :
        status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
        status === 'error' ? 'bg-red-500/10 text-red-400' :
        'bg-zinc-800/50 text-zinc-500',
      )}>
        {NODE_ICONS[nodeKey]}
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-bold text-white tracking-tight">{NODE_LABELS[nodeKey]}</h2>
        <p className="text-sm text-zinc-400">{NODE_DESCRIPTIONS[nodeKey]}</p>
      </div>
      <span className={cn('text-xs font-semibold px-3 py-1.5 rounded-full border', statusColor)}>
        {statusLabel}
      </span>
    </div>
  );
}

/* ── Main Step Detail Panel ── */

export function StepDetailPanel({
  state,
  selectedNode,
}: {
  state: PipelineState;
  selectedNode: string | null;
}) {
  // No node selected — show prompt
  if (!selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-4">
          <Eye size={28} className="text-zinc-700" />
        </div>
        <p className="text-base font-semibold text-zinc-500">Selecione um step no fluxo</p>
        <p className="text-sm text-zinc-600 mt-2 max-w-sm leading-relaxed">
          Clique em qualquer etapa do pipeline para ver os detalhes do que entrou e saiu daquele step.
        </p>
      </div>
    );
  }

  const nodeStatus = state.nodes[selectedNode];

  // Skipped step
  if (nodeStatus === 'skipped') {
    return (
      <div className="p-6 space-y-6">
        <StepHeader nodeKey={selectedNode} status={nodeStatus} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-4">
            <Minus size={24} className="text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500 font-medium">{NODE_LABELS[selectedNode]}</p>
          <p className="text-xs text-zinc-600 mt-2 max-w-xs leading-relaxed">
            Step pulado — o pipeline decidiu que esta etapa nao era necessaria para esta execucao.
          </p>
        </div>
        <LogStream logs={state.logs} selectedNode={selectedNode} />
      </div>
    );
  }

  // Idle step with no data yet
  if (nodeStatus === 'idle') {
    return (
      <div className="p-6 space-y-6">
        <StepHeader nodeKey={selectedNode} status={nodeStatus} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-4">
            {NODE_ICONS[selectedNode] || <Eye size={24} className="text-zinc-700" />}
          </div>
          <p className="text-sm text-zinc-500 font-medium">Aguardando execucao</p>
          <p className="text-xs text-zinc-600 mt-2 max-w-xs leading-relaxed">
            Os detalhes deste step aparecerao quando o pipeline executar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <StepHeader nodeKey={selectedNode} status={nodeStatus} />

      {/* IO Panel per step */}
      {selectedNode === 'contextExtraction' && state.contextExtraction && (
        <ContextExtractionIO data={state.contextExtraction} question={state.question} />
      )}

      {selectedNode === 'queryAnalyzer' && state.stepDetails.queryAnalyzer && (
        <QueryAnalyzerIO
          data={state.stepDetails.queryAnalyzer}
          question={state.question}
          corePoint={state.corePoint}
        />
      )}

      {selectedNode === 'webResearch' && state.stepDetails.webResearch && (
        <WebResearchIO data={state.stepDetails.webResearch} />
      )}

      {selectedNode === 'contextBuilder' && state.stepDetails.context && (
        <ContextBuilderIO data={state.stepDetails.context} />
      )}

      {selectedNode === 'contextValidator' && (
        <ContextValidatorIO
          data={state.stepDetails.validator}
          contextData={state.stepDetails.context}
          ideologicalFrame={state.stepDetails.ideologicalFrame}
        />
      )}

      {selectedNode === 'personaLoader' && state.progress.total > 0 && (
        <PersonaLoaderIO total={state.progress.total} />
      )}

      {selectedNode === 'personaLoop' && (
        <PersonaLoopIO
          promptSample={state.stepDetails.promptSample}
          batches={state.batches}
        />
      )}

      {selectedNode === 'aggregator' && (
        <AggregatorIO
          progress={state.progress}
          avgScore={state.avgScore}
          segments={state.segments}
        />
      )}

      {/* Running but no data yet */}
      {nodeStatus === 'running' && !hasStepData(selectedNode, state) && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3 animate-pulse">
            {NODE_ICONS[selectedNode]}
          </div>
          <p className="text-sm text-zinc-400">Processando...</p>
        </div>
      )}

      {/* Inline logs for this step */}
      <LogStream logs={state.logs} selectedNode={selectedNode} />
    </div>
  );
}

function hasStepData(key: string, state: PipelineState): boolean {
  if (key === 'contextExtraction') return !!state.contextExtraction;
  if (key === 'queryAnalyzer') return !!state.stepDetails.queryAnalyzer;
  if (key === 'webResearch') return !!state.stepDetails.webResearch;
  if (key === 'contextBuilder') return !!state.stepDetails.context;
  if (key === 'contextValidator') return !!(state.stepDetails.validator || state.stepDetails.context || state.stepDetails.ideologicalFrame);
  if (key === 'personaLoader') return state.progress.total > 0;
  if (key === 'personaLoop') return state.batches.length > 0 || !!state.stepDetails.promptSample;
  if (key === 'aggregator') return state.progress.processed > 0;
  return false;
}
