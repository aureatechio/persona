import type { Sentiment, ArchetypeResult, ClusterResult, SimulationResult } from './types';
import type { PersonaContext } from '@/lib/persona-writing-style';
import type { PersonaForAI } from '@/lib/simulation-prompt';
import {
  ARCHETYPES,
  CLUSTERS,
  BASE_DISTRIBUTION,
  TOPICS,
  TOPIC_DISTRIBUTIONS,
  ARCHETYPE_SCORERS,
  ARCHETYPE_TO_POLITICAL,
} from './constants';

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Topic Detection ──────────────────────────────────────────────────────────

export function detectTopics(question: string): Record<string, number> {
  const norm = normalize(question);
  const scores: Record<string, number> = {};

  for (const [topic, keywords] of Object.entries(TOPICS)) {
    let score = 0;
    for (const kw of keywords) {
      if (norm.includes(normalize(kw))) score++;
    }
    scores[topic] = Math.min(score / 3, 1);
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) {
    for (const topic of Object.keys(scores)) {
      scores[topic] = 0.3;
    }
    scores['general'] = 1;
  }

  return scores;
}

export function getTopicDistribution(topicScores: Record<string, number>): number[] {
  const result = new Array(ARCHETYPES.length).fill(0);
  let totalWeight = 0;

  for (const [topic, score] of Object.entries(topicScores)) {
    if (score <= 0) continue;
    const dist = TOPIC_DISTRIBUTIONS[topic] || TOPIC_DISTRIBUTIONS['general'];
    for (let i = 0; i < ARCHETYPES.length; i++) {
      result[i] += dist[i] * score;
    }
    totalWeight += score;
  }

  if (totalWeight === 0) return BASE_DISTRIBUTION;

  const sum = result.reduce((a, b) => a + b, 0);
  return result.map(v => v / sum);
}

// ── Sentiment Simulation ─────────────────────────────────────────────────────

export function simulatePersonaSentiment(
  topicScores: Record<string, number>,
  archetype: typeof ARCHETYPES[0]
): Sentiment {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [topic, score] of Object.entries(topicScores)) {
    if (score > 0) {
      const bias = archetype.sentimentBias[topic as keyof typeof archetype.sentimentBias] ?? 0.5;
      weightedScore += bias * score;
      totalWeight += score;
    }
  }

  const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  const noise = (Math.random() - 0.5) * 0.3;
  const finalScore = Math.max(0, Math.min(1, baseScore + noise));

  if (finalScore > 0.52) return 'positive';
  if (finalScore < 0.48) return 'negative';
  return 'neutral';
}

// ── Persona Mapping ──────────────────────────────────────────────────────────

export function toPersonaContext(persona: Record<string, any>, archetypeId: string): PersonaContext {
  return {
    region: persona.region_br || 'Sudeste',
    state: persona.state || 'SP',
    generation: persona.generation || 'Millennial',
    educationLevel: persona.education_level || 'Médio',
    socialClass: persona.social_class || 'C1',
    politicalLeaning: persona.political_leaning || 'Centro',
    religion: persona.macro_religion || 'Católico',
    age: persona.age || 30,
    gender: persona.gender_identity || 'Masculino',
    areaType: persona.area_type || 'Urbana/Interior',
    archetypeId,
    name: persona.name || 'Persona',
    clusterName: persona.nome_grupo || undefined,
    scoreEconomico: persona.score_economico ?? undefined,
    scoreCostumes: persona.score_costumes ?? undefined,
  };
}

