'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import type { ConversationBlock } from '@/hooks/useConversation';
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
} from '@/lib/arena-eleitoral/types';
import {
  runElectoralSimulation,
  extractCriticisms,
  generateProposals,
} from '@/lib/arena-eleitoral/simulation';

interface ElectoralModeProps {
  personaCache: {
    personas: any[];
    count: number;
    loadAll: () => Promise<any[]>;
  };
  onAddBlock: (block: ConversationBlock) => void;
  onReplaceBlock: (id: string, block: ConversationBlock) => void;
  onUpdateBlock: (id: string, updates: Partial<ConversationBlock>) => void;
  onProcessing: (processing: boolean) => void;
}

export function ElectoralMode({ personaCache, onAddBlock, onReplaceBlock, onUpdateBlock, onProcessing }: ElectoralModeProps) {
  const abortRef = useRef<AbortController | null>(null);
  const previousVotesRef = useRef<Record<string, string>>({});
  const previousResultRef = useRef<RoundResult | null>(null);
  const currentResultRef = useRef<RoundResult | null>(null);

  const startSimulation = useCallback(async (
    candidateA: Politician,
    candidateB: Politician,
    round: number,
    proposals?: CounterProposal[],
  ) => {
    onProcessing(true);

    const blockId = crypto.randomUUID();

    onAddBlock({
      id: blockId,
      type: 'processing',
      timestamp: new Date(),
      data: {
        type: 'electoral',
        candidateA: candidateA.name,
        candidateB: candidateB.name,
        pipelinePhase: 'Pesquisando candidatos...',
        processedCount: 0,
        totalCount: personaCache.count,
      },
    });

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let result: RoundResult | null = null;
    let criticisms: CriticismCategory[] = [];
    let generatedProposals: CounterProposal[] = [];
    let shifts: VoterShift[] = [];
    let comparison: ElectoralComparison | null = null;

    try {
      const body = {
        candidate_a: { name: candidateA.name, party: candidateA.party || '', position: candidateA.position || '', leaning: candidateA.leaning || 'centro' },
        candidate_b: { name: candidateB.name, party: candidateB.party || '', position: candidateB.position || '', leaning: candidateB.leaning || 'centro' },
        round_number: round,
        proposals: proposals ? proposals.filter(p => p.enabled).map(p => ({ id: p.id, title: p.title, description: p.description, targetCriticism: p.targetCriticism, targetClusters: p.targetClusters, estimatedFlip: p.estimatedFlip, enabled: p.enabled })) : [],
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

            switch (event.type) {
              case 'phase':
                onReplaceBlock(blockId, {
                  id: blockId, type: 'processing', timestamp: new Date(),
                  data: { type: 'electoral', candidateA: candidateA.name, candidateB: candidateB.name, pipelinePhase: event.data.phase === 'voting' ? 'Votacao em andamento...' : 'Pesquisando candidatos...', processedCount: 0, totalCount: personaCache.count },
                });
                break;

              case 'voting_progress':
                onReplaceBlock(blockId, {
                  id: blockId, type: 'processing', timestamp: new Date(),
                  data: { type: 'electoral', candidateA: candidateA.name, candidateB: candidateB.name, pipelinePhase: 'Votacao em andamento...', processedCount: event.data.processed, totalCount: event.data.total },
                });
                break;

              case 'round_results':
                result = event.data;
                currentResultRef.current = result;
                const votesMap: Record<string, string> = {};
                for (const v of result!.votes) votesMap[v.personaId] = v.vote;
                previousVotesRef.current = votesMap;
                break;

              case 'criticisms':
                criticisms = (event.data || []).map((c: any) => ({
                  behavioralProfiles: [], dominantAge: '', dominantRegion: '', dominantEducation: '',
                  dominantSocialClass: '', dominantReligion: '', mediaPattern: '', psychologicalTrait: '',
                  keyObjection: '', ...c,
                }));
                break;

              case 'proposals':
                generatedProposals = (event.data || []).map((p: any) => ({
                  strategicRationale: '', actionPlan: [], voterMessage: '', ideologicalFit: '',
                  risk: '', affectedDemographics: '', ...p, enabled: p.enabled ?? true,
                }));
                break;

              case 'shifts':
                shifts = event.data || [];
                if (previousResultRef.current && currentResultRef.current) {
                  const flippedToA = shifts.filter(s => s.newVote === 'candidateA').length;
                  const flippedToB = shifts.filter(s => s.newVote === 'candidateB').length;
                  comparison = {
                    previousRound: previousResultRef.current,
                    currentRound: currentResultRef.current,
                    shifts, totalFlipped: shifts.length, flippedToA, flippedToB,
                    netGainA: flippedToA - shifts.filter(s => s.previousVote === 'candidateA').length,
                    netGainB: flippedToB - shifts.filter(s => s.previousVote === 'candidateB').length,
                  };
                }
                break;

              case 'done':
                break;
            }
          } catch { /* skip */ }
        }
      }

      // Fallback criticisms/proposals if SSE didn't send them
      if (round === 1 && result && result.winner !== 'tie') {
        const winnerSide = result.winner as 'candidateA' | 'candidateB';
        if (criticisms.length === 0) criticisms = extractCriticisms(result, winnerSide);
        if (generatedProposals.length === 0) {
          const loserData = winnerSide === 'candidateA' ? candidateB : candidateA;
          const winnerData = winnerSide === 'candidateA' ? candidateA : candidateB;
          generatedProposals = generateProposals(criticisms, loserData, winnerData, Math.abs(result.votesA - result.votesB));
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') { onProcessing(false); return; }

      // JS Fallback
      try {
        const personas = await personaCache.loadAll();
        const { result: simResult, shifts: simShifts } = runElectoralSimulation(
          personas, candidateA, candidateB, round, proposals,
          round > 1 ? previousVotesRef.current : undefined,
        );
        result = simResult;
        currentResultRef.current = result;
        shifts = simShifts;

        const votesMap: Record<string, string> = {};
        for (const v of result.votes) votesMap[v.personaId] = v.vote;
        previousVotesRef.current = votesMap;

        if (round === 1 && result.winner !== 'tie') {
          const winnerSide = result.winner as 'candidateA' | 'candidateB';
          criticisms = extractCriticisms(result, winnerSide, personas);
          const loserData = winnerSide === 'candidateA' ? candidateB : candidateA;
          const winnerData = winnerSide === 'candidateA' ? candidateA : candidateB;
          generatedProposals = generateProposals(criticisms, loserData, winnerData, Math.abs(result.votesA - result.votesB));
        }

        if (round > 1 && previousResultRef.current) {
          const flippedToA = shifts.filter(s => s.newVote === 'candidateA').length;
          const flippedToB = shifts.filter(s => s.newVote === 'candidateB').length;
          comparison = {
            previousRound: previousResultRef.current, currentRound: result,
            shifts, totalFlipped: shifts.length, flippedToA, flippedToB,
            netGainA: flippedToA - shifts.filter(s => s.previousVote === 'candidateA').length,
            netGainB: flippedToB - shifts.filter(s => s.previousVote === 'candidateB').length,
          };
        }
      } catch (fallbackErr) {
        console.error('[Electoral] Fallback failed:', fallbackErr);
        onProcessing(false);
        return;
      }
    }

    // Replace processing with result
    if (result) {
      onReplaceBlock(blockId, {
        id: blockId,
        type: 'electoral-result',
        timestamp: new Date(),
        data: {
          candidateA, candidateB, result, round,
          criticisms, proposals: generatedProposals, shifts, comparison,
          onReSimulate: (activeProposals: CounterProposal[]) => {
            previousResultRef.current = currentResultRef.current;
            startSimulation(candidateA, candidateB, round + 1, activeProposals);
          },
        },
      });
    }
    onProcessing(false);
  }, [personaCache, onAddBlock, onReplaceBlock, onProcessing]);

  // Listen for submit events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.mode === 'eleitoral') {
        // Electoral mode uses candidate selection, not text input
        // This is handled by the ElectoralResultBlock's onStart callback
      }
    };
    window.addEventListener('unified-submit', handler);
    return () => window.removeEventListener('unified-submit', handler);
  }, []);

  // Expose startSimulation via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.candidateA && detail.candidateB) {
        previousVotesRef.current = {};
        previousResultRef.current = null;
        currentResultRef.current = null;
        startSimulation(detail.candidateA, detail.candidateB, 1);
      }
    };
    window.addEventListener('electoral-start', handler);
    return () => window.removeEventListener('electoral-start', handler);
  }, [startSimulation]);

  return null;
}
