// ── Derivation logic (extracted from scripts/import-csv.ts:77-100) ───────────

export function derivePoliticalLeaning(
  clusterId: string,
  scoreEco: number,
  scoreCost: number,
): string {
  const macro = clusterId.charAt(0);
  const avgScore = (scoreEco + scoreCost) / 2;

  if (macro === 'P') {
    if (avgScore < -0.5) return 'Extrema Esquerda';
    if (avgScore < -0.2) return 'Esquerda';
    return 'Centro-Esquerda';
  }
  if (macro === 'M') {
    if (avgScore < -0.15) return 'Centro-Esquerda';
    if (avgScore > 0.15) return 'Centro-Direita';
    return 'Centro';
  }
  if (macro === 'C') {
    if (avgScore > 0.5) return 'Extrema Direita';
    if (avgScore > 0.2) return 'Direita';
    return 'Centro-Direita';
  }
  // Transversal (T)
  if (avgScore < -0.2) return 'Centro-Esquerda';
  if (avgScore > 0.2) return 'Centro-Direita';
  return 'Centro';
}

export function clampScore(score: number): number {
  return Math.max(-1.0, Math.min(1.0, score));
}

// Ordered left → right for consistent display
export const POLITICAL_LEANING_ORDER = [
  'Extrema Esquerda',
  'Esquerda',
  'Centro-Esquerda',
  'Centro',
  'Centro-Liberal',
  'Centro-Direita',
  'Direita',
  'Extrema Direita',
  'Libertário',
  'Apolítico',
] as const;

export const POLITICAL_COLORS: Record<string, string> = {
  'Extrema Esquerda': '#ef4444',
  Esquerda: '#f87171',
  'Centro-Esquerda': '#fb923c',
  Centro: '#fbbf24',
  'Centro-Liberal': '#a3e635',
  'Centro-Direita': '#38bdf8',
  Direita: '#6366f1',
  'Extrema Direita': '#8b5cf6',
  Libertário: '#22d3ee',
  Apolítico: '#71717a',
};

export const MACRO_LABELS: Record<string, string> = {
  P: 'Progressista',
  M: 'Moderado',
  C: 'Conservador',
  T: 'Transversal',
};
