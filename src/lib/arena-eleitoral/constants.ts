import type { Politician, CandidateColorSet } from './types';

// ── Pre-defined Politicians ──────────────────────────────────────────────────

export const POLITICIANS: Politician[] = [
  { id: 'lula', name: 'Lula', party: 'PT', position: 'Presidente', leaning: 'esquerda', photoUrl: '/politicians/lula.jpg' },
  { id: 'bolsonaro', name: 'Jair Bolsonaro', party: 'PL', position: 'Ex-Presidente', leaning: 'direita', photoUrl: '/politicians/bolsonaro.jpg' },
  { id: 'ciro', name: 'Ciro Gomes', party: 'PDT', position: 'Ex-Governador', leaning: 'centro-esquerda', photoUrl: '/politicians/ciro.jpg' },
  { id: 'marina', name: 'Marina Silva', party: 'REDE', position: 'Ministra', leaning: 'centro-esquerda', photoUrl: '/politicians/marina.jpg' },
  { id: 'tarcisio', name: 'Tarcísio de Freitas', party: 'Republicanos', position: 'Governador SP', leaning: 'direita', photoUrl: '/politicians/tarcisio.jpg' },
  { id: 'haddad', name: 'Fernando Haddad', party: 'PT', position: 'Ministro da Fazenda', leaning: 'esquerda', photoUrl: '/politicians/haddad.jpg' },
  { id: 'zema', name: 'Romeu Zema', party: 'NOVO', position: 'Governador MG', leaning: 'centro-direita', photoUrl: '/politicians/zema.jpg' },
  { id: 'boulos', name: 'Guilherme Boulos', party: 'PSOL', position: 'Deputado Federal', leaning: 'esquerda', photoUrl: '/politicians/boulos.jpg' },
  { id: 'simone', name: 'Simone Tebet', party: 'MDB', position: 'Ministra', leaning: 'centro', photoUrl: '/politicians/simone.jpg' },
  { id: 'marilia', name: 'Marília Arraes', party: 'SD', position: 'Deputada Federal', leaning: 'esquerda', photoUrl: '/politicians/marilia.jpg' },
];

// ── Ideology-based Color Schemes ─────────────────────────────────────────────
// Esquerda = VERMELHO | Direita = AZUL | Centro = ÂMBAR

export const CANDIDATE_COLORS_LEFT: CandidateColorSet = {
  primary: 'text-rose-400',
  bg: 'bg-rose-500/10',
  bgSolid: 'bg-rose-500',
  border: 'border-rose-500/30',
  gradient: 'from-rose-500/20 to-red-500/20',
  glow: 'shadow-rose-500/20',
  bar: 'bg-rose-500',
  dot: 'bg-rose-400',
};

export const CANDIDATE_COLORS_RIGHT: CandidateColorSet = {
  primary: 'text-sky-400',
  bg: 'bg-sky-500/10',
  bgSolid: 'bg-sky-500',
  border: 'border-sky-500/30',
  gradient: 'from-sky-500/20 to-blue-500/20',
  glow: 'shadow-sky-500/20',
  bar: 'bg-sky-500',
  dot: 'bg-sky-400',
};

export const CANDIDATE_COLORS_CENTER: CandidateColorSet = {
  primary: 'text-amber-400',
  bg: 'bg-amber-500/10',
  bgSolid: 'bg-amber-500',
  border: 'border-amber-500/30',
  gradient: 'from-amber-500/20 to-yellow-500/20',
  glow: 'shadow-amber-500/20',
  bar: 'bg-amber-500',
  dot: 'bg-amber-400',
};

/** Returns color scheme based on politician ideology (left=red, right=blue, center=amber) */
export function getCandidateColors(politician: Politician): CandidateColorSet {
  const leaning = politician.leaning || 'centro';
  if (leaning === 'esquerda' || leaning === 'centro-esquerda') return CANDIDATE_COLORS_LEFT;
  if (leaning === 'direita' || leaning === 'centro-direita') return CANDIDATE_COLORS_RIGHT;
  return CANDIDATE_COLORS_CENTER;
}

// ── Legacy CANDIDATE_COLORS (kept for backward compat during migration) ──────

export const CANDIDATE_COLORS = {
  A: CANDIDATE_COLORS_LEFT,
  B: CANDIDATE_COLORS_RIGHT,
};

// ── Leaning Colors (for badges) ──────────────────────────────────────────────

export const LEANING_COLORS: Record<string, { gradient: string; bg: string; border: string; text: string; glow: string }> = {
  esquerda: {
    gradient: 'from-red-500/20 to-rose-500/20',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  'centro-esquerda': {
    gradient: 'from-orange-500/20 to-red-500/20',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    glow: 'shadow-orange-500/20',
  },
  centro: {
    gradient: 'from-amber-500/20 to-yellow-500/20',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  'centro-direita': {
    gradient: 'from-sky-500/20 to-blue-500/20',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/20',
  },
  direita: {
    gradient: 'from-blue-500/20 to-indigo-500/20',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
};

// ── Party Colors ─────────────────────────────────────────────────────────────

export const PARTY_COLORS: Record<string, string> = {
  PT: 'text-red-400',
  PL: 'text-blue-400',
  PDT: 'text-rose-400',
  REDE: 'text-green-400',
  Republicanos: 'text-sky-400',
  NOVO: 'text-orange-400',
  PSOL: 'text-yellow-400',
  MDB: 'text-amber-400',
  SD: 'text-violet-400',
};
