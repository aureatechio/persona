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
    // Process each batch independently — partial failures don't kill everything
    const batchResults = await Promise.allSettled(
      batches.map(async (batch) => {
        const userPrompt = buildUserPrompt(question, batch);

        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('No text in response');
        }

        const jsonText = textBlock.text.trim();
        const cleanJson = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        const parsed: { id: number; comment: string }[] = JSON.parse(cleanJson);

        return parsed;
      }),
    );

    // Flatten results — for failed batches, use null placeholders
    const allComments: ({ comment: string } | null)[] = [];
    let batchStartIdx = 0;

    for (let b = 0; b < batchResults.length; b++) {
      const batchSize = batches[b].length;
      const result = batchResults[b];

      if (result.status === 'fulfilled') {
        for (let i = 0; i < batchSize; i++) {
          const item = result.value[i];
          allComments.push(item ? { comment: item.comment } : null);
        }
      } else {
        console.error(`[Claude] Batch ${b} failed:`, result.reason);
        for (let i = 0; i < batchSize; i++) {
          allComments.push(null);
        }
      }
      batchStartIdx += batchSize;
    }

    // Check if we got at least some AI comments
    const successCount = allComments.filter(c => c !== null).length;
    if (successCount === 0) {
      return NextResponse.json(
        { error: 'All AI batches failed', fallback: true },
        { status: 500 },
      );
    }

    // Deduplication: track used comments to prevent repeats
    const usedTexts = new Set<string>();

    const comments = personas.map((persona, idx) => {
      let commentText = allComments[idx]?.comment || '';

      // Check for empty or duplicate
      const normalized = commentText.toLowerCase().replace(/[!?.…\s]+/g, '').trim();
      if (!commentText || normalized.length < 5 || usedTexts.has(normalized)) {
        commentText = '';
      } else {
        usedTexts.add(normalized);
      }

      return {
        archetype: persona.archetypeId,
        sentiment: persona.sentiment,
        comment: commentText || `comentário de ${persona.name} sobre o tema`,
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
