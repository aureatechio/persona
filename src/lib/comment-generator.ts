/**
 * Comment Generator Engine
 * ========================
 * Transforma templates + dados de persona em comentários autênticos
 * que replicam a linguagem real das redes sociais brasileiras.
 *
 * Pipeline:
 *   1. selectTemplate     — escolhe template por archetype/sentiment/topic/intensity
 *   2. fillSlots          — injeta expressões regionais nos slots
 *   3. applyAbbreviations — aplica abreviações de internet (geração)
 *   4. applySpellingErrors — introduz erros ortográficos (educação)
 *   5. applyCapsPattern   — aplica padrão de maiúsculas (geração)
 *   6. addLaughter        — adiciona risada (kkkk, rsrs)
 *   7. addEmojis          — adiciona emojis por sentimento/geração
 *   8. addPunctuation     — ajusta pontuação excessiva
 */

import {
  getStateProfile,
  INTERNET_BR,
  EDUCATION_MODIFIERS,
  GENERATION_MODIFIERS,
  SENTIMENT_EMOJIS,
  type StateProfile,
} from './brazilian-linguistics';

import {
  COMMENT_TEMPLATES,
  INTENSITY_WEIGHTS,
  TOPIC_KEYS,
  type CommentTemplate,
  type Intensity,
  type Sentiment,
} from './comment-templates';

import {
  computeWritingStyle,
  type PersonaContext,
  type WritingStyle,
} from './persona-writing-style';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybe(probability: number): boolean {
  return Math.random() < probability;
}

function pickWeightedIntensity(): Intensity {
  const rand = Math.random();
  let cumulative = 0;
  for (const [intensity, weight] of Object.entries(INTENSITY_WEIGHTS)) {
    cumulative += weight;
    if (rand <= cumulative) return intensity as Intensity;
  }
  return 'mild';
}

// ── Archetype ID Mapping ────────────────────────────────────────────────────
// Maps archetype IDs from ARCHETYPE_SCORERS (persona-sentiment system)
// to template keys in COMMENT_TEMPLATES

const ARCHETYPE_TO_TEMPLATE: Record<string, string> = {
  patriota_radical: 'traditionalist',
  pastor_evangelico: 'traditionalist',
  policial_militar: 'traditionalist',
  tiozao_zap: 'traditionalist',
  militante_esquerda: 'activist',
  jovem_periferia: 'activist',
  progressista_base: 'activist',
  intelectual: 'analyst',
  mae_familia: 'moderate',
  trabalhador: 'moderate',
  elite_indignada: 'entrepreneur',
};

// ── Sentiment-Specific Fallback Templates ──────────────────────────────────
// When no archetype/topic template matches, use sentiment-appropriate fallbacks

const POSITIVE_FALLBACKS: CommentTemplate[] = [
  { base: 'concordo sim, acho que faz sentido isso', intensity: 'mild' },
  { base: 'apoio total, tá na hora disso acontecer', intensity: 'moderate' },
  { base: 'finalmente alguém falando o que eu penso', intensity: 'moderate' },
  { base: 'isso aí, apoio demais essa ideia', intensity: 'mild' },
  { base: '{opener} é isso mesmo!! tá certíssimo', intensity: 'moderate' },
  { base: 'penso igual, o povo precisa entender que isso é necessário', intensity: 'mild' },
  { base: 'até que enfim uma coisa que faz sentido nesse país', intensity: 'moderate' },
  { base: 'concordo e quem discorda não vive a realidade', intensity: 'strong' },
  { base: 'quem é contra não entende como funciona de verdade', intensity: 'strong' },
  { base: '{opener} pode me chamar de louco mas eu concordo com isso sim', intensity: 'mild' },
  { base: 'na minha vivência isso é a mais pura verdade', intensity: 'mild' },
  { base: 'o povo tem que apoiar isso sim, chega de ficar em cima do muro', intensity: 'moderate' },
];

