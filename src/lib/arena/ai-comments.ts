import type { CommentResult, Sentiment } from './types';
import type { PersonaForAI } from '@/lib/simulation-prompt';
import type { PersonaContext } from '@/lib/persona-writing-style';
import { generateComment } from '@/lib/comment-generator';
import { detectTopics } from './engine';
import { ARCHETYPE_SCORERS } from './constants';

/** Generate AI-powered comments via Claude API route, with template fallback */
export async function generateAIComments(
  question: string,
  personasForAI: PersonaForAI[],
): Promise<CommentResult[]> {
  console.log(`[AI] Enviando ${personasForAI.length} personas para /api/generate-comments...`);
  try {
    const resp = await fetch('/api/generate-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, personas: personasForAI }),
    });

    console.log(`[AI] Response status: ${resp.status}`);

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data.fallback) {
        console.warn('[AI] API indisponível, usando FALLBACK de templates. Motivo:', data.error);
        return generateFallbackComments(personasForAI, question);
      }
      throw new Error(data.error || 'API error');
    }

    const data = await resp.json();
    console.log(`[AI] ${data.comments?.length || 0} comentários gerados por IA Claude`);
    return data.comments || [];
  } catch (err) {
    console.error('[AI] Falha total, usando FALLBACK de templates:', err);
    return generateFallbackComments(personasForAI, question);
  }
}

/** Generate OpenAI-powered comments via API route, with template fallback */
export async function generateOpenAIComments(
  question: string,
  personasForAI: PersonaForAI[],
): Promise<CommentResult[]> {
  console.log(`[OpenAI] Enviando ${personasForAI.length} personas para /api/generate-comments-openai...`);
  try {
    const resp = await fetch('/api/generate-comments-openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, personas: personasForAI }),
    });

    console.log(`[OpenAI] Response status: ${resp.status}`);

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data.fallback) {
        console.warn('[OpenAI] API indisponível, usando FALLBACK. Motivo:', data.error);
        return generateFallbackComments(personasForAI, question);
      }
      throw new Error(data.error || 'API error');
    }

    const data = await resp.json();
    console.log(`[OpenAI] ${data.comments?.length || 0} comentários gerados por GPT-4o-mini`);
    return data.comments || [];
  } catch (err) {
    console.error('[OpenAI] Falha total, usando FALLBACK:', err);
    return generateFallbackComments(personasForAI, question);
  }
}

// ── Live Comment Accumulator ─────────────────────────────────────────────────

import type { PersonaForAI as _PersonaForAI } from '@/lib/simulation-prompt';
import { mapPersona as _mapPersona } from './engine';

function findBestArchetypeForComment(persona: Record<string, any>): string {
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

/**
 * Progressively selects diverse personas during streaming.
 * Stores selected PersonaForAI objects so the caller can trigger
 * AI comment generation in the background at the right moment.
 *
 * Personas are selected SPREAD across the entire streaming run,
 * not all at the beginning.
 */
export class LiveCommentAccumulator {
  private targetCount = 35;
  private usedIds = new Set<string>();
  private usedRegions = new Set<string>();
  private usedGenerations = new Set<string>();
  private usedClusters = new Set<string>();
  private usedGenders = new Set<string>();
  /** Selected personas ready for AI comment generation */
  selectedPersonas: _PersonaForAI[] = [];
  private posCount = 0;
  private negCount = 0;
  private neuCount = 0;
  private totalSeen = 0;
  /** Estimated total personas (set after first batch) */
  estimatedTotal = 20000;
  /** Next persona index at which we'll try to select */
  private nextSelectionAt = 0;

  constructor(_question: string) {
    // Spacing will be set once we know the total
  }

  /** Update estimated total to properly space selections */
  setTotal(total: number) {
    this.estimatedTotal = total;
  }

  addPersona(p: Record<string, any>, sentiment: Sentiment) {
    this.totalSeen++;
    if (this.selectedPersonas.length >= this.targetCount) return;

    // Space selections evenly: only attempt at scheduled intervals
    // e.g. 20000 personas / 35 comments = every ~571 personas
    const spacing = Math.max(50, Math.floor(this.estimatedTotal / this.targetCount));

    // Allow the first 5 quickly (for initial diversity), then space out
    if (this.selectedPersonas.length >= 5 && this.totalSeen < this.nextSelectionAt) return;

    const pid = p.id || p.name || `p-${this.totalSeen}`;
    if (this.usedIds.has(pid)) return;

    const region = p.region_br || '';
    const gen = p.generation || '';
    const cluster = p.cluster_id || '';
    const gender = p.gender_identity || '';

    // Require diversity for first 20, relax after
    const newDimensions =
      (region && !this.usedRegions.has(region) ? 1 : 0) +
      (gen && !this.usedGenerations.has(gen) ? 1 : 0) +
      (cluster && !this.usedClusters.has(cluster) ? 1 : 0) +
      (gender && !this.usedGenders.has(gender) ? 1 : 0);

    if (this.selectedPersonas.length < 20 && newDimensions === 0) return;

    // Proportional balance
    const sentCounts = { positive: this.posCount, negative: this.negCount, neutral: this.neuCount };
    const maxAllowed = Math.ceil(this.targetCount * 0.6);
    if (sentCounts[sentiment] >= maxAllowed) return;

    this.usedIds.add(pid);
    this.usedRegions.add(region);
    this.usedGenerations.add(gen);
    this.usedClusters.add(cluster);
    this.usedGenders.add(gender);

    if (sentiment === 'positive') this.posCount++;
    else if (sentiment === 'negative') this.negCount++;
    else this.neuCount++;

    // Schedule next selection
    this.nextSelectionAt = this.totalSeen + spacing;

    const archetypeId = findBestArchetypeForComment(p);
    this.selectedPersonas.push(_mapPersona(p, archetypeId, sentiment));
  }

  /** Number of personas selected so far */
  get count() { return this.selectedPersonas.length; }
}

/** Fallback: use template engine if AI is unavailable — with deduplication */
export function generateFallbackComments(
  personasForAI: PersonaForAI[],
  question: string,
): CommentResult[] {
  const topicScores = detectTopics(question);
  const dominantTopic = Object.entries(topicScores).reduce(
    (best, [topic, score]) => score > best[1] ? [topic, score] as [string, number] : best,
    ['general', 0] as [string, number],
  )[0];

  const usedComments = new Set<string>();
  const MAX_RETRIES = 5;

  return personasForAI.map(p => {
    const ctx: PersonaContext = {
      region: p.region,
      state: p.state,
      generation: p.generation,
      educationLevel: p.educationLevel,
      socialClass: p.socialClass,
      politicalLeaning: p.politicalLeaning,
      religion: p.religion,
      age: p.age,
      gender: p.gender || 'Masculino',
      areaType: p.areaType,
      archetypeId: p.archetypeId,
      name: p.name,
      clusterName: p.clusterName,
      scoreEconomico: p.scoreEconomico,
      scoreCostumes: p.scoreCostumes,
    };

    // Generate with deduplication: retry if we get a duplicate
    let comment = '';
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      comment = generateComment(ctx, dominantTopic, p.sentiment);
      // Normalize for dedup comparison (ignore punctuation and case)
      const normalized = comment.toLowerCase().replace(/[!?.…]+/g, '').trim();
      if (!usedComments.has(normalized)) {
        usedComments.add(normalized);
        break;
      }
    }

    return {
      archetype: p.archetypeId,
      sentiment: p.sentiment,
      comment,
      personaName: p.name,
      age: p.age,
      location: p.state,
      state: p.state,
      region: p.region,
      generation: p.generation,
    };
  });
}
