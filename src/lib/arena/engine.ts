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
} from './constants';
import { computePersonaSentiment } from './persona-sentiment';

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
    // Tabu Implícito (all 20)
    tiRacismoLatente: persona.q_ti_racismo_latente || undefined,
    tiNaoContratariaNegro: persona.q_ti_nao_contrataria_negro_chefia || undefined,
    tiVizinhoNegroIncomoda: persona.q_ti_vizinho_negro_incomoda || undefined,
    tiSonegaria: persona.q_ti_sonegaria_imposto || undefined,
    tiAceitariaPropina: persona.q_ti_aceitaria_propina || undefined,
    tiVenderiaVoto: persona.q_ti_venderia_voto || undefined,
    tiBaterFilho: persona.q_ti_bater_filho_normal || undefined,
    tiMulherRoupaCulpada: persona.q_ti_mulher_roupa_culpada || undefined,
    tiHomofobiaViolenta: persona.q_ti_homofobia_violenta || undefined,
    tiLinchamento: persona.q_ti_linchamento_apoiaria || undefined,
    tiTorturaPreso: persona.q_ti_tortura_preso_ok || undefined,
    tiTrabalhoInfantil: persona.q_ti_trabalho_infantil_ok || undefined,
    tiJeitinhoFila: persona.q_ti_jeitinho_furar_fila || undefined,
    tiAssediariaMulherRua: persona.q_ti_assediaria_mulher_rua || undefined,
    tiIntoleranciaReligiosa: persona.q_ti_intolerancia_religiosa || undefined,
    tiPreconceitoNordestino: persona.q_ti_preconceito_nordestino || undefined,
    tiViolenciaDomestica: persona.q_ti_violencia_domestica || undefined,
    tiComprariaRoubado: persona.q_ti_compraria_produto_roubado || undefined,
    tiMenor14SabeOQueFaz: persona.q_ti_menor14_sabe_o_que_faz || undefined,
    tiNepotismoConcurso: persona.q_ti_nepotismo_concurso || undefined,
    // Vivências (all 18)
    viAbusoSexualInfancia: persona.q_vi_abuso_sexual_infancia || undefined,
    viPassouFome: persona.q_vi_passou_fome || undefined,
    viTrabalhoInfantil: persona.q_vi_trabalho_infantil || undefined,
    viJaFoiAssaltado: persona.q_vi_ja_foi_assaltado || undefined,
    viPerdeuFamiliarViolencia: persona.q_vi_perdeu_familiar_violencia || undefined,
    viDesempregado1Ano: persona.q_vi_desempregado_1ano || undefined,
    viPaiAusente: persona.q_vi_pai_ausente || undefined,
    viSofreuRacismo: persona.q_vi_sofreu_racismo || undefined,
    viSofreuAssedioSexual: persona.q_vi_sofreu_assedio_sexual || undefined,
    viDepressaoAnsiedade: persona.q_vi_depressao_ansiedade || undefined,
    viPensouSuicidio: persona.q_vi_pensou_suicidio || undefined,
    viPresoOuFamiliarPreso: persona.q_vi_preso_ou_familiar_preso || undefined,
    viSofreuViolenciaDomestica: persona.q_vi_sofreu_violencia_domestica || undefined,
    viJaDormiuNaRua: persona.q_vi_ja_dormiu_na_rua || undefined,
    viViolenciaPolicial: persona.q_vi_violencia_policial || undefined,
    viNaoCompletouEstudo: persona.q_vi_nao_completou_estudo || undefined,
    viEnchenteDesastre: persona.q_vi_enchente_desastre || undefined,
    viDependencia: persona.q_vi_dependencia || undefined,
  };
}

// ── Main Simulation ──────────────────────────────────────────────────────────

