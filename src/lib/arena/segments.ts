/**
 * Segment breakdown computation for Arena results.
 * Groups personas by demographic dimensions and counts sentiment.
 */

import type { Sentiment } from './types';

export interface SegmentItem {
  label: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface AllSegments {
  gender: SegmentItem[];
  religion: SegmentItem[];
  race: SegmentItem[];
  region: SegmentItem[];
  generation: SegmentItem[];
  socialClass: SegmentItem[];
  education: SegmentItem[];
  politicalLeaning: SegmentItem[];
  // ── New: political / ideological segments ──
  voto2022: SegmentItem[];
  aprovacaoLula: SegmentItem[];
  voto2026: SegmentItem[];
  archetype: SegmentItem[];
  clusterMacro: SegmentItem[];
  scoreEco: SegmentItem[];
  scoreCost: SegmentItem[];
}

type SentimentGetter = (persona: Record<string, any>) => Sentiment;

function accumulate(
  map: Map<string, { count: number; positive: number; negative: number; neutral: number }>,
  key: string,
  sentiment: Sentiment,
) {
  if (!key || key === 'undefined' || key === 'null') return;
  if (!map.has(key)) map.set(key, { count: 0, positive: 0, negative: 0, neutral: 0 });
  const entry = map.get(key)!;
  entry.count++;
  entry[sentiment]++;
}

function mapToSegments(
  map: Map<string, { count: number; positive: number; negative: number; neutral: number }>,
): SegmentItem[] {
  return Array.from(map.entries())
    .map(([label, d]) => ({ label, ...d }))
    .sort((a, b) => b.count - a.count);
}

/* ── Helpers for bucketing continuous scores ── */

function bucketEco(score: number): string {
  if (score <= -0.5) return 'Esquerda Forte';
  if (score <= -0.1) return 'Centro-Esquerda';
  if (score <= 0.1) return 'Centro';
  if (score <= 0.5) return 'Centro-Direita';
  return 'Direita Forte';
}

function bucketCost(score: number): string {
  if (score <= -0.5) return 'Progressista Forte';
  if (score <= -0.1) return 'Progressista';
  if (score <= 0.1) return 'Centro';
  if (score <= 0.5) return 'Conservador';
  return 'Conservador Forte';
}

const CLUSTER_MACRO: Record<string, string> = {
  P: 'Progressista', M: 'Moderado', C: 'Conservador', T: 'Transversal',
};

/** Normalize voto_2022 free-text to canonical labels */
function normalizeVoto(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (/lula|13|pt/.test(v)) return 'Lula';
  if (/bolsonaro|22|pl/.test(v)) return 'Bolsonaro';
  if (/nulo|branco|nenhum/.test(v)) return 'Nulo/Branco';
  if (/n[aã]o\s*vot|abst/.test(v)) return 'Não votou';
  if (/ciro|12/.test(v)) return 'Ciro';
  if (/simone|tebet|15/.test(v)) return 'Tebet';
  return raw; // keep as-is if unrecognized
}

/**
 * Incremental segment accumulator.
 * Call addPersona() for each persona, then call toSegments() to get results.
 */
export class SegmentAccumulator {
  private genderMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private religionMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private raceMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private regionMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private genMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private classMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private eduMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private politicalMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  // New maps
  private voto2022Map = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private aprovLulaMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private voto2026Map = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private archetypeMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private clusterMacroMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private scoreEcoMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  private scoreCostMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();

  addPersona(p: Record<string, any>, sentiment: Sentiment) {
    accumulate(this.genderMap, p.gender_identity || p.gender || 'Outros', sentiment);
    accumulate(this.religionMap, p.macro_religion || 'Outros', sentiment);
    accumulate(this.raceMap, p.raca_cor || p.demographic_json?.identidade_basica?.etnia || 'Não informado', sentiment);
    accumulate(this.regionMap, p.region_br || 'Outros', sentiment);
    accumulate(this.genMap, p.generation || 'Outros', sentiment);
    accumulate(this.classMap, p.social_class ? `Classe ${p.social_class}` : 'Outros', sentiment);
    accumulate(this.eduMap, p.education_level || 'Outros', sentiment);
    accumulate(this.politicalMap, p.political_leaning || 'Outros', sentiment);
    // New segments
    if (p.voto_2022) accumulate(this.voto2022Map, normalizeVoto(p.voto_2022), sentiment);
    if (p.aprovacao_lula) accumulate(this.aprovLulaMap, p.aprovacao_lula, sentiment);
    if (p.voto_2026) accumulate(this.voto2026Map, p.voto_2026, sentiment);
    if (p.archetype_primary) accumulate(this.archetypeMap, p.archetype_primary, sentiment);
    const cid = p.cluster_id || '';
    if (cid && CLUSTER_MACRO[cid[0]]) accumulate(this.clusterMacroMap, CLUSTER_MACRO[cid[0]], sentiment);
    if (typeof p.score_economico === 'number') accumulate(this.scoreEcoMap, bucketEco(p.score_economico), sentiment);
    if (typeof p.score_costumes === 'number') accumulate(this.scoreCostMap, bucketCost(p.score_costumes), sentiment);
  }

  toSegments(): AllSegments {
    return {
      gender: mapToSegments(this.genderMap),
      religion: mapToSegments(this.religionMap),
      race: mapToSegments(this.raceMap),
      region: mapToSegments(this.regionMap),
      generation: mapToSegments(this.genMap),
      socialClass: mapToSegments(this.classMap),
      education: mapToSegments(this.eduMap),
      politicalLeaning: mapToSegments(this.politicalMap),
      voto2022: mapToSegments(this.voto2022Map),
      aprovacaoLula: mapToSegments(this.aprovLulaMap),
      voto2026: mapToSegments(this.voto2026Map),
      archetype: mapToSegments(this.archetypeMap),
      clusterMacro: mapToSegments(this.clusterMacroMap),
      scoreEco: mapToSegments(this.scoreEcoMap),
      scoreCost: mapToSegments(this.scoreCostMap),
    };
  }
}

export function computeAllSegments(
  personas: Record<string, any>[],
  getSentiment: SentimentGetter,
): AllSegments {
  const acc = new SegmentAccumulator();
  for (const p of personas) {
    acc.addPersona(p, getSentiment(p));
  }
  return acc.toSegments();
}
