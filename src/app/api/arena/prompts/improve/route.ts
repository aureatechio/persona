import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export const maxDuration = 60;

const SYSTEM_PROMPT = `Você é um especialista em prompt engineering para o sistema Arena da Synthetic Person.
Sua missão: receber o prompt atual + instruções do usuário (e/ou sliders) e gerar uma versão melhorada do prompt.

REGRAS ABSOLUTAS:
1. Modifique APENAS as partes relevantes do prompt — não reescreva tudo
2. Mantenha o formato existente (numeração, ⚠️, MAIÚSCULAS, bullets)
3. Não remova regras funcionais existentes a menos que explicitamente pedido
4. Se mudar thresholds, atualize TODOS os exemplos que os referenciam
5. Se houver contradição entre instrução e regras existentes, sinalize em warnings
6. O prompt resultante deve ser coerente internamente (sem contradições)
7. Mantenha o tom e estilo do prompt original

FORMATO DE RESPOSTA:
Responda SOMENTE com JSON válido (sem markdown, sem \`\`\`):
{
  "improved_prompt": "...prompt completo modificado...",
  "changelog": ["Mudança 1", "Mudança 2", ...],
  "warnings": ["Alerta se houver conflito ou risco"]
}`;

interface SliderValues {
  political_bias?: number;
  neutral_pct?: number;
  humor_level?: number;
  profanity_level?: number;
  regionalism?: number;
}

function slidersToInstructions(sliders: SliderValues): string[] {
  const instructions: string[] = [];

  if (sliders.political_bias !== undefined && sliders.political_bias !== 0) {
    if (sliders.political_bias < 0) {
      const intensity = Math.abs(sliders.political_bias) > 0.5 ? 'fortemente' : 'levemente';
      instructions.push(`Force ${intensity} mais opiniões de esquerda/progressista nos comentários`);
    } else {
      const intensity = sliders.political_bias > 0.5 ? 'fortemente' : 'levemente';
      instructions.push(`Force ${intensity} mais opiniões de direita/conservador nos comentários`);
    }
  }

  if (sliders.neutral_pct !== undefined && sliders.neutral_pct !== 0) {
    if (sliders.neutral_pct < 0) {
      const target = sliders.neutral_pct < -0.5 ? '3%' : '5%';
      instructions.push(`Minimize comentários neutros para no máximo ${target}`);
    } else {
      const target = sliders.neutral_pct > 0.5 ? '25%' : '20%';
      instructions.push(`Permita até ${target} de comentários neutros`);
    }
  }

  if (sliders.humor_level !== undefined && sliders.humor_level !== 0) {
    if (sliders.humor_level < 0) {
      instructions.push('Reduza humor, ironia e deboche nos comentários — tom mais sério');
    } else {
      instructions.push('Aumente humor, ironia e deboche nos comentários — mais leveza e sarcasmo');
    }
  }

  if (sliders.profanity_level !== undefined && sliders.profanity_level !== 0) {
    if (sliders.profanity_level < 0) {
      instructions.push('Reduza palavrões e linguagem vulgar — mais formal e polido');
    } else {
      instructions.push('Aumente palavrões e linguagem de rua — mais autêntico e visceral');
    }
  }

  if (sliders.regionalism !== undefined && sliders.regionalism !== 0) {
    if (sliders.regionalism < 0) {
      instructions.push('Reduza gírias regionais e sotaques — português mais neutro/padrão');
    } else {
      instructions.push('Intensifique sotaques, gírias e expressões regionais de cada estado');
    }
  }

  return instructions;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instruction, currentPrompt, sliders } = body;

    if (!currentPrompt) {
      return NextResponse.json(
        { error: 'currentPrompt é obrigatório' },
        { status: 400 },
      );
    }

    // Build combined instruction from free text + sliders
    const parts: string[] = [];

    if (sliders) {
      const sliderInstructions = slidersToInstructions(sliders);
      if (sliderInstructions.length > 0) {
        parts.push('AJUSTES DOS POTENCIÔMETROS:\n' + sliderInstructions.map(s => `- ${s}`).join('\n'));
      }
    }

    if (instruction && instruction.trim()) {
      parts.push('INSTRUÇÃO DO USUÁRIO:\n' + instruction.trim());
    }

    if (parts.length === 0) {
      return NextResponse.json(
        { error: 'Forneça uma instrução ou ajuste os sliders' },
        { status: 400 },
      );
    }

    const userMessage = `PROMPT ATUAL:\n${currentPrompt}\n\n---\n\n${parts.join('\n\n')}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Strip markdown code fences if present (```json ... ```)
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[arena/prompts/improve] Failed to parse AI response:', cleaned.slice(0, 500));
      return NextResponse.json(
        { error: 'A IA retornou um formato inválido. Tente novamente.' },
        { status: 502 },
      );
    }

    if (!parsed.improved_prompt) {
      return NextResponse.json(
        { error: 'A IA não retornou o prompt melhorado. Tente novamente.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      improved_prompt: parsed.improved_prompt,
      changelog: parsed.changelog || [],
      warnings: parsed.warnings || [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[arena/prompts/improve] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