export function runSimulation(question: string, personaCount: number, personas?: Record<string, any>[]): Omit<SimulationResult, 'comments'> {
  const startTime = performance.now();
  const topicScores = detectTopics(question);
  const distribution = getTopicDistribution(topicScores);

  // ── When we have REAL personas, use their ACTUAL DATA for everything ──
  if (personas && personas.length > 0) {
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;

    const clusterMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();

    // Compute sentiment for EACH persona using their real questionnaire data
    for (const p of personas) {
      const sentiment = computePersonaSentiment(p, question);

      if (sentiment === 'positive') totalPositive++;
      else if (sentiment === 'negative') totalNegative++;
      else totalNeutral++;

      // Also accumulate cluster-level results
      const cid = p.cluster_id;
      if (cid) {
        if (!clusterMap.has(cid)) clusterMap.set(cid, { count: 0, positive: 0, negative: 0, neutral: 0 });
        const entry = clusterMap.get(cid)!;
        entry.count++;
        if (sentiment === 'positive') entry.positive++;
        else if (sentiment === 'negative') entry.negative++;
        else entry.neutral++;
      }
    }

    // Build cluster results
    const clusterResults: ClusterResult[] = [];
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

    // Build archetype results (for display only — the TOTALS come from real data above)
    const archetypeResults: ArchetypeResult[] = [];
    ARCHETYPES.forEach((archetype, idx) => {
      const count = Math.round(personas.length * distribution[idx]);
      archetypeResults.push({
        id: archetype.id,
        name: archetype.name,
        count,
        positive: Math.round(count * (totalPositive / personas.length)),
        negative: Math.round(count * (totalNegative / personas.length)),
        neutral: Math.round(count * (totalNeutral / personas.length)),
      });
    });

    return {
      total: personas.length,
      positive: totalPositive,
      negative: totalNegative,
      neutral: totalNeutral,
      archetypes: archetypeResults,
      clusterResults,
      processingTime: performance.now() - startTime,
    };
  }

  // ── Fallback: no real personas available — use archetype-based simulation ──
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

  return {
    total: personaCount,
    positive: totalPositive,
    negative: totalNegative,
    neutral: totalNeutral,
    archetypes: archetypeResults,
    clusterResults: [],
    processingTime: performance.now() - startTime,
  };
}

// ── Archetype Matching (for writing style) ───────────────────────────────────

