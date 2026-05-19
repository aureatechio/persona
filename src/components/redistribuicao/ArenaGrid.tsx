'use client';

import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Users, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  REDISTRIBUTION_CANDIDATES,
  getWorkerStatus,
  getElection,
  type ElectionSnapshot,
} from '@/lib/arena-eleitoral/redistribution';
import { CandidateWarCard } from './CandidateWarCard';
import { RecalculatingOverlay } from './RecalculatingOverlay';

type Phase = 'waiting' | 'ready' | 'recalculating';

export function ArenaGrid() {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [workerProgress, setWorkerProgress] = useState({ loaded: 0, total: 0, voted: 0, status: 'idle' });
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set(REDISTRIBUTION_CANDIDATES.map((p) => p.id)));
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<ElectionSnapshot | null>(null);

  // Poll worker + load initial election
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const poll = async () => {
      try {
        const status = await getWorkerStatus();
        setWorkerProgress(status.progress);
        if (status.ready) {
          clearInterval(interval);
          const snap = await getElection();
          setSnapshot(snap);
          setPhase('ready');
        }
      } catch { /* retry */ }
    };
    poll();
    interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = useCallback(async (candidateId: string) => {
    const newActive = new Set(activeIds);
    if (newActive.has(candidateId)) {
      if (newActive.size <= 2) return;
      newActive.delete(candidateId);
    } else {
      newActive.add(candidateId);
    }

    setPhase('recalculating');
    setPrevSnapshot(snapshot);
    setActiveIds(newActive);

    const excluded = REDISTRIBUTION_CANDIDATES
      .filter((p) => !newActive.has(p.id))
      .map((p) => p.id)
      .join(',');

    // Minimum overlay time so user sees the analysis animation
    const [newSnap] = await Promise.all([
      getElection(excluded || undefined),
      new Promise((r) => setTimeout(r, 1800)),
    ]);
    setSnapshot(newSnap as any);
    setPhase('ready');
  }, [activeIds, snapshot]);

  const handleReset = useCallback(async () => {
    setPhase('recalculating');
    setPrevSnapshot(snapshot);
    setActiveIds(new Set(REDISTRIBUTION_CANDIDATES.map((p) => p.id)));

    const fullSnap = await getElection();
    setSnapshot(fullSnap);
    setPrevSnapshot(null);
    setPhase('ready');
  }, [snapshot]);

  const activeCount = activeIds.size;
  const removedCount = REDISTRIBUTION_CANDIDATES.length - activeCount;

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Link href="/redistribuicao" className="p-2 rounded-xl hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors duration-200">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Redistribuição de Votos</h1>
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-emerald-400" />
              <p className="text-xs text-emerald-400/70">Análise por IA · {snapshot?.totalPersonas?.toLocaleString('pt-BR') || '...'} personas</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {snapshot && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-xs text-zinc-400">
                <Users size={12} />
                {snapshot.totalVoters.toLocaleString('pt-BR')} eleitores
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400">
                <Sparkles size={12} />
                {activeCount} ativos
              </span>
              {removedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400">
                  {removedCount} removidos
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleReset}
            disabled={activeCount === REDISTRIBUTION_CANDIDATES.length || phase === 'recalculating'}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2',
              'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white',
              'border border-white/[0.08] hover:border-white/[0.15]',
              'rounded-xl text-xs font-medium active:scale-[0.97] transition-all duration-200',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </header>

      {/* Waiting for worker */}
      {phase === 'waiting' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          {workerProgress.status === 'analyzing' ? (
            <div className="text-center">
              <p className="text-sm text-zinc-300">Analisando {workerProgress.total.toLocaleString('pt-BR')} personas com IA...</p>
              <p className="text-xs text-zinc-500 mt-1">{workerProgress.voted.toLocaleString('pt-BR')} analisadas</p>
              <div className="w-64 h-1.5 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${workerProgress.total > 0 ? (workerProgress.voted / workerProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              {workerProgress.status === 'loading'
                ? `Carregando personas... ${workerProgress.loaded.toLocaleString('pt-BR')}/${workerProgress.total.toLocaleString('pt-BR')}`
                : 'Conectando ao worker...'}
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {(phase === 'ready' || phase === 'recalculating') && snapshot && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
            <p className="text-zinc-500 text-sm mb-6 text-center">
              Desative candidatos para ver a redistribuição instantânea
            </p>
            <div className="relative">
              <RecalculatingOverlay visible={phase === 'recalculating'} personaCount={snapshot.totalPersonas} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {REDISTRIBUTION_CANDIDATES.map((p) => {
                  const isActive = activeIds.has(p.id);
                  const entry = snapshot.candidateVotes.get(p.id);
                  const prevEntry = prevSnapshot?.candidateVotes.get(p.id);

                  let topGainerId: string | null = null;
                  if (prevSnapshot) {
                    let maxGain = 0;
                    for (const [id, e] of snapshot.candidateVotes.entries()) {
                      const prev = prevSnapshot.candidateVotes.get(id);
                      if (prev) {
                        const gain = e.percent - prev.percent;
                        if (gain > maxGain) { maxGain = gain; topGainerId = id; }
                      }
                    }
                  }

                  return (
                    <CandidateWarCard
                      key={p.id}
                      politician={p}
                      votes={entry?.votes || 0}
                      percent={entry?.percent || 0}
                      prevPercent={prevEntry?.percent}
                      isActive={isActive}
                      isTopGainer={topGainerId === p.id}
                      onToggle={handleToggle}
                    />
                  );
                })}
              </div>
            </div>

            {removedCount > 0 && (
              <div className="mt-8 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5">
                <p className="text-sm text-zinc-300">
                  <span className="font-bold text-white">{removedCount}</span> candidato{removedCount > 1 ? 's' : ''} removido{removedCount > 1 ? 's' : ''}
                  {' · '}Votos redistribuídos entre <span className="font-bold text-white">{activeCount}</span> ativos
                </p>
                {(() => {
                  if (!prevSnapshot) return null;
                  let topName = '', topDelta = 0;
                  for (const [id, e] of snapshot.candidateVotes.entries()) {
                    const prev = prevSnapshot.candidateVotes.get(id);
                    if (prev && e.percent - prev.percent > topDelta) {
                      topDelta = e.percent - prev.percent;
                      topName = REDISTRIBUTION_CANDIDATES.find((p) => p.id === id)?.name || '';
                    }
                  }
                  return topName ? (
                    <p className="text-xs text-zinc-500 mt-1">
                      Maior beneficiado: <span className="text-emerald-400 font-medium">{topName}</span> (+{topDelta.toFixed(1)}%)
                    </p>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
