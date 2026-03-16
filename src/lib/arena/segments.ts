/**
 * Segment breakdown computation for Arena results.
 * Groups personas by demographic dimensions and counts sentiment.
 */

import type { Sentiment, ImpactScore } from './types';
import { scoreToSentiment } from './types';

export interface SegmentItem {
  label: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  /** Average 0-10 impact score for this segment */
  avgScore: number;
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
type ScoreGetter = (persona: Record<string, any>) => ImpactScore;

interface BucketEntry {
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  totalScore: number;
}

function accumulate(
  map: Map<string, BucketEntry>,
  key: string,
  sentiment: Sentiment,
  score?: number,
) {
  if (!key || key === 'undefined' || key === 'null') return;
  if (!map.has(key)) map.set(key, { count: 0, positive: 0, negative: 0, neutral: 0, totalScore: 0 });
  const entry = map.get(key)!;
  entry.count++;
  entry[sentiment]++;
  if (score !== undefined) entry.totalScore += score;
}

function mapToSegments(
  map: Map<string, BucketEntry>,
): SegmentItem[] {
  return Array.from(map.entries())
    .map(([label, d]) => ({
      label,
      count: d.count,
      positive: d.positive,
      negative: d.negative,
      neutral: d.neutral,
      avgScore: d.count > 0 ? Math.round((d.totalScore / d.count) * 10) / 10 : 5.0,
    }))
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
  private genderMap = new Map<string, BucketEntry>();
  private religionMap = new Map<string, BucketEntry>();
  private raceMap = new Map<string, BucketEntry>();
  private regionMap = new Map<string, BucketEntry>();
  private genMap = new Map<string, BucketEntry>();
  private classMap = new Map<string, BucketEntry>();
  private eduMap = new Map<string, BucketEntry>();
  private politicalMap = new Map<string, BucketEntry>();
  private voto2022Map = new Map<string, BucketEntry>();
  private aprovLulaMap = new Map<string, BucketEntry>();
  private voto2026Map = new Map<string, BucketEntry>();
  private archetypeMap = new Map<string, BucketEntry>();
  private clusterMacroMap = new Map<string, BucketEntry>();
  private scoreEcoMap = new Map<string, BucketEntry>();
  private scoreCostMap = new Map<string, BucketEntry>();

  private _addInternal(p: Record<string, any>, sentiment: Sentiment, score?: number) {
    accumulate(this.genderMap, p.gender_identity || p.gender || 'Outros', sentiment, score);
    accumulate(this.religionMap, p.macro_religion || 'Outros', sentiment, score);
    accumulate(this.raceMap, p.raca_cor || p.demographic_json?.identidade_basica?.etnia || 'Não informado', sentiment, score);
    accumulate(this.regionMap, p.region_br || 'Outros', sentiment, score);
    accumulate(this.genMap, p.generation || 'Outros', sentiment, score);
    accumulate(this.classMap, p.social_class ? `Classe ${p.social_class}` : 'Outros', sentiment, score);
    accumulate(this.eduMap, p.education_level || 'Outros', sentiment, score);
    accumulate(this.politicalMap, p.political_leaning || 'Outros', sentiment, score);
    if (p.voto_2022) accumulate(this.voto2022Map, normalizeVoto(p.voto_2022), sentiment, score);
    if (p.aprovacao_lula) accumulate(this.aprovLulaMap, p.aprovacao_lula, sentiment, score);
    if (p.voto_2026) accumulate(this.voto2026Map, p.voto_2026, sentiment, score);
    if (p.archetype_primary) accumulate(this.archetypeMap, p.archetype_primary, sentiment, score);
    const cid = p.cluster_id || '';
    if (cid && CLUSTER_MACRO[cid[0]]) accumulate(this.clusterMacroMap, CLUSTER_MACRO[cid[0]], sentiment, score);
    if (typeof p.score_economico === 'number') accumulate(this.scoreEcoMap, bucketEco(p.score_economico), sentiment, score);
    if (typeof p.score_costumes === 'number') accumulate(this.scoreCostMap, bucketCost(p.score_costumes), sentiment, score);
  }

  /** Legacy: add persona with categorical sentiment */
  addPersona(p: Record<string, any>, sentiment: Sentiment) {
    this._addInternal(p, sentiment);
  }

  /** New: add persona with 0-10 score (derives categorical sentiment automatically) */
  addPersonaWithScore(p: Record<string, any>, score: ImpactScore) {
    const sentiment = scoreToSentiment(score);
    this._addInternal(p, sentiment, score);
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

export function computeAllSegmentsWithScore(
  personas: Record<string, any>[],
  getScore: ScoreGetter,
): AllSegments {
  const acc = new SegmentAccumulator();
  for (const p of personas) {
    acc.addPersonaWithScore(p, getScore(p));
  }
  return acc.toSegments();
}
