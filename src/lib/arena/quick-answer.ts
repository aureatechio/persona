/**
 * Quick Answer System
 *
 * For questions that map directly to yes/no columns in the persona data,
 * we can skip the full AI analysis and count directly from the data.
 * This gives instant results for 200+ binary columns.
 */

import type { Sentiment, RegionResult, GenerationResult } from './types';
import { computeAllSegments, type AllSegments } from './segments';
import { computeConviction } from './persona-sentiment';

function norm(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Yes/No column mappings ───────────────────────────────────────────────────

interface QuickMapping {
  keywords: string[];
  column: string;
  /** How to interpret "Sim" — does it mean the person agrees with the topic? */
  yesIsPositive: boolean;
  label: string;
}

const QUICK_MAPPINGS: QuickMapping[] = [
  // Temas polêmicos
  { keywords: ['aborto', 'abortar'], column: 'tema_aborto', yesIsPositive: true, label: 'Aborto' },
  { keywords: ['arma', 'desarm', 'porte de arma'], column: 'tema_armas', yesIsPositive: true, label: 'Armas' },
  { keywords: ['maconha', 'cannabis', 'legaliz'], column: 'tema_maconha', yesIsPositive: true, label: 'Maconha' },
  { keywords: ['privatiz', 'estatal'], column: 'tema_privatizacoes', yesIsPositive: true, label: 'Privatizacoes' },
  { keywords: ['cota racial', 'cotas', 'acao afirmativa'], column: 'tema_cotas_raciais', yesIsPositive: true, label: 'Cotas Raciais' },
  { keywords: ['casamento gay', 'casamento homoafetiv', 'uniao homoafetiv'], column: 'tema_casamento_gay', yesIsPositive: true, label: 'Casamento Gay' },

  // Questionnaire yes/no
  { keywords: ['pena de morte'], column: 'q_pena_morte', yesIsPositive: true, label: 'Pena de Morte' },
  { keywords: ['familia tradicional'], column: 'q_familia_tradicional', yesIsPositive: true, label: 'Familia Tradicional' },
  { keywords: ['racismo estrutural'], column: 'q_racismo_estrutural', yesIsPositive: true, label: 'Racismo Estrutural' },
  { keywords: ['meritocracia'], column: 'q_meritocracia', yesIsPositive: true, label: 'Meritocracia' },
  { keywords: ['religiao politica', 'estado laico'], column: 'q_religiao_politica', yesIsPositive: true, label: 'Religiao na Politica' },
  { keywords: ['impeachment'], column: 'q_impeachment_lula', yesIsPositive: true, label: 'Impeachment' },
  { keywords: ['intervencao militar'], column: 'q_intervencao_militar', yesIsPositive: true, label: 'Intervencao Militar' },
  { keywords: ['democracia'], column: 'q_democracia_importante', yesIsPositive: true, label: 'Democracia' },
  { keywords: ['feminism'], column: 'q_feminismo_bom', yesIsPositive: true, label: 'Feminismo' },
  { keywords: ['mudanca climatica', 'aquecimento global'], column: 'q_mudanca_climatica_real', yesIsPositive: true, label: 'Mudanca Climatica' },
  { keywords: ['sus', 'saude publica'], column: 'q_sus_funciona', yesIsPositive: true, label: 'SUS' },
  { keywords: ['vacina'], column: 'q_vacinas_confiar', yesIsPositive: true, label: 'Vacinas' },
  { keywords: ['terra plana'], column: 'q_terra_plana', yesIsPositive: true, label: 'Terra Plana' },
  { keywords: ['genero biologic', 'transgenero'], column: 'q_genero_biologico', yesIsPositive: true, label: 'Genero Biologico' },
  { keywords: ['linguagem neutra'], column: 'q_linguagem_neutra', yesIsPositive: true, label: 'Linguagem Neutra' },
  { keywords: ['homeschooling', 'educacao domiciliar'], column: 'q_homeschooling', yesIsPositive: true, label: 'Homeschooling' },
  { keywords: ['voto obrigatorio'], column: 'q_voto_obrigatorio', yesIsPositive: true, label: 'Voto Obrigatorio' },
  { keywords: ['drogas', 'descriminaliz'], column: 'q_drogas_descriminalizar', yesIsPositive: true, label: 'Descriminalizacao' },
  { keywords: ['maioridade penal'], column: 'q_maioridade_penal_16', yesIsPositive: true, label: 'Maioridade Penal 16' },
  { keywords: ['prostituicao'], column: 'q_prostituicao_legalizar', yesIsPositive: true, label: 'Prostituicao' },
  { keywords: ['adocao homoafetiv', 'adocao gay'], column: 'q_adocao_homoafetiva', yesIsPositive: true, label: 'Adocao Homoafetiva' },
  { keywords: ['direitos lgbt'], column: 'q_direitos_lgbt', yesIsPositive: true, label: 'Direitos LGBT' },
  { keywords: ['bolsa familia', 'beneficio social'], column: 'q_bolsa_familia_bom', yesIsPositive: true, label: 'Bolsa Familia' },
  { keywords: ['amazonia', 'preservar amazonia'], column: 'q_amazonia_preservar', yesIsPositive: true, label: 'Preservar Amazonia' },
  { keywords: ['energia renovavel'], column: 'q_energia_renovavel', yesIsPositive: true, label: 'Energia Renovavel' },

  // Tabu Implicito (yes/no)
  { keywords: ['sonegar', 'sonegacao'], column: 'q_ti_sonegaria_imposto', yesIsPositive: false, label: 'Sonegacao' },
  { keywords: ['propina', 'suborno'], column: 'q_ti_aceitaria_propina', yesIsPositive: false, label: 'Propina' },
  { keywords: ['comprar voto', 'vender voto'], column: 'q_ti_venderia_voto', yesIsPositive: false, label: 'Vender Voto' },
  { keywords: ['bater filho', 'palmada'], column: 'q_ti_bater_filho_normal', yesIsPositive: false, label: 'Bater em Filho' },
  { keywords: ['linchamento', 'justica propria'], column: 'q_ti_linchamento_apoiaria', yesIsPositive: false, label: 'Linchamento' },
  { keywords: ['tortura', 'torturar preso'], column: 'q_ti_tortura_preso_ok', yesIsPositive: false, label: 'Tortura' },
  { keywords: ['trabalho infantil'], column: 'q_ti_trabalho_infantil_ok', yesIsPositive: false, label: 'Trabalho Infantil' },
  { keywords: ['jeitinho', 'furar fila'], column: 'q_ti_jeitinho_furar_fila', yesIsPositive: false, label: 'Jeitinho' },
  { keywords: ['nepotismo'], column: 'q_ti_nepotismo_concurso', yesIsPositive: false, label: 'Nepotismo' },
  { keywords: ['produto roubado', 'receptacao'], column: 'q_ti_compraria_produto_roubado', yesIsPositive: false, label: 'Produto Roubado' },

  // Vivências (yes/no - these are factual, "sim" means experienced it)
  { keywords: ['abuso sexual', 'pedofilia'], column: 'q_vi_abuso_sexual_infancia', yesIsPositive: true, label: 'Abuso Sexual na Infancia' },
  { keywords: ['fome', 'passar fome'], column: 'q_vi_passou_fome', yesIsPositive: true, label: 'Passou Fome' },
  { keywords: ['assaltado', 'assalto'], column: 'q_vi_ja_foi_assaltado', yesIsPositive: true, label: 'Ja foi Assaltado' },
  { keywords: ['depressao', 'ansiedade', 'saude mental'], column: 'q_vi_depressao_ansiedade', yesIsPositive: true, label: 'Depressao/Ansiedade' },
  { keywords: ['suicidio', 'suicida'], column: 'q_vi_pensou_suicidio', yesIsPositive: true, label: 'Pensou em Suicidio' },
  { keywords: ['violencia domestica'], column: 'q_vi_sofreu_violencia_domestica', yesIsPositive: true, label: 'Violencia Domestica' },
  { keywords: ['sofreu racismo'], column: 'q_vi_sofreu_racismo', yesIsPositive: true, label: 'Sofreu Racismo' },
  { keywords: ['sofreu assedio'], column: 'q_vi_sofreu_assedio_sexual', yesIsPositive: true, label: 'Sofreu Assedio' },
  { keywords: ['enchente', 'desastre natural'], column: 'q_vi_enchente_desastre', yesIsPositive: true, label: 'Enchente/Desastre' },
  { keywords: ['dependencia quimica', 'vicio', 'alcoolismo'], column: 'q_vi_dependencia', yesIsPositive: true, label: 'Dependencia Quimica' },
];

// ── Detection ────────────────────────────────────────────────────────────────

export interface QuickAnswerMatch {
  column: string;
  label: string;
  yesIsPositive: boolean;
}

/**
 * Checks if a question maps directly to a yes/no column.
 * Returns the mapping if found, null otherwise.
 */
export function detectQuickAnswer(question: string): QuickAnswerMatch | null {
  const n = norm(question);

  for (const mapping of QUICK_MAPPINGS) {
    if (mapping.keywords.some(kw => n.includes(norm(kw)))) {
      return {
        column: mapping.column,
        label: mapping.label,
        yesIsPositive: mapping.yesIsPositive,
      };
    }
  }

  return null;
}

// ── Counting ─────────────────────────────────────────────────────────────────

function isYes(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value >= 7;
  const v = norm(String(value));
  return v === 'sim' || v === 'yes' || v.includes('a favor') || v.includes('concordo')
    || v.includes('apoio') || v.includes('aprova') || v.includes('bom') || v.includes('otimo');
}

function isNo(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value <= 4;
  const v = norm(String(value));
  return v === 'nao' || v === 'no' || v.includes('contra') || v.includes('discordo')
    || v.includes('desaprova') || v.includes('ruim') || v.includes('pessim');
}

export interface QuickAnswerResult {
  column: string;
  label: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  /** Breakdown by gender */
  genderGroups: { label: string; count: number; positive: number; negative: number; neutral: number }[];
  /** Breakdown by region */
  regionGroups: RegionResult[];
  /** Breakdown by generation */
  generationGroups: GenerationResult[];
  /** Full demographic segments */
  segments: AllSegments;
  processingTimeMs: number;
}

/** Classify a single persona for a quick answer match.
 *  When `question` is provided, uses conviction scoring to generate
 *  realistic neutrals (~5-15%) based on persona profile analysis. */
export function classifyQuickPersona(
  p: Record<string, any>,
  match: QuickAnswerMatch,
  question?: string,
): Sentiment {
  const raw = p[match.column];

  // If data is missing, always neutral
  if (!isYes(raw) && !isNo(raw)) return 'neutral';

  // Data says yes or no — but is this persona actually convicted?
  // Moderate/center personas may be neutral even with a recorded yes/no
  if (question) {
    const normQ = norm(question);
    const conviction = computeConviction(p, normQ);
    const neutralChance = 0.18 * (1 - conviction);
    if (neutralChance > 0 && Math.random() < neutralChance) {
      return 'neutral';
    }
  }

  if (isYes(raw)) return match.yesIsPositive ? 'positive' : 'negative';
  return match.yesIsPositive ? 'negative' : 'positive';
}

/**
 * Counts yes/no directly from persona data for a matched column.
 * Returns instant results with demographic breakdowns.
 */
export function runQuickAnswer(
  match: QuickAnswerMatch,
  personas: Record<string, any>[],
  question?: string,
): QuickAnswerResult {
  const start = performance.now();

  let positive = 0;
  let negative = 0;
  let neutral = 0;

  const genderMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const regionMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const genMap = new Map<string, { count: number; positive: number; negative: number; neutral: number; totalAge: number }>();

  for (const p of personas) {
    const sentiment = classifyQuickPersona(p, match, question);

    if (sentiment === 'positive') positive++;
    else if (sentiment === 'negative') negative++;
    else neutral++;

    // Gender
    const gender = p.gender_identity || p.gender || 'Outros';
    if (!genderMap.has(gender)) genderMap.set(gender, { count: 0, positive: 0, negative: 0, neutral: 0 });
    const g = genderMap.get(gender)!;
    g.count++;
    g[sentiment]++;

    // Region
    const region = p.region_br || 'Outros';
    if (!regionMap.has(region)) regionMap.set(region, { count: 0, positive: 0, negative: 0, neutral: 0 });
    const r = regionMap.get(region)!;
    r.count++;
    r[sentiment]++;

    // Generation
    const gen = p.generation || 'Outros';
    if (!genMap.has(gen)) genMap.set(gen, { count: 0, positive: 0, negative: 0, neutral: 0, totalAge: 0 });
    const gn = genMap.get(gen)!;
    gn.count++;
    gn[sentiment]++;
    gn.totalAge += (p.age || 30);
  }

  // Compute full demographic segments using the same sentiment logic
  const segments = computeAllSegments(personas, (p) => classifyQuickPersona(p, match, question));

  return {
    column: match.column,
    label: match.label,
    total: personas.length,
    positive,
    negative,
    neutral,
    genderGroups: Array.from(genderMap.entries()).map(([label, d]) => ({ label, ...d })),
    regionGroups: Array.from(regionMap.entries()).map(([region, d]) => ({ region, ...d })),
    generationGroups: Array.from(genMap.entries()).map(([generation, d]) => ({
      generation,
      count: d.count,
      positive: d.positive,
      negative: d.negative,
      neutral: d.neutral,
      avgAge: d.count > 0 ? Math.round(d.totalAge / d.count) : 30,
    })),
    segments,
    processingTimeMs: performance.now() - start,
  };
}
