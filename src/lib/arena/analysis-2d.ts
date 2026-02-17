import type {
  Sentiment,
  IdeologicalPoint,
  Quadrant,
  QuadrantResult,
  RegionResult,
  GenerationResult,
  EducationResult,
  PoliticalFigure,
  PoliticalFigureDetection,
  IntensityBand,
  EnhancedSimulationResult,
  SimulationResult,
} from './types';
import { CLUSTERS } from './constants';
import { normalize, detectTopics, runSimulation } from './engine';

// ── Intensity by Magnitude (Section 5.1) ─────────────────────────────────────

export function computeIntensity(score: number): { level: string; factor: number } {
  const mag = Math.abs(score);
  if (mag < 0.2) return { level: 'fraco', factor: 0.3 };
  if (mag < 0.5) return { level: 'moderado', factor: 0.6 };
  if (mag < 0.7) return { level: 'forte', factor: 0.85 };
  return { level: 'extremo', factor: 1.0 };
}

// ── Education Modulation (Section 5.3) ───────────────────────────────────────

const EDUCATION_ORDER = ['Fundamental', 'Médio', 'Superior Incompleto', 'Superior Completo', 'Pós-Graduação/MBA', 'Mestrado/Doutorado'];

function educationIndex(level: string): number {
  const idx = EDUCATION_ORDER.indexOf(level);
  return idx >= 0 ? idx : 1;
}

export function modulateByEducation(
  intensity: number,
  educationLevel: string,
  sentiment: Sentiment,
): number {
  const eduIdx = educationIndex(educationLevel);
  // Higher education adds nuance (reduces extremism slightly)
  if (intensity > 0.7 && eduIdx >= 3) {
    return intensity * (1 - (eduIdx - 2) * 0.05);
  }
  return intensity;
}

// ── Quadrant Classification ──────────────────────────────────────────────────

export function classifyQuadrant(scoreEco: number, scoreCost: number): Quadrant {
  if (scoreEco <= 0 && scoreCost <= 0) return 'esq_progressista';
  if (scoreEco <= 0 && scoreCost > 0) return 'esq_conservador';
  if (scoreEco > 0 && scoreCost > 0) return 'dir_conservador';
  return 'dir_progressista';
}

const QUADRANT_LABELS: Record<Quadrant, string> = {
  esq_progressista: 'Esquerda + Progressista',
  esq_conservador: 'Esquerda + Conservador',
  dir_conservador: 'Direita + Conservador',
  dir_progressista: 'Direita + Progressista',
};

// ── Question Polarity Detection ──────────────────────────────────────────────

const ADVERSARIAL_KEYWORDS = [
  'preso', 'prender', 'condenar', 'punir', 'cadeia', 'culpado', 'corrupto',
  'ladrao', 'criminoso', 'cassado', 'impeach', 'banir', 'expuls', 'derrub',
  'julgado', 'investigad', 'indiciado', 'condena', 'roubo',
  'renunci', 'demiti', 'tirar', 'acabar', 'errad', 'fracass', 'incompetent',
];

const SUPPORTIVE_KEYWORDS = [
  'bom', 'melhor', 'excelente', 'competente', 'inocente', 'voltar', 'retorn',
  'apoiar', 'defende', 'correto', 'certo', 'grande', 'heroi',
  'genial', 'admirav', 'benefici', 'ajud', 'trabalho', 'gestao', 'acert',
];

export type QuestionPolarity = 'adversarial' | 'supportive' | 'neutral';

export function detectQuestionPolarity(question: string, figure: PoliticalFigure): QuestionPolarity {
  const norm = normalize(question);
  let advScore = 0;
  let supScore = 0;
  for (const kw of ADVERSARIAL_KEYWORDS) { if (norm.includes(kw)) advScore++; }
  for (const kw of SUPPORTIVE_KEYWORDS) { if (norm.includes(kw)) supScore++; }
  if (advScore > supScore && advScore > 0) return 'adversarial';
  if (supScore > advScore && supScore > 0) return 'supportive';
  return 'neutral';
}

// ── Political Figure Detection (Section 5.5) ─────────────────────────────────

export function detectPoliticalFigures(question: string): PoliticalFigure[] {
  const norm = normalize(question);
  const figures: PoliticalFigure[] = [];
  if (norm.includes('lula') || norm.includes('pt ') || norm.includes(' pt') || norm.includes('petista') || norm.includes('petralha') || norm.includes('partido dos trabalhadores')) {
    figures.push('lula');
  }
  if (norm.includes('bolsonaro') || norm.includes('mito') || norm.includes('capitao') || norm.includes('jair') || norm.includes('bolsonarismo') || norm.includes('bolsonarista')) {
    figures.push('bolsonaro');
  }
  return figures;
}

