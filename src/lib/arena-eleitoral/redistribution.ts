// ── Vote Redistribution — Python Worker Client ──────────────────────────────
// Connects to the redistribuicao-worker Python backend (port 3010).
// The Python worker pre-loads all 20k personas and runs GPT analysis.
// Redistribution is instant (cached ranked votes).

import type { Politician } from './types';
import { getCandidateColors } from './constants';

// ── Worker URL ───────────────────────────────────────────────────────────────

// Routes through Next.js API to avoid CORS issues
const API_BASE = '/api/redistribuicao';

// ── Real Candidates ──────────────────────────────────────────────────────────

export const REDISTRIBUTION_CANDIDATES: Politician[] = [
  { id: 'lula', name: 'Lula', party: 'PT', position: 'Presidente', leaning: 'esquerda', photoUrl: '/politicians/lula.jpg' },
  { id: 'flavio', name: 'Flávio Bolsonaro', party: 'PL', position: 'Senador', leaning: 'direita', photoUrl: '/politicians/flavio.jpg' },
  { id: 'ratinho', name: 'Ratinho Jr.', party: 'PSD', position: 'Governador PR', leaning: 'centro-direita', photoUrl: '/politicians/ratinho.jpg' },
  { id: 'caiado', name: 'Ronaldo Caiado', party: 'União Brasil', position: 'Governador GO', leaning: 'direita', photoUrl: '/politicians/caiado.jpg' },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface RedistributionCandidate {
  politician: Politician;
  votesBefore: number;
  votesAfter: number;
  percentBefore: number;
  percentAfter: number;
  gained: number;
  percentOfRedistribution: number;
  delta: number;
}

export interface RedistributionResult {
  removedCandidate: {
    politician: Politician;
    votes: number;
    percent: number;
  };
  totalVoters: number;
  totalAbstentions: number;
  totalRedistributed: number;
  candidates: RedistributionCandidate[];
}

export interface ElectionSnapshot {
  totalVoters: number;
  totalAbstentions: number;
  totalPersonas: number;
  candidateVotes: Map<string, { votes: number; percent: number }>;
}

export interface WorkerStatus {
  ready: boolean;
  progress: { loaded: number; total: number; voted: number; status: string };
  totalPersonas: number;
  totalVoted: number;
}

// ── Worker API calls ─────────────────────────────────────────────────────────

export async function getWorkerStatus(): Promise<WorkerStatus> {
  const resp = await fetch(`${API_BASE}/worker-status`);
  return resp.json();
}

export async function getElection(exclude?: string): Promise<ElectionSnapshot> {
  const url = exclude
    ? `${API_BASE}/election?exclude=${exclude}`
    : `${API_BASE}/election`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (data.error) throw new Error(data.error);

  const candidateVotes = new Map<string, { votes: number; percent: number }>();
  for (const c of data.candidates) {
    candidateVotes.set(c.id, { votes: c.votes, percent: c.percent });
  }

  return {
    totalVoters: data.totalVoters,
    totalAbstentions: data.totalAbstentions,
    totalPersonas: data.totalPersonas,
    candidateVotes,
  };
}

export async function getRedistribution(removedId: string): Promise<RedistributionResult> {
  const resp = await fetch(`${API_BASE}/redistribution?id=${removedId}`);
  const data = await resp.json();

  if (data.error) throw new Error(data.error);

  const removedPolitician = REDISTRIBUTION_CANDIDATES.find((c) => c.id === removedId)!;

  const candidates: RedistributionCandidate[] = data.candidates.map((c: any) => ({
    politician: REDISTRIBUTION_CANDIDATES.find((p) => p.id === c.id) || {
      id: c.id, name: c.name, party: c.party, leaning: c.leaning,
    },
    votesBefore: c.votesBefore,
    votesAfter: c.votesAfter,
    percentBefore: c.percentBefore,
    percentAfter: c.percentAfter,
    gained: c.gained,
    percentOfRedistribution: c.percentOfRedistribution,
    delta: c.delta,
  }));

  return {
    removedCandidate: {
      politician: removedPolitician,
      votes: data.removedCandidate.votes,
      percent: data.removedCandidate.percent,
    },
    totalVoters: data.totalVoters,
    totalAbstentions: data.totalAbstentions,
    totalRedistributed: data.totalRedistributed,
    candidates,
  };
}

// ── Candidate Name Matching ──────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function matchCandidate(query: string, candidates: Politician[] = REDISTRIBUTION_CANDIDATES): Politician | null {
  const q = normalize(query);
  const matches = candidates.filter((p) => {
    const nameNorm = normalize(p.name);
    const idNorm = normalize(p.id);
    const partyNorm = normalize(p.party || '');
    return q.includes(nameNorm) || q.includes(idNorm) || q.includes(partyNorm);
  });

  if (matches.length === 0) {
    for (const p of candidates) {
      const parts = normalize(p.name).split(' ');
      for (const part of parts) {
        if (part.length >= 3 && q.includes(part)) {
          matches.push(p);
          break;
        }
      }
    }
  }

  return matches.length === 1 ? matches[0] : null;
}

export { getCandidateColors };
