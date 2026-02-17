import type { CommentResult } from './types';
import type { PersonaForAI } from '@/lib/simulation-prompt';
import type { PersonaContext } from '@/lib/persona-writing-style';
import { generateComment } from '@/lib/comment-generator';
import { detectTopics } from './engine';

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
