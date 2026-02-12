/**
 * Persona Writing Style Calculator
 * =================================
 * Mapeia atributos demográficos de uma persona para parâmetros
 * concretos de estilo de escrita usados pelo comment-generator.
 */

import {
  EDUCATION_MODIFIERS,
  GENERATION_MODIFIERS,
  CLASS_MODIFIERS,
  AREA_MODIFIERS,
  type EducationModifier,
  type GenerationModifier,
} from './brazilian-linguistics';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PersonaContext {
  region: string;
  state: string;
  generation: string;
  educationLevel: string;
  socialClass: string;
  politicalLeaning: string;
  religion: string;
  age: number;
  gender: string;
  areaType: string;
  archetypeId: string;
  name: string;
}

export interface WritingStyle {
  abbreviationRate: number;
  spellingErrorRate: number;
  regionalRate: number;
  emojiRate: number;
  capsRate: number;
  aggressivenessRate: number;
  laughterRate: number;
  sentenceCount: 1 | 2 | 3;
  vocabularyTier: 1 | 2 | 3;
  formalityLevel: number;
  religiousRate: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function vocabToNumber(tier: 'basic' | 'intermediate' | 'advanced'): 1 | 2 | 3 {
  if (tier === 'basic') return 1;
  if (tier === 'intermediate') return 2;
  return 3;
}

function sentenceLengthToCount(len: 'very_short' | 'short' | 'medium' | 'long'): 1 | 2 | 3 {
  if (len === 'very_short' || len === 'short') return 1;
  if (len === 'medium') return 2;
  return 3;
}

// ── Political leaning → aggressiveness mapping ──────────────────────────────

const POLITICAL_AGGRESSIVENESS: Record<string, number> = {
  'Extrema Esquerda': 0.6,
  'Esquerda': 0.35,
  'Centro-Esquerda': 0.2,
  'Centro': 0.1,
  'Centro-Liberal': 0.15,
  'Centro-Direita': 0.25,
  'Direita': 0.4,
  'Extrema Direita': 0.7,
  'Libertário': 0.3,
  'Apolítico': 0.1,
};

// ── Religion → religious expression rate ────────────────────────────────────

const RELIGION_EXPRESSION_RATE: Record<string, number> = {
  'Católico': 0.25,
  'Evangélico': 0.6,
  'Espírita': 0.15,
  'Matriz Africana': 0.2,
  'Judaísmo': 0.1,
  'Islamismo': 0.15,
  'Ateu': 0.0,
  'Espiritualidade Eclética': 0.1,
  'Outros': 0.05,
};

// ── Main Function ──────────────────────────────────────────────────────────────

export function computeWritingStyle(persona: PersonaContext): WritingStyle {
  const edu: EducationModifier = EDUCATION_MODIFIERS[persona.educationLevel] || EDUCATION_MODIFIERS['Médio'];
  const gen: GenerationModifier = GENERATION_MODIFIERS[persona.generation] || GENERATION_MODIFIERS['Millennial'];
  const cls = CLASS_MODIFIERS[persona.socialClass] || CLASS_MODIFIERS['C1'];
  const area = AREA_MODIFIERS[persona.areaType] || AREA_MODIFIERS['Urbana/Interior'];

  // Abbreviation rate: driven by generation, slightly reduced by high education
  const abbreviationRate = clamp(
    gen.abbreviationRate - (edu.spellingAccuracy > 0.9 ? 0.15 : 0) + (cls.formalityLevel < 0.3 ? 0.1 : 0),
    0, 1
  );

  // Spelling error rate: inverse of accuracy, boosted for low-education rural
  const spellingErrorRate = clamp(
    (1 - edu.spellingAccuracy) + (area.formalityShift < 0 ? 0.05 : 0),
    0, 1
  );

  // Regional expression rate: base from area, higher in interior/rural
  const regionalRate = clamp(
    0.4 + area.regionalBoost + (cls.formalityLevel < 0.4 ? 0.1 : -0.05),
    0.1, 0.9
  );

  // Emoji rate: driven by generation
  const emojiRate = clamp(
    gen.emojiDensity + (persona.age < 25 ? 0.1 : persona.age > 50 ? -0.1 : 0),
    0, 1
  );

  // Caps rate: Boomers and extreme political leanings use more caps
  const capsRate = clamp(
    gen.capsRate + (POLITICAL_AGGRESSIVENESS[persona.politicalLeaning] || 0) * 0.15,
    0, 1
  );

  // Aggressiveness: political extremism + low education + low class correlate
  const aggressivenessRate = clamp(
    (POLITICAL_AGGRESSIVENESS[persona.politicalLeaning] || 0.15) +
    (1 - edu.spellingAccuracy) * 0.15 +
    (1 - cls.formalityLevel) * 0.1,
    0, 1
  );

  // Laughter rate: generation-driven
  const laughterRate = gen.laughterRate;

  // Sentence count: generation-driven
  const sentenceCount = sentenceLengthToCount(gen.sentenceLength);

  // Vocabulary tier: education-driven
  const vocabularyTier = vocabToNumber(edu.vocabularyTier);

  // Formality: class + area + education
  const formalityLevel = clamp(
    cls.formalityLevel + area.formalityShift + (edu.spellingAccuracy > 0.9 ? 0.1 : -0.05),
    0, 1
  );

  // Religious expression rate
  const religiousRate = clamp(
    (RELIGION_EXPRESSION_RATE[persona.religion] || 0.1) + area.religiousRate * 0.3,
    0, 1
  );

  return {
    abbreviationRate,
    spellingErrorRate,
    regionalRate,
    emojiRate,
    capsRate,
    aggressivenessRate,
    laughterRate,
    sentenceCount,
    vocabularyTier,
    formalityLevel,
    religiousRate,
  };
}
