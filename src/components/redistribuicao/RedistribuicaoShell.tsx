'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  REDISTRIBUTION_CANDIDATES,
  getWorkerStatus,
  getElection,
  getRedistribution,
  matchCandidate,
  type ElectionSnapshot,
  type RedistributionResult,
} from '@/lib/arena-eleitoral/redistribution';
import type { Politician } from '@/lib/arena-eleitoral/types';
import { HeroInput } from './HeroInput';
import { RedistributionResults } from './RedistributionResults';

type Phase = 'waiting' | 'idle' | 'analyzing' | 'results' | 'no-match';

export function RedistribuicaoShell() {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [result, setResult] = useState<RedistributionResult | null>(null);
  const [loadingText, setLoadingText] = useState('');
  const [noMatchQuery, setNoMatchQuery] = useState('');
  const [workerProgress, setWorkerProgress] = useState({ loaded: 0, total: 0, voted: 0, status: 'idle' });
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [totalPersonas, setTotalPersonas] = useState(0);

  // Poll worker status until ready
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const poll = async () => {
      try {
        const status = await getWorkerStatus();
        setWorkerProgress(status.progress);
        if (status.ready) {
          setPhase('idle');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('[Worker poll error]', err);
        setLoadingText('Conectando ao worker (localhost:3010)...');
      }
    };
    poll();
    interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const runSimulation = useCallback(async (candidate: Politician) => {
    setPhase('analyzing');
    setAnalysisProgress(0);

    // Get total personas count from worker
    try {
      const status = await getWorkerStatus();
      setTotalPersonas(status.totalPersonas);
    } catch { /* use cached */ }

    const total = totalPersonas || 20000;

    // Simulate analysis progress while fetching (data is already cached server-side)
    const steps = [
      { pct: 8, text: `Carregando ${total.toLocaleString('pt-BR')} personas do banco...`, delay: 400 },
      { pct: 15, text: `Identificando eleitores de ${candidate.name}...`, delay: 600 },
      { pct: 30, text: `Analisando perfil ideológico dos eleitores...`, delay: 500 },
      { pct: 50, text: `Calculando afinidade com candidatos restantes...`, delay: 700 },
      { pct: 70, text: `Redistribuindo votos por proximidade ideológica...`, delay: 600 },
      { pct: 85, text: `Consolidando resultados...`, delay: 400 },
    ];

    // Start fetching immediately (will resolve fast since data is cached)
    const fetchPromise = getRedistribution(candidate.id);

    // Run progress animation
    for (const step of steps) {
      setAnalysisProgress(step.pct);
      setLoadingText(step.text);
      await new Promise((r) => setTimeout(r, step.delay));
    }

    try {
      const redistribution = await fetchPromise;
      setAnalysisProgress(100);
      setLoadingText('Pronto!');
      await new Promise((r) => setTimeout(r, 300));
      setResult(redistribution);
      setPhase('results');
    } catch (err) {
      console.error('Redistribution error:', err);
      setLoadingText('Erro ao processar. Tente novamente.');
    }
  }, [totalPersonas]);

  const handleSubmit = useCallback((query: string) => {
    const candidate = matchCandidate(query, REDISTRIBUTION_CANDIDATES);
    if (candidate) {
      runSimulation(candidate);
    } else {
      setNoMatchQuery(query);
      setPhase('no-match');
    }
  }, [runSimulation]);

  const handleSelectCandidate = useCallback((politician: Politician) => {
    runSimulation(politician);
  }, [runSimulation]);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setResult(null);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Waiting for worker */}
      {phase === 'waiting' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            {workerProgress.status === 'loading' && (
              <p className="text-sm text-zinc-400">
                Carregando personas... {workerProgress.loaded.toLocaleString('pt-BR')}/{workerProgress.total.toLocaleString('pt-BR')}
              </p>
            )}
            {workerProgress.status === 'analyzing' && (
              <>
                <p className="text-sm text-zinc-300">
                  Analisando {workerProgress.total.toLocaleString('pt-BR')} personas com IA...
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {workerProgress.voted.toLocaleString('pt-BR')} analisadas
                </p>
                <div className="w-64 h-1.5 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${workerProgress.total > 0 ? (workerProgress.voted / workerProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </>
            )}
            {workerProgress.status === 'idle' && (
              <p className="text-sm text-zinc-500">Conectando ao worker...</p>
            )}
          </div>
        </div>
      )}

      {/* Compact header in results */}
      {phase === 'results' && (
        <HeroInput
          onSubmit={handleSubmit}
          onSelectCandidate={handleSelectCandidate}
          candidates={REDISTRIBUTION_CANDIDATES}
          compact
        />
      )}

      {/* Hero state */}
      {(phase === 'idle' || phase === 'no-match') && (
        <>
          <HeroInput
            onSubmit={handleSubmit}
            onSelectCandidate={handleSelectCandidate}
            candidates={REDISTRIBUTION_CANDIDATES}
          />
          {phase === 'no-match' && (
            <div className="text-center px-4 -mt-4 mb-8">
              <div className="inline-flex flex-col items-center gap-3 bg-white/[0.03] border border-amber-500/20 rounded-2xl p-5 max-w-md">
                <p className="text-sm text-amber-400">
                  Candidato não identificado em &quot;{noMatchQuery}&quot;
                </p>
                <p className="text-xs text-zinc-500">Clique em um dos candidatos acima para simular</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Analyzing progress */}
      {phase === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-zinc-300 font-medium">{loadingText}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {(totalPersonas || 20000).toLocaleString('pt-BR')} personas sendo analisadas
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-600 text-right">{analysisProgress}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {phase === 'results' && result && (
        <div className="flex-1 overflow-y-auto">
          <RedistributionResults result={result} onReset={handleReset} />
        </div>
      )}
    </div>
  );
}
