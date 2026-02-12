import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserPrompt, chunkArray } from '@/lib/simulation-prompt';
import type { PersonaForAI } from '@/lib/simulation-prompt';

// ── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  question: string;
  personas: PersonaForAI[];
}

// ── API Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'COLE_SUA_CHAVE_AQUI') {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured', fallback: true },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { question, personas } = body;

  if (!question || !personas || personas.length === 0) {
    return NextResponse.json({ error: 'Missing question or personas' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // Process in batches of 8 personas (parallel)
  const batches = chunkArray(personas, 8);

  try {
    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        const userPrompt = buildUserPrompt(question, batch);

        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        // Extract text content
        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('No text in response');
        }

        // Parse JSON from response
        const jsonText = textBlock.text.trim();
        const cleanJson = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        const parsed: { id: number; comment: string; sentiment?: string }[] = JSON.parse(cleanJson);

        return parsed;
      }),
    );

    // Flatten and map back to personas
    const allComments: { id: number; comment: string; sentiment?: string }[] = [];
    let globalIdx = 0;

    for (const batchResult of batchResults) {
      for (const item of batchResult) {
        allComments.push({ id: globalIdx, comment: item.comment, sentiment: item.sentiment });
        globalIdx++;
      }
    }

    // Valid sentiments for type safety
    const validSentiments = new Set(['positive', 'negative', 'neutral']);

    // Map comments to persona data — use AI-classified sentiment when available
    const comments = personas.map((persona, idx) => {
      const aiComment = allComments[idx];
      const aiSentiment = aiComment?.sentiment && validSentiments.has(aiComment.sentiment)
        ? aiComment.sentiment as 'positive' | 'negative' | 'neutral'
        : persona.sentiment;
      return {
        archetype: persona.archetypeId,
        sentiment: aiSentiment,
        comment: aiComment?.comment || 'sem comentário',
        personaName: persona.name,
        age: persona.age,
        location: persona.state,
        state: persona.state,
        region: persona.region,
        generation: persona.generation,
      };
    });

    return NextResponse.json({ comments });
  } catch (error: unknown) {
    console.error('Claude API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `AI generation failed: ${message}`, fallback: true },
      { status: 500 },
    );
  }
}