/**
 * Determines how a persona feels about a question involving a political figure.
 * When polarity='neutral' (default), returns the persona's raw stance toward the figure.
 * When polarity='adversarial' (e.g. "Lula deveria estar preso"), inverts:
 *   - Supporter of figure → DISAGREES with the adversarial proposition
 *   - Opponent of figure → AGREES with the adversarial proposition
 */
export function adjustSentimentForPoliticalFigure(
  scoreEco: number,
  scoreCost: number,
  figure: PoliticalFigure,
  polarity: QuestionPolarity = 'neutral',
): Sentiment {
  // 1. Determine persona's stance toward the political figure
  let figureStance: Sentiment = 'neutral';

  if (figure === 'lula') {
    if (scoreEco < -0.3) figureStance = 'positive';
    else if (scoreEco > 0.3) figureStance = 'negative';
  } else {
    // Bolsonaro
    if (scoreEco > 0.2 && scoreCost > 0.5) figureStance = 'positive';
    else if (scoreEco < -0.3 || scoreCost < -0.3) figureStance = 'negative';
  }

  // 2. Map figure stance to question sentiment based on polarity
  if (polarity === 'adversarial' && figureStance !== 'neutral') {
    // Question is AGAINST the figure → invert
    // Supporters of figure DISAGREE with question, opponents AGREE
    return figureStance === 'positive' ? 'negative' : 'positive';
  }

  // supportive or neutral: figure stance maps directly to question sentiment
  return figureStance;
}

// ── 2D Sentiment Simulation (Section 5.4) ────────────────────────────────────

export function simulate2DSentiment(
  persona: Record<string, any>,
  topicScores: Record<string, number>,
  question: string,
): Sentiment {
  const ecoScore = persona.score_economico ?? 0;
  const costScore = persona.score_costumes ?? 0;

  // Check for political figure mentions first
  const figures = detectPoliticalFigures(question);
  if (figures.length > 0) {
    const polarity = detectQuestionPolarity(question, figures[0]);
    const figureSentiment = adjustSentimentForPoliticalFigure(ecoScore, costScore, figures[0], polarity);
    // 75% use figure-based sentiment, 25% fall through to topic analysis for variance
    if (Math.random() > 0.25) return figureSentiment;
  }

  // Topic-based sentiment using 2D scores
  // For 'general', derive bias from the persona's dominant ideological axis
  // so personas with strong opinions don't default to neutral
  const dominantAxis = Math.abs(ecoScore) > Math.abs(costScore) ? ecoScore : costScore;
  const generalBias = 0.5 + dominantAxis * 0.35;

  const biasMap: Record<string, number> = {
    crime: 0.5 + costScore * 0.5,
    social: 0.5 - costScore * 0.5,
    economy: 0.5 + ecoScore * 0.5,
    politics: 0.5 + ecoScore * 0.25 + costScore * 0.2,
    environment: 0.5 - ecoScore * 0.35,
    general: generalBias,
  };

  let weightedScore = 0;
  let totalWeight = 0;

  for (const [topic, score] of Object.entries(topicScores)) {
    if (score > 0) {
      const bias = biasMap[topic] ?? 0.5;
      weightedScore += bias * score;
      totalWeight += score;
    }
  }

  const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;

  // Modulate by intensity
  const ecoIntensity = computeIntensity(ecoScore);
  const costIntensity = computeIntensity(costScore);
  const avgIntensity = (ecoIntensity.factor + costIntensity.factor) / 2;

  // More extreme scores = less noise, more deterministic
  const noiseRange = 0.2 * (1 - avgIntensity * 0.6);
  const noise = (Math.random() - 0.5) * noiseRange;

  // Education modulation
  const eduLevel = persona.education_level || 'Médio';
  const modulatedScore = modulateByEducation(baseScore + noise, eduLevel, 'neutral');
  const finalScore = Math.max(0, Math.min(1, modulatedScore));

  // Narrower neutral band: only truly centrist personas remain neutral
  if (finalScore > 0.53) return 'positive';
  if (finalScore < 0.47) return 'negative';
  return 'neutral';
}

// ── Aggregate Analyzers ──────────────────────────────────────────────────────