export function mapPersona(persona: Record<string, any>, archetypeId: string, sentiment: Sentiment): PersonaForAI {
  return {
    name: persona.name || 'Anônimo',
    age: persona.age || 30,
    state: persona.state || 'SP',
    region: persona.region_br || 'Sudeste',
    generation: persona.generation || 'Millennial',
    educationLevel: persona.education_level || 'Médio',
    socialClass: persona.social_class || 'C1',
    politicalLeaning: persona.political_leaning || 'Centro',
    religion: persona.macro_religion || 'Católico',
    areaType: persona.area_type || 'Urbana/Interior',
    archetypeId,
    sentiment,
    gender: persona.gender_identity || persona.gender || 'Masculino',
    ethnicity: persona.raca_cor || persona.demographic_json?.identidade_basica?.etnia || 'Não informado',
    civilStatus: persona.civil_status || 'Solteiro',
    occupation: persona.career_json?.atuação_e_cargo?.cargo_atual || persona.career_json?.atuacao_e_cargo?.cargo_atual || 'Trabalhador',
    clusterId: persona.cluster_id || undefined,
    clusterName: persona.nome_grupo || undefined,
    scoreEconomico: persona.score_economico ?? undefined,
    scoreCostumes: persona.score_costumes ?? undefined,
    voto2022: persona.voto_2022 || undefined,
    aprovacaoLula: persona.aprovacao_lula || undefined,
    voto2026: persona.voto_2026 || undefined,
    temaAborto: persona.tema_aborto || undefined,
    temaArmas: persona.tema_armas || undefined,
    temaMaconha: persona.tema_maconha || undefined,
    temaPrivatizacoes: persona.tema_privatizacoes || undefined,
    temaCotasRaciais: persona.tema_cotas_raciais || undefined,
    temaCasamentoGay: persona.tema_casamento_gay || undefined,
    recebeBeneficio: persona.recebe_beneficio || undefined,
    usaTransportePublico: persona.usa_transporte_publico || undefined,
    religiaoSubtipo: persona.religiao_subtipo || undefined,
    timeFutebol: persona.time_futebol || undefined,
    // Key questionnaire responses
    qMaiorProblema: persona.q_maior_problema || undefined,
    qAvaliacaoBolsonaro: persona.q_avaliacao_bolsonaro || undefined,
    qPoliticoFavorito: persona.q_politico_favorito || undefined,
    qSituacaoEconomica: persona.q_situacao_economica || undefined,
    qPerspectivaFuturo: persona.q_perspectiva_futuro || undefined,
    qMidiaPrincipal: persona.q_midia_principal || undefined,
    qVotoInfluenciadoPor: persona.q_voto_influenciado_por || undefined,
    qImpeachmentLula: persona.q_impeachment_lula || undefined,
    qIntervencaoMilitar: persona.q_intervencao_militar || undefined,
    qFamiliaTradicional: persona.q_familia_tradicional || undefined,
    qRacismoEstrutural: persona.q_racismo_estrutural || undefined,
    qMeritocracia: persona.q_meritocracia || undefined,
    qReligiaoPolitica: persona.q_religiao_politica || undefined,
    qPenaMorte: persona.q_pena_morte || undefined,
    qDrogasDescriminalizar: persona.q_drogas_descriminalizar || undefined,
    qMudancaClimaticaReal: persona.q_mudanca_climatica_real || undefined,
    qSusFunciona: persona.q_sus_funciona || undefined,
    qConfiancaStf: persona.q_confianca_stf ?? undefined,
    qConfiancaImprensa: persona.q_confianca_imprensa ?? undefined,
    qConfiancaIgreja: persona.q_confianca_igreja ?? undefined,
    qConfiancaExercito: persona.q_confianca_exercito ?? undefined,
    qDemocraciaImportante: persona.q_democracia_importante ?? undefined,
  };
}

// ── Main Simulation ──────────────────────────────────────────────────────────

