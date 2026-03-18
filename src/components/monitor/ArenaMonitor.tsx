'use client';

import { useMonitorEvents } from './useMonitorEvents';
import { ProgressHeader } from './ProgressHeader';
import { PipelineSidebar } from './PipelineSidebar';
import { StepDetailPanel } from './StepDetailPanel';

/* ================================================================
   ArenaMonitor — Passive listener that visualizes the Arena pipeline
   Receives events via BroadcastChannel from ArenaMode.tsx
   ================================================================ */

export function ArenaMonitor() {
  const {
    state,
    selectedNode,
    setSelectedNode,
    logCountFor,
    lastLogFor,
    nodeHasDetail,
  } = useMonitorEvents();

  const handleNodeClick = (key: string) => {
    setSelectedNode(selectedNode === key ? null : key);
  };

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* ─── Header with progress ─── */}
      <ProgressHeader state={state} />

      {/* ─── Main: Sidebar + Detail Panel ─── */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Pipeline flow */}
        <PipelineSidebar
          state={state}
          selectedNode={selectedNode}
          onSelectNode={handleNodeClick}
          logCountFor={logCountFor}
          lastLogFor={lastLogFor}
          nodeHasDetail={nodeHasDetail}
        />

        {/* Right: Step detail (INPUT/OUTPUT) */}
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50">
          <StepDetailPanel state={state} selectedNode={selectedNode} />
        </div>
      </div>
    </div>
  );
}
