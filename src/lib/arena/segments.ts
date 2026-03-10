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

/**
 * Compute all demographic segment breakdowns from persona data.
 * @param personas Array of persona records
 * @param getSentiment Function that returns the sentiment for each persona
 */
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

  addPersona(p: Record<string, any>, sentiment: Sentiment) {
    accumulate(this.genderMap, p.gender_identity || p.gender || 'Outros', sentiment);
    accumulate(this.religionMap, p.macro_religion || 'Outros', sentiment);
    accumulate(this.raceMap, p.raca_cor || p.demographic_json?.identidade_basica?.etnia || 'Não informado', sentiment);
    accumulate(this.regionMap, p.region_br || 'Outros', sentiment);
    accumulate(this.genMap, p.generation || 'Outros', sentiment);
    accumulate(this.classMap, p.social_class ? `Classe ${p.social_class}` : 'Outros', sentiment);
    accumulate(this.eduMap, p.education_level || 'Outros', sentiment);
    accumulate(this.politicalMap, p.political_leaning || 'Outros', sentiment);
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
    };
  }
}

export function computeAllSegments(
  personas: Record<string, any>[],
  getSentiment: SentimentGetter,
): AllSegments {
  const genderMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const religionMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const raceMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const regionMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const genMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const classMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const eduMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const politicalMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();

  for (const p of personas) {
    const sentiment = getSentiment(p);

    accumulate(genderMap, p.gender_identity || p.gender || 'Outros', sentiment);
    accumulate(religionMap, p.macro_religion || 'Outros', sentiment);
    accumulate(raceMap, p.raca_cor || p.demographic_json?.identidade_basica?.etnia || 'Não informado', sentiment);
    accumulate(regionMap, p.region_br || 'Outros', sentiment);
    accumulate(genMap, p.generation || 'Outros', sentiment);
    accumulate(classMap, p.social_class ? `Classe ${p.social_class}` : 'Outros', sentiment);
    accumulate(eduMap, p.education_level || 'Outros', sentiment);
    accumulate(politicalMap, p.political_leaning || 'Outros', sentiment);
  }

  return {
    gender: mapToSegments(genderMap),
    religion: mapToSegments(religionMap),
    race: mapToSegments(raceMap),
    region: mapToSegments(regionMap),
    generation: mapToSegments(genMap),
    socialClass: mapToSegments(classMap),
    education: mapToSegments(eduMap),
    politicalLeaning: mapToSegments(politicalMap),
  };
}