export function analyzeQuadrants(
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
  question: string,
): QuadrantResult[] {
  const quadrantMap = new Map<Quadrant, { count: number; positive: number; negative: number; neutral: number; clusterCounts: Map<string, number> }>();

  for (const p of personas) {
    const eco = p.score_economico ?? 0;
    const cost = p.score_costumes ?? 0;
    const q = classifyQuadrant(eco, cost);

    if (!quadrantMap.has(q)) {
      quadrantMap.set(q, { count: 0, positive: 0, negative: 0, neutral: 0, clusterCounts: new Map() });
    }
    const entry = quadrantMap.get(q)!;
    entry.count++;

    const sentiment = simulate2DSentiment(p, topicScores, question);
    if (sentiment === 'positive') entry.positive++;
    else if (sentiment === 'negative') entry.negative++;
    else entry.neutral++;

    const cid = p.cluster_id || '?';
    entry.clusterCounts.set(cid, (entry.clusterCounts.get(cid) || 0) + 1);
  }

  const results: QuadrantResult[] = [];
  for (const [quadrant, data] of quadrantMap.entries()) {
    const sortedClusters = [...data.clusterCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    results.push({
      quadrant,
      label: QUADRANT_LABELS[quadrant],
      count: data.count,
      positive: data.positive,
      negative: data.negative,
      neutral: data.neutral,
      dominantClusters: sortedClusters,
    });
  }

  return results;
}

export function analyzeRegions(
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
  question: string,
): RegionResult[] {
  const regionMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();

  for (const p of personas) {
    const region = p.region_br || 'Não informado';
    if (!regionMap.has(region)) regionMap.set(region, { count: 0, positive: 0, negative: 0, neutral: 0 });
    const entry = regionMap.get(region)!;
    entry.count++;

    const sentiment = simulate2DSentiment(p, topicScores, question);
    if (sentiment === 'positive') entry.positive++;
    else if (sentiment === 'negative') entry.negative++;
    else entry.neutral++;
  }

  return [...regionMap.entries()].map(([region, data]) => ({
    region,
    ...data,
  })).sort((a, b) => b.count - a.count);
}

export function analyzeGenerations(
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
  question: string,
): GenerationResult[] {
  const genMap = new Map<string, { count: number; positive: number; negative: number; neutral: number; totalAge: number }>();

  for (const p of personas) {
    const gen = p.generation || 'Não informado';
    if (!genMap.has(gen)) genMap.set(gen, { count: 0, positive: 0, negative: 0, neutral: 0, totalAge: 0 });
    const entry = genMap.get(gen)!;
    entry.count++;
    entry.totalAge += p.age || 0;

    const sentiment = simulate2DSentiment(p, topicScores, question);
    if (sentiment === 'positive') entry.positive++;
    else if (sentiment === 'negative') entry.negative++;
    else entry.neutral++;
  }

  return [...genMap.entries()].map(([generation, data]) => ({
    generation,
    count: data.count,
    positive: data.positive,
    negative: data.negative,
    neutral: data.neutral,
    avgAge: data.count > 0 ? Math.round(data.totalAge / data.count) : 0,
  }));
}

export function analyzeEducation(
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
  question: string,
): EducationResult[] {
  const eduMap = new Map<string, { count: number; positive: number; negative: number; neutral: number; totalIntensity: number }>();

  for (const p of personas) {
    const level = p.education_level || 'Não informado';
    if (!eduMap.has(level)) eduMap.set(level, { count: 0, positive: 0, negative: 0, neutral: 0, totalIntensity: 0 });
    const entry = eduMap.get(level)!;
    entry.count++;

    const eco = Math.abs(p.score_economico ?? 0);
    const cost = Math.abs(p.score_costumes ?? 0);
    entry.totalIntensity += (eco + cost) / 2;

    const sentiment = simulate2DSentiment(p, topicScores, question);
    if (sentiment === 'positive') entry.positive++;
    else if (sentiment === 'negative') entry.negative++;
    else entry.neutral++;
  }

  return [...eduMap.entries()]
    .map(([level, data]) => ({
      level,
      count: data.count,
      positive: data.positive,
      negative: data.negative,
      neutral: data.neutral,
      avgIntensity: data.count > 0 ? data.totalIntensity / data.count : 0,
    }))
    .sort((a, b) => EDUCATION_ORDER.indexOf(a.level) - EDUCATION_ORDER.indexOf(b.level));
}

export function buildIdeologicalScatter(
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
  question: string,
): IdeologicalPoint[] {
  return personas
    .filter(p => p.score_economico != null && p.score_costumes != null)
    .map(p => ({
      personaId: p.id || p.name,
      name: p.name || 'Persona',
      scoreEco: p.score_economico,
      scoreCost: p.score_costumes,
      clusterId: p.cluster_id || '?',
      clusterName: p.nome_grupo || 'Desconhecido',
      sentiment: simulate2DSentiment(p, topicScores, question),
      region: p.region_br || 'Não informado',
      generation: p.generation || 'Não informado',
      educationLevel: p.education_level || 'Não informado',
    }));
}

export function computeIntensityCorrelation(
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
  question: string,
): IntensityBand[] {
  const bands: IntensityBand[] = [
    { label: 'Fraco (0-0.2)', range: [0, 0.2], count: 0, avgSentimentScore: 0 },
    { label: 'Moderado (0.2-0.5)', range: [0.2, 0.5], count: 0, avgSentimentScore: 0 },
    { label: 'Forte (0.5-0.7)', range: [0.5, 0.7], count: 0, avgSentimentScore: 0 },
    { label: 'Extremo (0.7-1.0)', range: [0.7, 1.0], count: 0, avgSentimentScore: 0 },
  ];

  const totals = bands.map(() => 0);

  for (const p of personas) {
    const eco = Math.abs(p.score_economico ?? 0);
    const cost = Math.abs(p.score_costumes ?? 0);
    const magnitude = (eco + cost) / 2;

    const sentiment = simulate2DSentiment(p, topicScores, question);
    const sentScore = sentiment === 'positive' ? 1 : sentiment === 'negative' ? -1 : 0;

    for (let i = 0; i < bands.length; i++) {
      if (magnitude >= bands[i].range[0] && magnitude < bands[i].range[1]) {
        bands[i].count++;
        totals[i] += sentScore;
        break;
      }
      // Last band includes upper bound
      if (i === bands.length - 1 && magnitude >= bands[i].range[0]) {
        bands[i].count++;
        totals[i] += sentScore;
      }
    }
  }

  for (let i = 0; i < bands.length; i++) {
    bands[i].avgSentimentScore = bands[i].count > 0 ? totals[i] / bands[i].count : 0;
  }

  return bands;
}

function analyzePoliticalFigures(
  personas: Record<string, any>[],
  figures: PoliticalFigure[],
): PoliticalFigureDetection[] {
  return figures.map(figure => {
    let supportCount = 0;
    let attackCount = 0;
    let neutralCount = 0;
    const supportClusterCounts = new Map<string, number>();
    const attackClusterCounts = new Map<string, number>();

    for (const p of personas) {
      const eco = p.score_economico ?? 0;
      const cost = p.score_costumes ?? 0;
      const sentiment = adjustSentimentForPoliticalFigure(eco, cost, figure);
      const cid = p.cluster_id || '?';

      if (sentiment === 'positive') {
        supportCount++;
        supportClusterCounts.set(cid, (supportClusterCounts.get(cid) || 0) + 1);
      } else if (sentiment === 'negative') {
        attackCount++;
        attackClusterCounts.set(cid, (attackClusterCounts.get(cid) || 0) + 1);
      } else {
        neutralCount++;
      }
    }

    const topSupport = [...supportClusterCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const topAttack = [...attackClusterCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);

    return {
      figure,
      label: figure === 'lula' ? 'Lula (PT)' : 'Bolsonaro',
      supportCount,
      attackCount,
      neutralCount,
      supportClusters: topSupport,
      attackClusters: topAttack,
    };
  });
}

// ── Enhanced Simulation ──────────────────────────────────────────────────────

export function runEnhancedSimulation(
  question: string,
  personaCount: number,
  personas: Record<string, any>[],
): EnhancedSimulationResult {
  // 1. Run base simulation (archetypes + clusters)
  const base = runSimulation(question, personaCount, personas);

  // 2. Detect topics for 2D analysis
  const topicScores = detectTopics(question);

  // 3. Build ideological scatter
  const ideologicalPoints = buildIdeologicalScatter(personas, topicScores, question);

  // 4. Analyze quadrants
  const quadrants = analyzeQuadrants(personas, topicScores, question);

  // 5. Regional breakdown
  const regions = analyzeRegions(personas, topicScores, question);

  // 6. Generational breakdown
  const generations = analyzeGenerations(personas, topicScores, question);

  // 7. Education analysis
  const educationLevels = analyzeEducation(personas, topicScores, question);

  // 8. Political figure detection
  const detectedFigures = detectPoliticalFigures(question);
  const politicalFigures = analyzePoliticalFigures(personas, detectedFigures);

  // 9. Intensity correlation
  const intensityBands = computeIntensityCorrelation(personas, topicScores, question);

  return {
    ...base,
    comments: [],
    ideologicalPoints,
    quadrants,
    regions,
    generations,
    educationLevels,
    politicalFigures,
    intensityBands,
  };
}