const NEGATIVE_FALLBACKS: CommentTemplate[] = [
  { base: 'discordo completamente, isso não faz nenhum sentido', intensity: 'mild' },
  { base: 'quem defende isso não tá vivendo na realidade', intensity: 'moderate' },
  { base: 'que absurdo, como alguém pode apoiar isso', intensity: 'strong' },
  { base: '{opener} isso tá errado demais, pelo amor', intensity: 'moderate' },
  { base: 'não concordo de jeito nenhum, isso vai dar problema', intensity: 'mild' },
  { base: 'ridículo isso, não tem cabimento', intensity: 'moderate' },
  { base: 'cada dia uma loucura nova nesse país', intensity: 'mild' },
  { base: 'sou totalmente contra, isso é um retrocesso', intensity: 'moderate' },
  { base: '{opener} na boa isso é uma palhaçada, desculpa quem pensa diferente', intensity: 'strong' },
  { base: 'isso é inaceitável, ponto final', intensity: 'strong' },
  { base: 'não dá pra concordar com isso nem a pau', intensity: 'moderate' },
  { base: 'isso vai prejudicar muita gente e ninguém tá vendo', intensity: 'mild' },
];

const NEUTRAL_FALLBACKS: CommentTemplate[] = [
  { base: 'acho que tem argumentos dos dois lados que fazem sentido', intensity: 'mild' },
  { base: 'é uma questão complexa, não dá pra simplificar assim', intensity: 'mild' },
  { base: 'sinceramente tô dividido nessa, depende de como for feito', intensity: 'mild' },
  { base: 'tem prós e contras, não é tão simples quanto parece', intensity: 'mild' },
  { base: 'olha, depende muito do contexto, não dá pra generalizar', intensity: 'mild' },
  { base: 'entendo quem é contra e quem é a favor, é complicado', intensity: 'mild' },
  { base: 'pra mim falta informação pra tomar uma posição firme sobre isso', intensity: 'mild' },
  { base: 'em tese concordo mas na prática complica bastante', intensity: 'mild' },
  { base: 'vejo pontos válidos mas também vejo riscos sérios nisso', intensity: 'mild' },
  { base: 'essa discussão é mais complexa do que parece na superfície', intensity: 'mild' },
  { base: 'confesso que é um tema que me divide bastante', intensity: 'mild' },
  { base: 'depende muito, tem nuances que ninguém tá considerando', intensity: 'mild' },
];

function getSentimentFallbacks(sentiment: Sentiment): CommentTemplate[] {
  if (sentiment === 'positive') return POSITIVE_FALLBACKS;
  if (sentiment === 'negative') return NEGATIVE_FALLBACKS;
  return NEUTRAL_FALLBACKS;
}

// ── Step 1: Select Template ────────────────────────────────────────────────────

function selectTemplate(
  archetypeId: string,
  sentiment: Sentiment,
  topic: string,
): CommentTemplate {
  // Map scorer archetype IDs to template keys
  const templateKey = ARCHETYPE_TO_TEMPLATE[archetypeId] || archetypeId;

  const archetype = COMMENT_TEMPLATES[templateKey];
  if (!archetype) {
    return pickRandom(getSentimentFallbacks(sentiment));
  }

  const sentimentTemplates = archetype[sentiment];
  if (!sentimentTemplates) {
    return pickRandom(getSentimentFallbacks(sentiment));
  }

  // Try specific topic first, fallback to 'general'
  let pool = sentimentTemplates[topic];
  if (!pool || pool.length === 0) {
    pool = sentimentTemplates['general'];
  }
  if (!pool || pool.length === 0) {
    return pickRandom(getSentimentFallbacks(sentiment));
  }

  // Pick by weighted intensity
  const targetIntensity = pickWeightedIntensity();

  // Try to find a template matching the target intensity
  const matching = pool.filter(t => t.intensity === targetIntensity);
  if (matching.length > 0) {
    return pickRandom(matching);
  }

  // Fallback: find closest intensity (prefer milder)
  const intensityOrder: Intensity[] = ['mild', 'moderate', 'strong', 'extreme'];
  const targetIdx = intensityOrder.indexOf(targetIntensity);

  for (let delta = 1; delta < intensityOrder.length; delta++) {
    // Check lower intensity first
    if (targetIdx - delta >= 0) {
      const lower = pool.filter(t => t.intensity === intensityOrder[targetIdx - delta]);
      if (lower.length > 0) return pickRandom(lower);
    }
    // Then check higher
    if (targetIdx + delta < intensityOrder.length) {
      const higher = pool.filter(t => t.intensity === intensityOrder[targetIdx + delta]);
      if (higher.length > 0) return pickRandom(higher);
    }
  }

  return pickRandom(pool);
}

// ── Step 2: Fill Regional Slots ────────────────────────────────────────────────