function findBestArchetype(persona: Record<string, any>): string {
  let bestId = 'progressista_base';
  let bestScore = 0;

  for (const [id, scorer] of Object.entries(ARCHETYPE_SCORERS)) {
    const score = scorer(persona);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}

// ── Proportional Slot Allocation ─────────────────────────────────────────────

function allocateSlots(
  posCount: number,
  negCount: number,
  neuCount: number,
  totalSlots: number,
): [number, number, number] {
  const total = posCount + negCount + neuCount;
  if (total === 0) return [0, 0, totalSlots];

  let pos = Math.round(totalSlots * (posCount / total));
  let neg = Math.round(totalSlots * (negCount / total));
  let neu = Math.round(totalSlots * (neuCount / total));

  // Guarantee at least 1 slot per non-empty group
  if (posCount > 0 && pos === 0) pos = 1;
  if (negCount > 0 && neg === 0) neg = 1;
  if (neuCount > 0 && neu === 0) neu = 1;

  let sum = pos + neg + neu;

  // Shrink from largest group to reach totalSlots
  while (sum > totalSlots) {
    if (neg >= pos && neg >= neu && neg > 1) neg--;
    else if (pos >= neu && pos > 1) pos--;
    else if (neu > 1) neu--;
    else if (neg > 1) neg--;
    else pos--;
    sum--;
  }

  // Grow smallest group to reach totalSlots (proportional preference)
  while (sum < totalSlots) {
    const posR = total > 0 ? posCount / total : 0;
    const negR = total > 0 ? negCount / total : 0;
    const neuR = total > 0 ? neuCount / total : 0;

    if (negR >= posR && negR >= neuR && negCount > 0) neg++;
    else if (posR >= neuR && posCount > 0) pos++;
    else if (neuCount > 0) neu++;
    else neg++;
    sum++;
  }

  return [pos, neg, neu];
}

// ── Build Personas for AI ────────────────────────────────────────────────────
//
// DATA-DRIVEN COMMENT SELECTION:
//
// 1. Computes sentiment for EVERY persona (20K) using their real data
// 2. Groups personas by sentiment (positive / negative / neutral)
// 3. Allocates comment slots PROPORTIONALLY to the actual distribution
// 4. Guarantees at least 1 comment per non-empty group (even if only 1%)
// 5. Selects diverse personas within each group (region, age, gender, cluster)
// 6. Assigns archetype label for writing style purposes only
//

export function buildPersonasForAI(
  question: string,
  personas: Record<string, any>[],
  topicScores: Record<string, number>,
): PersonaForAI[] {
  const TOTAL_COMMENTS = 35;

  // ── Step 1: Analyze ALL personas using their real questionnaire data ──

  const positivePool: Record<string, any>[] = [];
  const negativePool: Record<string, any>[] = [];
  const neutralPool: Record<string, any>[] = [];

  for (const p of personas) {
    const sentiment = computePersonaSentiment(p, question);
    if (sentiment === 'positive') positivePool.push(p);
    else if (sentiment === 'negative') negativePool.push(p);
    else neutralPool.push(p);
  }

  const total = personas.length || 1;
  const posPct = ((positivePool.length / total) * 100).toFixed(1);
  const negPct = ((negativePool.length / total) * 100).toFixed(1);
  const neuPct = ((neutralPool.length / total) * 100).toFixed(1);

  console.log(
    `[Arena] Massive data analysis: ${personas.length} personas analyzed → ` +
    `${positivePool.length} positive (${posPct}%), ` +
    `${negativePool.length} negative (${negPct}%), ` +
    `${neutralPool.length} neutral (${neuPct}%)`,
  );

  // ── Step 2: Allocate comment slots PROPORTIONALLY ──

  const [posSlots, negSlots, neuSlots] = allocateSlots(
    positivePool.length,
    negativePool.length,
    neutralPool.length,
    TOTAL_COMMENTS,
  );

  console.log(
    `[Arena] Comment slots: ${posSlots} positive, ${negSlots} negative, ${neuSlots} neutral = ${posSlots + negSlots + neuSlots} total`,
  );

  // ── Step 3: Select diverse personas from each sentiment group ──

  const result: PersonaForAI[] = [];
  const usedIds = new Set<string>();

  function selectDiverseFromPool(
    pool: Record<string, any>[],
    count: number,
    sentiment: Sentiment,
  ): void {
    if (pool.length === 0 || count <= 0) return;

    const shuffled = shuffle([...pool]);
    let selected = 0;

    // Diversity trackers
    const usedRegions = new Set<string>();
    const usedGenerations = new Set<string>();
    const usedClusters = new Set<string>();
    const usedGenders = new Set<string>();
    const usedStates = new Set<string>();
    const usedClasses = new Set<string>();

    // First pass: prioritize maximum diversity
    for (const p of shuffled) {
      if (selected >= count) break;
      const pid = p.id || p.name;
      if (usedIds.has(pid)) continue;

      const region = p.region_br || '';
      const gen = p.generation || '';
      const cluster = p.cluster_id || '';
      const gender = p.gender_identity || '';
      const state = p.state || '';
      const sclass = p.social_class || '';

      const newDimensions =
        (region && !usedRegions.has(region) ? 1 : 0) +
        (gen && !usedGenerations.has(gen) ? 1 : 0) +
        (cluster && !usedClusters.has(cluster) ? 1 : 0) +
        (gender && !usedGenders.has(gender) ? 1 : 0) +
        (state && !usedStates.has(state) ? 1 : 0) +
        (sclass && !usedClasses.has(sclass) ? 1 : 0);

      if (newDimensions >= 1) {
        usedIds.add(pid);
        usedRegions.add(region);
        usedGenerations.add(gen);
        usedClusters.add(cluster);
        usedGenders.add(gender);
        usedStates.add(state);
        usedClasses.add(sclass);

        const archetypeId = findBestArchetype(p);
        result.push(mapPersona(p, archetypeId, sentiment));
        selected++;
      }
    }

    // Second pass: fill remaining slots with any unused persona
    for (const p of shuffled) {
      if (selected >= count) break;
      const pid = p.id || p.name;
      if (usedIds.has(pid)) continue;

      usedIds.add(pid);
      const archetypeId = findBestArchetype(p);
      result.push(mapPersona(p, archetypeId, sentiment));
      selected++;
    }
  }

  selectDiverseFromPool(positivePool, posSlots, 'positive');
  selectDiverseFromPool(negativePool, negSlots, 'negative');
  selectDiverseFromPool(neutralPool, neuSlots, 'neutral');

  return shuffle(result);
}