export function runSimulation(question: string, personaCount: number, personas?: Record<string, any>[]): Omit<SimulationResult, 'comments'> {
  const startTime = performance.now();
  const topicScores = detectTopics(question);
  const distribution = getTopicDistribution(topicScores);

  const archetypeResults: ArchetypeResult[] = [];
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;

  ARCHETYPES.forEach((archetype, idx) => {
    const count = Math.round(personaCount * distribution[idx]);
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (let i = 0; i < count; i++) {
      const sentiment = simulatePersonaSentiment(topicScores, archetype);
      if (sentiment === 'positive') positive++;
      else if (sentiment === 'negative') negative++;
      else neutral++;
    }

    totalPositive += positive;
    totalNegative += negative;
    totalNeutral += neutral;

    archetypeResults.push({
      id: archetype.id,
      name: archetype.name,
      count,
      positive,
      negative,
      neutral,
    });
  });

  // Cluster-level sentiment analysis
  const clusterResults: ClusterResult[] = [];
  if (personas && personas.length > 0) {
    const clusterMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();

    for (const p of personas) {
      const cid = p.cluster_id;
      if (!cid) continue;
      if (!clusterMap.has(cid)) clusterMap.set(cid, { count: 0, positive: 0, negative: 0, neutral: 0 });
      const entry = clusterMap.get(cid)!;
      entry.count++;

      const ecoScore = p.score_economico ?? 0;
      const costScore = p.score_costumes ?? 0;

      // For 'general', derive from dominant ideological axis
      const domAxis = Math.abs(ecoScore) > Math.abs(costScore) ? ecoScore : costScore;

      const pseudoBias = {
        crime: 0.5 + costScore * 0.5,
        social: 0.5 - costScore * 0.5,
        economy: 0.5 + ecoScore * 0.5,
        politics: 0.5 + ecoScore * 0.25 + costScore * 0.2,
        environment: 0.5 - ecoScore * 0.35,
        general: 0.5 + domAxis * 0.35,
      };

      let weightedScore = 0;
      let totalWeight = 0;
      for (const [topic, score] of Object.entries(topicScores)) {
        if (score > 0) {
          const bias = pseudoBias[topic as keyof typeof pseudoBias] ?? 0.5;
          weightedScore += bias * score;
          totalWeight += score;
        }
      }
      const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;
      // Scale noise inversely with ideological magnitude
      const magnitude = Math.sqrt(ecoScore * ecoScore + costScore * costScore) / Math.sqrt(2);
      const noiseRange = 0.2 * (1 - magnitude * 0.6);
      const noise = (Math.random() - 0.5) * noiseRange;
      const finalScore = Math.max(0, Math.min(1, baseScore + noise));

      // Narrower neutral band
      if (finalScore > 0.53) entry.positive++;
      else if (finalScore < 0.47) entry.negative++;
      else entry.neutral++;
    }

    for (const cluster of CLUSTERS) {
      const data = clusterMap.get(cluster.id);
      if (data && data.count > 0) {
        clusterResults.push({
          id: cluster.id,
          name: cluster.name,
          macro: cluster.macro,
          count: data.count,
          positive: data.positive,
          negative: data.negative,
          neutral: data.neutral,
        });
      }
    }
  }

  return {
    total: personaCount,
    positive: totalPositive,
    negative: totalNegative,
    neutral: totalNeutral,
    archetypes: archetypeResults,
    clusterResults,
    processingTime: performance.now() - startTime,
  };
}

// ── Persona Sentiment for AI Comments ────────────────────────────────────────

function computePersonaSentimentForAI(
  persona: Record<string, any>,
  topicScores: Record<string, number>,
  question: string,
): Sentiment {
  const ecoScore = persona.score_economico ?? 0;
  const costScore = persona.score_costumes ?? 0;
  const norm = normalize(question);

  // ── Political figure detection with polarity ──
  const hasLula = norm.includes('lula') || norm.includes('petista') || norm.includes(' pt ') || norm.includes('partido dos trabalhadores');
  const hasBolsonaro = norm.includes('bolsonaro') || norm.includes('bolsonarism') || norm.includes('capitao');

  if (hasLula || hasBolsonaro) {
    // Detect if question is adversarial or supportive toward the figure
    const advKws = ['preso', 'prender', 'condenar', 'punir', 'cadeia', 'culpado', 'corrupto', 'criminoso', 'cassado', 'impeach', 'condena', 'crime', 'renunci', 'demiti', 'errad', 'fracass', 'incompetent'];
    const supKws = ['bom', 'melhor', 'excelente', 'competente', 'inocente', 'voltar', 'retorn', 'apoiar', 'defende', 'correto', 'certo', 'heroi', 'benefici', 'ajud', 'trabalho', 'gestao', 'acert'];

    let adv = 0, sup = 0;
    for (const k of advKws) { if (norm.includes(k)) adv++; }
    for (const k of supKws) { if (norm.includes(k)) sup++; }
    const isAdversarial = adv > sup && adv > 0;

    // Determine persona's stance toward the figure
    let figureStance: Sentiment = 'neutral';
    if (hasLula) {
      if (ecoScore < -0.3) figureStance = 'positive';
      else if (ecoScore > 0.3) figureStance = 'negative';
    } else {
      if (ecoScore > 0.2 && costScore > 0.5) figureStance = 'positive';
      else if (ecoScore < -0.3 || costScore < -0.3) figureStance = 'negative';
    }

    // Invert for adversarial questions (e.g. "Lula deveria estar preso")
    if (isAdversarial && figureStance !== 'neutral') {
      figureStance = figureStance === 'positive' ? 'negative' : 'positive';
    }

    // 75% use figure sentiment, 25% fall through to topic analysis
    if (Math.random() > 0.25) return figureStance;
  }

  // ── Topic-based sentiment ──
  // For 'general', derive from dominant ideological axis instead of fixed 0.5
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
  const noise = (Math.random() - 0.5) * 0.15;
  const finalScore = Math.max(0, Math.min(1, baseScore + noise));

  // Narrower neutral band
  if (finalScore > 0.53) return 'positive';
  if (finalScore < 0.47) return 'negative';
  return 'neutral';
}