function fillSlots(text: string, profile: StateProfile, style: WritingStyle): string {
  let result = text;

  if (result.includes('{opener}')) {
    if (maybe(style.regionalRate)) {
      result = result.replace('{opener}', pickRandom(profile.exclamations).toLowerCase());
    } else {
      result = result.replace('{opener}', '');
    }
  }

  if (result.includes('{filler}')) {
    if (maybe(style.regionalRate)) {
      result = result.replace('{filler}', pickRandom(profile.fillers));
    } else {
      result = result.replace('{filler}', '');
    }
  }

  if (result.includes('{closer}')) {
    if (maybe(style.regionalRate)) {
      result = result.replace('{closer}', pickRandom(profile.closers));
    } else {
      result = result.replace('{closer}', '');
    }
  }

  if (result.includes('{intensifier}')) {
    if (maybe(style.regionalRate)) {
      result = result.replace('{intensifier}', pickRandom(profile.intensifiers));
    } else {
      result = result.replace('{intensifier}', 'demais');
    }
  }

  // Clean up double spaces from empty slot fills
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

// ── Step 3: Apply Abbreviations ────────────────────────────────────────────────

function applyAbbreviations(text: string, style: WritingStyle, generation: string): string {
  if (style.abbreviationRate <= 0.05) return text;

  const abbreviations = INTERNET_BR.abbreviations;
  let result = text;

  // Sort by length descending to avoid partial replacements
  const sortedKeys = Object.keys(abbreviations).sort((a, b) => b.length - a.length);

  for (const fullWord of sortedKeys) {
    if (!maybe(style.abbreviationRate)) continue;

    const abbrev = abbreviations[fullWord];
    // Word boundary-aware replacement (case-insensitive)
    const regex = new RegExp(`\\b${escapeRegex(fullWord)}\\b`, 'gi');
    result = result.replace(regex, abbrev);
  }

  // Add generation-specific extra abbreviations into the text occasionally
  const genMod = GENERATION_MODIFIERS[generation];
  if (genMod && genMod.memeExpressions.length > 0 && maybe(0.15)) {
    // Occasionally prepend a meme expression
    result = pickRandom(genMod.memeExpressions) + ' ' + result;
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Step 4: Apply Spelling Errors ──────────────────────────────────────────────

function applySpellingErrors(text: string, style: WritingStyle, educationLevel: string): string {
  const edu = EDUCATION_MODIFIERS[educationLevel];
  if (!edu || edu.commonErrors.length === 0) return text;

  const errorRate = style.spellingErrorRate;
  if (errorRate <= 0.05) return text;

  let result = text;

  // Apply common errors (we intentionally introduce the "wrong" version)
  // The commonErrors are stored as [wrong, correct], so we replace correct → wrong
  for (const [wrong, correct] of edu.commonErrors) {
    if (!maybe(errorRate)) continue;

    const regex = new RegExp(`\\b${escapeRegex(correct)}\\b`, 'gi');
    result = result.replace(regex, wrong);
  }

  // Remove accents probabilistically for low-education
  if (errorRate > 0.3 && maybe(errorRate * 0.5)) {
    result = removeRandomAccents(result, errorRate * 0.4);
  }

  // Remove punctuation for very low education
  if (edu.punctuationUsage === 'none' && maybe(0.6)) {
    result = result.replace(/[.,;:]/g, '');
  }

  return result;
}

function removeRandomAccents(text: string, rate: number): string {
  const accentMap: Record<string, string> = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
    'é': 'e', 'ê': 'e',
    'í': 'i',
    'ó': 'o', 'ô': 'o', 'õ': 'o',
    'ú': 'u', 'ü': 'u',
    'ç': 'c',
  };

  return text.split('').map(char => {
    const lower = char.toLowerCase();
    if (accentMap[lower] && maybe(rate)) {
      return char === lower ? accentMap[lower] : accentMap[lower].toUpperCase();
    }
    return char;
  }).join('');
}

// ── Step 5: Apply Caps Pattern ─────────────────────────────────────────────────

function applyCapsPattern(text: string, style: WritingStyle, generation: string): string {
  // Boomer ALL CAPS
  if (generation === 'Boomer' && maybe(style.capsRate)) {
    return text.toUpperCase();
  }

  // Gen Z: CAPS on emphasis words
  if (generation === 'Gen Z' && maybe(style.capsRate)) {
    const emphasisWords = ['nunca', 'sempre', 'todo', 'ninguém', 'nada', 'tudo', 'muito', 'demais', 'absurdo', 'ridículo', 'inacreditável', 'óbvio', 'claro', 'sim', 'não'];
    let result = text;
    for (const word of emphasisWords) {
      if (maybe(0.4)) {
        const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
        result = result.replace(regex, word.toUpperCase());
      }
    }
    return result;
  }

  // Others: occasional caps on strong words
  if (maybe(style.capsRate * 0.3)) {
    const words = text.split(' ');
    const idx = Math.floor(Math.random() * words.length);
    if (words[idx] && words[idx].length > 3) {
      words[idx] = words[idx].toUpperCase();
    }
    return words.join(' ');
  }

  return text;
}

// ── Step 6: Add Laughter ───────────────────────────────────────────────────────

function addLaughter(text: string, style: WritingStyle, sentiment: Sentiment): string {
  // More likely on negative (sarcastic) or positive (enthusiastic) sentiments
  const boost = sentiment === 'neutral' ? -0.2 : 0.1;

  if (!maybe(style.laughterRate + boost)) return text;

  const laugh = pickRandom(INTERNET_BR.laughter);

  // Sometimes at start, sometimes at end
  if (maybe(0.3)) {
    return laugh + ' ' + text;
  }
  return text + ' ' + laugh;
}

// ── Step 7: Add Emojis ─────────────────────────────────────────────────────────

function addEmojis(
  text: string,
  style: WritingStyle,
  sentiment: Sentiment,
  stateProfile: StateProfile,
  religion: string,
): string {
  if (style.emojiRate <= 0.05) return text;

  const emojis: string[] = [];

  // Add sentiment-based emoji
  if (maybe(style.emojiRate)) {
    const pool = SENTIMENT_EMOJIS[sentiment] || SENTIMENT_EMOJIS['neutral'];
    emojis.push(pickRandom(pool));
  }

  // Add state-specific emoji occasionally
  if (maybe(style.emojiRate * 0.4) && stateProfile.typicalEmojis.length > 0) {
    emojis.push(pickRandom(stateProfile.typicalEmojis));
  }

  // Add religious emoji for religious personas
  if (maybe(style.religiousRate * 0.5)) {
    emojis.push(pickRandom(SENTIMENT_EMOJIS['religious']));
  }

  // High emoji density: add more
  if (style.emojiRate > 0.5 && maybe(0.5)) {
    const pool = SENTIMENT_EMOJIS[sentiment] || SENTIMENT_EMOJIS['neutral'];
    emojis.push(pickRandom(pool));
  }

  if (emojis.length === 0) return text;

  return text + ' ' + emojis.join('');
}

// ── Step 8: Add Punctuation ────────────────────────────────────────────────────

function addPunctuation(text: string, style: WritingStyle, intensity: Intensity): string {
  // Strong/extreme intensity → more punctuation
  const boost = intensity === 'extreme' ? 0.4 : intensity === 'strong' ? 0.2 : 0;

  if (maybe(0.3 + boost + (1 - style.formalityLevel) * 0.2)) {
    // Replace trailing punctuation with exaggerated version
    const pattern = pickRandom(INTERNET_BR.punctuationPatterns);
    const trimmed = text.replace(/[.!?]+$/, '');
    return trimmed + pattern;
  }

  // Low formality: remove periods (people don't use them on social media)
  if (style.formalityLevel < 0.4 && maybe(0.5)) {
    return text.replace(/\.$/g, '');
  }

  return text;
}

// ── Step 9: Add Religious Expressions ──────────────────────────────────────────

function addReligiousExpressions(text: string, style: WritingStyle, religion: string): string {
  if (!maybe(style.religiousRate * 0.4)) return text;

  const expressions: Record<string, string[]> = {
    'Evangélico': ['Deus abençoe', 'em nome de Jesus', 'a Bíblia diz', 'Deus é fiel', 'glória a Deus', 'na fé'],
    'Católico': ['Deus queira', 'Nossa Senhora', 'se Deus quiser', 'Deus tenha misericórdia'],
    'Espírita': ['a espiritualidade nos guia', 'as boas energias'],
    'Matriz Africana': ['axé', 'com fé nos orixás'],
  };

  const pool = expressions[religion];
  if (!pool || pool.length === 0) return text;

  const expr = pickRandom(pool);

  // Add at end
  if (maybe(0.6)) {
    return text + '. ' + expr;
  }
  // Add at start
  return expr + '!! ' + text;
}

// ── Step 10: Add Reaction Words ────────────────────────────────────────────────

function addReaction(text: string, style: WritingStyle, intensity: Intensity): string {
  // Only for informal comments with some intensity
  if (style.formalityLevel > 0.6) return text;
  if (intensity === 'mild' && !maybe(0.15)) return text;
  if (!maybe(0.25)) return text;

  const reaction = pickRandom(INTERNET_BR.reactions);
  return reaction + ' ' + text;
}

// ── Main Generate Function ─────────────────────────────────────────────────────

export function generateComment(
  persona: PersonaContext,
  topic: string,
  sentiment: Sentiment,
): string {
  // Validate topic
  const validTopic = (TOPIC_KEYS as readonly string[]).includes(topic) ? topic : 'general';

  // Get persona's state profile and writing style
  const stateProfile = getStateProfile(persona.state);
  const style = computeWritingStyle(persona);

  // 1. Select template
  const template = selectTemplate(persona.archetypeId, sentiment, validTopic);

  // 2. Fill regional slots
  let comment = fillSlots(template.base, stateProfile, style);

  // 3. Add reaction words
  comment = addReaction(comment, style, template.intensity);

  // 4. Add religious expressions
  comment = addReligiousExpressions(comment, style, persona.religion);

  // 5. Apply spelling errors (before abbreviations, so errors apply to full words)
  comment = applySpellingErrors(comment, style, persona.educationLevel);

  // 6. Apply abbreviations
  comment = applyAbbreviations(comment, style, persona.generation);

  // 7. Apply caps pattern
  comment = applyCapsPattern(comment, style, persona.generation);

  // 8. Add laughter
  comment = addLaughter(comment, style, sentiment);

  // 9. Add emojis
  comment = addEmojis(comment, style, sentiment, stateProfile, persona.religion);

  // 10. Adjust punctuation
  comment = addPunctuation(comment, style, template.intensity);

  // Final cleanup
  comment = comment.replace(/\s{2,}/g, ' ').trim();

  // Ensure it doesn't start with a space or lowercase issue after cleanup
  if (comment.length === 0) {
    comment = 'é uma questão complexa, entendo os dois lados';
  }

  return comment;
}

// ── Batch Generate (for Pulse Arena) ────────────────────────────────────────

export interface GeneratedComment {
  archetype: string;
  sentiment: Sentiment;
  comment: string;
  personaName: string;
  age: number;
  location: string;
  state: string;
  region: string;
  generation: string;
}

/**
 * Generate multiple comments from a pool of personas.
 * Used by Pulse Arena to generate representative sample comments.
 */
export function generateBatchComments(
  personas: PersonaContext[],
  topic: string,
  sentimentDistribution: Record<string, { positive: number; negative: number; neutral: number }>,
  commentsPerArchetype: number,
): GeneratedComment[] {
  const comments: GeneratedComment[] = [];

  // Group personas by archetype
  const byArchetype: Record<string, PersonaContext[]> = {};
  for (const p of personas) {
    if (!byArchetype[p.archetypeId]) byArchetype[p.archetypeId] = [];
    byArchetype[p.archetypeId].push(p);
  }

  const sentiments: Sentiment[] = ['positive', 'negative', 'neutral'];

  for (const [archetypeId, pool] of Object.entries(byArchetype)) {
    if (pool.length === 0) continue;

    const dist = sentimentDistribution[archetypeId];
    if (!dist) continue;

    for (const sentiment of sentiments) {
      const count = sentiment === 'neutral'
        ? Math.max(1, Math.round(commentsPerArchetype * 0.2))
        : Math.max(1, Math.round(commentsPerArchetype * 0.4));

      for (let i = 0; i < count; i++) {
        const persona = pickRandom(pool);
        const comment = generateComment(persona, topic, sentiment);

        comments.push({
          archetype: archetypeId,
          sentiment,
          comment,
          personaName: persona.name,
          age: persona.age,
          location: `${persona.state}`,
          state: persona.state,
          region: persona.region,
          generation: persona.generation,
        });
      }
    }
  }

  // Shuffle
  for (let i = comments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [comments[i], comments[j]] = [comments[j], comments[i]];
  }

  return comments;
}
