'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PipelineNode, FlowArrow } from './PipelineNode';
import { nodeOrder, NODE_LABELS } from './types';
import type { PipelineState } from './types';

export function PipelineSidebar({
  state,
  selectedNode,
  onSelectNode,
  logCountFor,
  lastLogFor,
  nodeHasDetail,
}: {
  state: PipelineState;
  selectedNode: string | null;
  onSelectNode: (key: string) => void;
  logCountFor: (key: string) => number;
  lastLogFor: (key: string) => string | undefined;
  nodeHasDetail: (key: string) => boolean;
}) {
  const getPreview = (key: string): string | undefined => {
    if (key === 'contextExtraction' && state.contextExtraction?.corePoint) {
      return state.contextExtraction.corePoint;
    }
    if (key === 'queryAnalyzer' && state.stepDetails.queryAnalyzer) {
      return state.stepDetails.queryAnalyzer.needs_research ? 'Pesquisa necessaria' : 'Pesquisa dispensada';
    }
    if (key === 'webResearch' && state.stepDetails.webResearch) {
      return `${state.stepDetails.webResearch.snippets?.length || 0} trechos de ${state.stepDetails.webResearch.sources?.length || 0} fontes`;
    }
    if (key === 'contextBuilder' && state.stepDetails.context?.tema) {
      return state.stepDetails.context.tema;
    }
    if (key === 'contextValidator' && state.stepDetails.validator) {
      return `Veredicto: ${state.stepDetails.validator.verdict}`;
    }
    if (key === 'personaLoader' && state.progress.total > 0) {
      return `${state.progress.total.toLocaleString('pt-BR')} personas`;
    }
    if (key === 'personaLoop' && state.progress.processed > 0) {
      return `${state.progress.processed.toLocaleString('pt-BR')}/${state.progress.total.toLocaleString('pt-BR')} processadas`;
    }
    if (key === 'aggregator' && state.nodes.aggregator === 'complete') {
      return `${state.progress.positive} a favor, ${state.progress.negative} contra`;
    }
    return undefined;
  };

  return (
    <div className="w-96 shrink-0 border-r border-white/[0.06] bg-zinc-950/40 overflow-y-auto py-5 px-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 px-2 mb-4">
        Fluxo do Pipeline
      </p>

      {nodeOrder.map((key, i) => (
        <div key={key}>
          <PipelineNode
            nodeKey={key}
            status={state.nodes[key]}
            logCount={logCountFor(key)}
            lastLogMessage={lastLogFor(key)}
            isSelected={selectedNode === key}
            onClick={() => onSelectNode(key)}
            hasDetail={nodeHasDetail(key)}
            preview={getPreview(key)}
            extra={
              <>
                {/* Progress bar for persona loop */}
                {key === 'personaLoop' && state.progress.total > 0 && (
                  <div className="mt-3 pl-[52px]">
                    <div className="h-2 rounded-full bg-zinc-900/80 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.round((state.progress.processed / state.progress.total) * 100)}%`,
                          background: 'linear-gradient(90deg, rgb(139,92,246), rgb(236,72,153))',
                        }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 tabular-nums">
                      {state.progress.processed.toLocaleString('pt-BR')}/{state.progress.total.toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}

                {/* Ideological frame indicator on validator node */}
                {key === 'contextValidator' && state.stepDetails.ideologicalFrame && (
                  <div className="mt-2 ml-[52px] px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-violet-400" />
                    <span className="text-xs font-semibold text-violet-400">Vies Ideologico Mapeado</span>
                  </div>
                )}
              </>
            }
          />
          {i < nodeOrder.length - 1 && (
            <FlowArrow active={state.nodes[key] === 'complete' || state.nodes[key] === 'running'} />
          )}
        </div>
      ))}
    </div>
  );
}
