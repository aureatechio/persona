'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { Menu, Swords, RotateCcw, ArrowLeft } from 'lucide-react';

import type {
  ElectoralPhase,
  Politician,
  RoundResult,
  CriticismCategory,
  CounterProposal,
  VoterShift,
  ElectoralComparison,
  ElectoralSSEProgress,
  RoundHistoryEntry,
  PersonaVote,
} from '@/lib/arena-eleitoral/types';

import { supabase } from '@/lib/supabase';
import { CandidateSelector } from '@/components/arena-eleitoral/CandidateSelector';
import { ElectoralProcessing } from '@/components/arena-eleitoral/ElectoralProcessing';
import { VoteResultPanel } from '@/components/arena-eleitoral/VoteResultPanel';
import { CriticismPanel } from '@/components/arena-eleitoral/CriticismPanel';
import { ProposalEditor } from '@/components/arena-eleitoral/ProposalEditor';
import { ComparisonDashboard } from '@/components/arena-eleitoral/ComparisonDashboard';
import {
  runElectoralSimulation,
  extractCriticisms,
  generateProposals,
} from '@/lib/arena-eleitoral/simulation';

export default function ArenaEleitoralPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── State Machine ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<ElectoralPhase>('setup');
  const [candidateA, setCandidateA] = useState<Politician | null>(null);
  const [candidateB, setCandidateB] = useState<Politician | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [pipelinePhase, setPipelinePhase] = useState('');
  const [progress, setProgress] = useState<ElectoralSSEProgress | null>(null);

  // ── Results ────────────────────────────────────────────────────────────
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [previousResult, setPreviousResult] = useState<RoundResult | null>(null);
  const [criticisms, setCriticisms] = useState<CriticismCategory[]>([]);
  const [proposals, setProposals] = useState<CounterProposal[]>([]);
  const [shifts, setShifts] = useState<VoterShift[]>([]);
  const [comparison, setComparison] = useState<ElectoralComparison | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundHistoryEntry[]>([]);

  // Persona cache
  const [allPersonas, setAllPersonas] = useState<any[]>([]);

  // Previous votes map for shift detection
  const previousVotesRef = useRef<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const previousResultRef = useRef<RoundResult | null>(null);
  const currentResultRef = useRef<RoundResult | null>(null);

  // ── Load personas from Supabase ────────────────────────────────────────
  const loadAllPersonas = useCallback(async (): Promise<any[]> => {
    if (allPersonas.length > 0) return allPersonas;

    const batchSize = 1000;
    let allData: any[] = [];
    let from = 0;

    while (true) {
      const { data } = await supabase
        .from('personas')
        .select('*')
        .range(from, from + batchSize - 1);
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < batchSize) break;
        from += batchSize;
      } else {
        break;
      }
    }

    setAllPersonas(allData);
    return allData;
  }, [allPersonas]);

  // ── Auth Guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!session) router.push('/login');
  }, [authLoading, session, router]);

  // ── SSE Connection ─────────────────────────────────────────────────────
  const startSimulation = useCallback(async (round: number, activeProposals?: CounterProposal[]) => {
    if (!candidateA || !candidateB) return;

    // Abort previous
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase(round === 1 ? 'researching' : 'revoting');
    setPipelinePhase('researching');
    setProgress(null);

    try {
      const body = {
        candidate_a: {
          name: candidateA.name,
          party: candidateA.party || '',
          position: candidateA.position || '',
          leaning: candidateA.leaning || 'centro',
        },
        candidate_b: {
          name: candidateB.name,
          party: candidateB.party || '',
          position: candidateB.position || '',
          leaning: candidateB.leaning || 'centro',
        },
        round_number: round,
        proposals: activeProposals
          ? activeProposals.filter((p) => p.enabled).map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              targetCriticism: p.targetCriticism,
              targetClusters: p.targetClusters,
              estimatedFlip: p.estimatedFlip,
              enabled: p.enabled,
            }))
          : [],
        previous_votes: previousVotesRef.current,
      };

      const response = await fetch('/api/arena/electoral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            handleSSEEvent(event, round);
          } catch {
            // Skip malformed events
          }
        }
      }

      // ── Fallback: generate criticisms & proposals if SSE didn't send them ──
      const resultAfterSSE = currentResultRef.current;
      if (round === 1 && resultAfterSSE && resultAfterSSE.winner !== 'tie') {
        const winnerSide = resultAfterSSE.winner as 'candidateA' | 'candidateB';
        const fallbackCrits = extractCriticisms(resultAfterSSE, winnerSide);
        const loserData = winnerSide === 'candidateA' ? candidateB! : candidateA!;
        const winnerData = winnerSide === 'candidateA' ? candidateA! : candidateB!;
        const margin = Math.abs(resultAfterSSE.votesA - resultAfterSSE.votesB);

        setCriticisms(prev => prev.length > 0 ? prev : fallbackCrits);
        setProposals(prev => {
          if (prev.length > 0) return prev;
          return generateProposals(fallbackCrits, loserData, winnerData, margin);
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;

      // ── Fallback: JS simulation when Python backend is offline ──────
      console.warn('[Electoral] Python backend offline, using JS fallback:', err);
      setPipelinePhase('voting');
      setPhase(round > 1 ? 'revoting' : 'voting');

      try {
        const personas = await loadAllPersonas();
        const totalPersonas = personas.length;

        // Animate progress
        const animDuration = 3000;
        const animStart = performance.now();
        let animStopped = false;

        const animateProgress = (time: number) => {
          if (animStopped) return;
          const p = Math.min((time - animStart) / animDuration, 1);
          const eased = 1 - Math.pow(1 - p, 2);
          const count = Math.round(totalPersonas * eased);
          setProgress({
            processed: count,
            total: totalPersonas,
            votesA: Math.round(count * 0.45),
            votesB: Math.round(count * 0.42),
            abstentions: Math.round(count * 0.13),
          });
          if (p < 1) requestAnimationFrame(animateProgress);
        };
        requestAnimationFrame(animateProgress);

        // Wait for animation
        await new Promise((resolve) => setTimeout(resolve, animDuration + 200));
        animStopped = true;

        // Run simulation
        const { result, shifts: simShifts } = runElectoralSimulation(
          personas,
          candidateA!,
          candidateB!,
          round,
          activeProposals,
          round > 1 ? previousVotesRef.current : undefined,
        );

        // Store votes for next round
        const votesMap: Record<string, string> = {};
        for (const v of result.votes) {
          votesMap[v.personaId] = v.vote;
        }
        previousVotesRef.current = votesMap;

        setCurrentResult(result);
        currentResultRef.current = result;

        // Add to history
        setRoundHistory((prev) => [
          ...prev,
          {
            roundNumber: result.roundNumber,
            votesA: result.votesA,
            votesB: result.votesB,
            percentA: result.percentA,
            percentB: result.percentB,
            proposalsUsed: [],
            shiftsCount: simShifts.length,
          },
        ]);

        if (round > 1) {
          // Build comparison
          setShifts(simShifts);
          const prevRef = previousResultRef.current;
          if (prevRef) {
            const flippedToA = simShifts.filter((s) => s.newVote === 'candidateA').length;
            const flippedToB = simShifts.filter((s) => s.newVote === 'candidateB').length;
            setComparison({
              previousRound: prevRef,
              currentRound: result,
              shifts: simShifts,
              totalFlipped: simShifts.length,
              flippedToA,
              flippedToB,
              netGainA: flippedToA - simShifts.filter((s) => s.previousVote === 'candidateA').length,
              netGainB: flippedToB - simShifts.filter((s) => s.previousVote === 'candidateB').length,
            });
          }
          setPhase('comparison');
        } else {
          // Extract criticisms and generate proposals
          if (result.winner !== 'tie') {
            const winnerSide = result.winner as 'candidateA' | 'candidateB';
            const crits = extractCriticisms(result, winnerSide, personas);
            setCriticisms(crits);

            const loserData = winnerSide === 'candidateA' ? candidateB! : candidateA!;
            const winnerData = winnerSide === 'candidateA' ? candidateA! : candidateB!;
            const margin = Math.abs(result.votesA - result.votesB);
            const props = generateProposals(crits, loserData, winnerData, margin);
            setProposals(props);
          }
          setPhase('results');
        }
      } catch (fallbackErr) {
        console.error('[Electoral] Fallback also failed:', fallbackErr);
        setPhase('setup');
      }
    }
  }, [candidateA, candidateB, loadAllPersonas]);

  const handleSSEEvent = useCallback((event: any, round: number) => {
    const { type, data } = event;

    switch (type) {
      case 'phase':
        setPipelinePhase(data.phase);
        if (data.phase === 'voting') {
          setPhase(round > 1 ? 'revoting' : 'voting');
        }
        break;

      case 'voting_progress':
        setProgress({
          processed: data.processed,
          total: data.total,
          votesA: data.votesA,
          votesB: data.votesB,
          abstentions: data.abstentions,
        });
        break;

      case 'round_results': {
        const result: RoundResult = data;
        setCurrentResult(result);
        currentResultRef.current = result;

        // Store votes for shift detection in next round
        const votesMap: Record<string, string> = {};
        for (const v of result.votes) {
          votesMap[v.personaId] = v.vote;
        }
        previousVotesRef.current = votesMap;

        // Add to history
        setRoundHistory((prev) => [
          ...prev,
          {
            roundNumber: result.roundNumber,
            votesA: result.votesA,
            votesB: result.votesB,
            percentA: result.percentA,
            percentB: result.percentB,
            proposalsUsed: [],
            shiftsCount: 0,
          },
        ]);

        if (round === 1) {
          setPhase('results');
        }
        break;
      }

      case 'criticisms': {
        // Ensure new behavioral fields have defaults for SSE data
        const criticismData: CriticismCategory[] = (data || []).map((c: any) => ({
          behavioralProfiles: [],
          dominantAge: '',
          dominantRegion: '',
          dominantEducation: '',
          dominantSocialClass: '',
          dominantReligion: '',
          mediaPattern: '',
          psychologicalTrait: '',
          keyObjection: '',
          ...c,
        }));
        setCriticisms(criticismData);
        break;
      }

      case 'proposals': {
        const proposalData: CounterProposal[] = (data || []).map((p: any) => ({
          strategicRationale: '',
          actionPlan: [],
          voterMessage: '',
          ideologicalFit: '',
          risk: '',
          affectedDemographics: '',
          ...p,
          enabled: p.enabled ?? true,
        }));
        setProposals(proposalData);

        // If round 1, phase is already 'results', criticisms and proposals shown together
        break;
      }

      case 'shifts': {
        const shiftData: VoterShift[] = data || [];
        setShifts(shiftData);

        // Update last history entry with shift count
        setRoundHistory((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1].shiftsCount = shiftData.length;
          }
          return updated;
        });

        // Build comparison using refs (state may be stale in closure)
        const prevRef = previousResultRef.current;
        const currRef = currentResultRef.current;
        if (prevRef && currRef) {
          const flippedToA = shiftData.filter((s) => s.newVote === 'candidateA').length;
          const flippedToB = shiftData.filter((s) => s.newVote === 'candidateB').length;
          setComparison({
            previousRound: prevRef,
            currentRound: currRef,
            shifts: shiftData,
            totalFlipped: shiftData.length,
            flippedToA,
            flippedToB,
            netGainA: flippedToA - shiftData.filter((s) => s.previousVote === 'candidateA').length,
            netGainB: flippedToB - shiftData.filter((s) => s.previousVote === 'candidateB').length,
          });
        }
        break;
      }

      case 'done':
        if (round > 1) {
          setPhase('comparison');
        }
        break;
    }
  }, [previousResult, currentResult]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleStart = (a: Politician, b: Politician) => {
    setCandidateA(a);
    setCandidateB(b);
    setRoundNumber(1);
    setRoundHistory([]);
    setPreviousResult(null);
    setCurrentResult(null);
    setCriticisms([]);
    setProposals([]);
    setShifts([]);
    setComparison(null);
    previousVotesRef.current = {};

    // Start after state updates
    setTimeout(() => startSimulation(1), 100);
  };

  // Need to use ref-based approach for start since candidateA/B state might not be set yet
  const pendingStartRef = useRef<{ a: Politician; b: Politician } | null>(null);

  useEffect(() => {
    if (pendingStartRef.current && candidateA && candidateB) {
      pendingStartRef.current = null;
      startSimulation(1);
    }
  }, [candidateA, candidateB, startSimulation]);

  const handleStartWrapper = (a: Politician, b: Politician) => {
    setCandidateA(a);
    setCandidateB(b);
    setRoundNumber(1);
    setRoundHistory([]);
    setPreviousResult(null);
    setCurrentResult(null);
    setCriticisms([]);
    setProposals([]);
    setShifts([]);
    setComparison(null);
    previousVotesRef.current = {};
    pendingStartRef.current = { a, b };
  };

  const handleReSimulate = () => {
    const nextRound = roundNumber + 1;
    setRoundNumber(nextRound);
    setPreviousResult(currentResult);
    previousResultRef.current = currentResult;
    setCurrentResult(null);
    currentResultRef.current = null;
    setShifts([]);
    setComparison(null);
    startSimulation(nextRound, proposals);
  };

  const handleGoToProposals = () => {
    setPhase('proposals');
  };

  const handleNewRound = () => {
    setPhase('proposals');
  };

  const handleToggleProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleEditProposal = (id: string, description: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, description } : p))
    );
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setPhase('setup');
    setCandidateA(null);
    setCandidateB(null);
    setRoundNumber(1);
    setRoundHistory([]);
    setPreviousResult(null);
    setCurrentResult(null);
    setCriticisms([]);
    setProposals([]);
    setShifts([]);
    setComparison(null);
    previousVotesRef.current = {};
  };

  // ── Auth loading ───────────────────────────────────────────────────────
  if (authLoading || !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const isProcessing = phase === 'researching' || phase === 'voting' || phase === 'revoting';
  const winnerName = currentResult
    ? currentResult.winner === 'candidateA'
      ? candidateA?.name || ''
      : currentResult.winner === 'candidateB'
        ? candidateB?.name || ''
        : ''
    : '';
  const loserName = currentResult
    ? currentResult.winner === 'candidateA'
      ? candidateB?.name || ''
      : currentResult.winner === 'candidateB'
        ? candidateA?.name || ''
        : ''
    : '';
  const loserData = currentResult
    ? currentResult.winner === 'candidateA' ? candidateB : currentResult.winner === 'candidateB' ? candidateA : null
    : null;

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 overflow-y-auto">
        {/* Decorative orbs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto p-6 md:p-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors duration-200"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                  <Swords size={28} className="text-emerald-400" />
                  Arena Eleitoral
                </h1>
                <p className="text-zinc-500 mt-1 text-sm">
                  {phase === 'setup'
                    ? 'Selecione dois candidatos para iniciar'
                    : candidateA && candidateB
                      ? `${candidateA.name} vs ${candidateB.name} · Round ${roundNumber}`
                      : 'Simulação em andamento'}
                </p>
              </div>
            </div>

            {phase !== 'setup' && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl font-medium text-sm active:scale-[0.97] transition-all duration-200"
              >
                <ArrowLeft size={16} />
                Nova Simulação
              </button>
            )}
          </div>

          {/* Phase: Setup */}
          {phase === 'setup' && (
            <CandidateSelector onStart={handleStartWrapper} />
          )}

          {/* Phase: Processing (researching/voting/revoting) */}
          {isProcessing && candidateA && candidateB && (
            <ElectoralProcessing
              candidateA={candidateA}
              candidateB={candidateB}
              pipelinePhase={pipelinePhase}
              progress={progress}
            />
          )}

          {/* Phase: Results */}
          {phase === 'results' && currentResult && candidateA && candidateB && (
            <div className="space-y-8">
              <VoteResultPanel
                candidateA={candidateA}
                candidateB={candidateB}
                result={currentResult}
              />

              {/* Criticisms */}
              {criticisms.length > 0 && (
                <CriticismPanel
                  criticisms={criticisms}
                  winnerName={winnerName}
                />
              )}

              {/* Go to proposals button */}
              {proposals.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleGoToProposals}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200"
                  >
                    Ver Propostas Estratégicas
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Phase: Proposals */}
          {phase === 'proposals' && proposals.length > 0 && (
            <ProposalEditor
              proposals={proposals}
              loserName={loserName}
              loserParty={loserData?.party}
              loserLeaning={loserData?.leaning}
              winnerName={winnerName}
              criticisms={criticisms}
              onToggle={handleToggleProposal}
              onEditDescription={handleEditProposal}
              onReSimulate={handleReSimulate}
            />
          )}

          {/* Phase: Comparison */}
          {phase === 'comparison' && comparison && candidateA && candidateB && (
            <ComparisonDashboard
              candidateA={candidateA}
              candidateB={candidateB}
              comparison={comparison}
              roundHistory={roundHistory}
              onNewRound={handleNewRound}
            />
          )}
        </div>
      </main>
    </div>
  );
}