// ── Build Personas for AI ────────────────────────────────────────────────────

export function buildPersonasForAI(
  question: string,
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
): PersonaForAI[] {
  const TOTAL_COMMENTS = 35;
  const result: PersonaForAI[] = [];
  const usedIds = new Set<string>();

  const distribution = getTopicDistribution(topicScores);
  const rawCounts = ARCHETYPES.map((_, idx) => distribution[idx] * TOTAL_COMMENTS);
  const commentCounts = rawCounts.map(c => Math.max(2, Math.round(c)));

  let currentTotal = commentCounts.reduce((a, b) => a + b, 0);
  while (currentTotal > TOTAL_COMMENTS) {
    const maxIdx = commentCounts.indexOf(Math.max(...commentCounts));
    commentCounts[maxIdx]--;
    currentTotal--;
  }
  while (currentTotal < TOTAL_COMMENTS) {
    const minIdx = commentCounts.indexOf(Math.min(...commentCounts));
    commentCounts[minIdx]++;
    currentTotal++;
  }

  for (let archIdx = 0; archIdx < ARCHETYPES.length; archIdx++) {
    const archetype = ARCHETYPES[archIdx];
    const count = commentCounts[archIdx];
    const scorer = ARCHETYPE_SCORERS[archetype.id];

    const scored = personas
      .map(p => ({ persona: p, score: scorer ? scorer(p) : 0 }))
      .filter(s => s.score >= 3)
      .sort((a, b) => b.score - a.score);

    const topTier = scored.slice(0, Math.max(50, count * 5));
    const matchingPersonas = shuffle(topTier.map(s => s.persona));

    const matchingPolitical = ARCHETYPE_TO_POLITICAL[archetype.id] || [];
    const fallbackPool = shuffle(
      personas.filter(p => matchingPolitical.includes(p.political_leaning))
    );

    for (let ci = 0; ci < count; ci++) {
      let persona: Record<string, any> | null = null;

      for (const p of matchingPersonas) {
        const pid = p.id || p.name;
        if (!usedIds.has(pid)) {
          persona = p;
          usedIds.add(pid);
          break;
        }
      }

      if (!persona) {
        for (const p of fallbackPool) {
          const pid = p.id || p.name;
          if (!usedIds.has(pid)) {
            persona = p;
            usedIds.add(pid);
            break;
          }
        }
      }

      if (!persona) {
        persona = {
          name: `Persona_${usedIds.size + 1}`,
          age: Math.floor(Math.random() * 50) + 18,
          state: pickRandom(['SP', 'RJ', 'MG', 'BA', 'RS', 'CE', 'PE', 'PA', 'GO', 'PR']),
          region_br: pickRandom(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']),
          generation: pickRandom(['Gen Z', 'Millennial', 'Gen X', 'Boomer']),
          education_level: pickRandom(['Fundamental', 'Médio', 'Superior Incompleto', 'Superior Completo']),
          social_class: pickRandom(['A', 'B1', 'B2', 'C1', 'C2', 'D', 'E']),
          political_leaning: pickRandom(matchingPolitical.length > 0 ? matchingPolitical : ['Centro']),
          macro_religion: pickRandom(['Católico', 'Evangélico', 'Espírita', 'Ateu']),
          gender_identity: pickRandom(['Masculino', 'Feminino']),
          area_type: pickRandom(['Capital/Metrópole', 'Urbana/Interior', 'Rural']),
          civil_status: pickRandom(['Solteiro', 'Casado', 'Divorciado']),
          demographic_json: { identidade_basica: { etnia: pickRandom(['Branco', 'Pardo', 'Negro', 'Amarelo']) } },
          career_json: { atuação_e_cargo: { cargo_atual: pickRandom(['Autônomo', 'Vendedor', 'Motorista', 'Doméstica', 'Empresário', 'Professor']) } },
        };
      }

      // Compute sentiment from persona's ideological scores + topic + question polarity
      const sentiment = computePersonaSentimentForAI(persona, topicScores, question);
      result.push(mapPersona(persona, archetype.id, sentiment));
    }
  }

  return shuffle(result);
}
