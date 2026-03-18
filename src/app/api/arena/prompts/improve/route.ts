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
}

function slidersToInstructions(sliders: SliderValues): string[] {
  const instructions: string[] = [];

  if (sliders.political_bias !== undefined) {
    const bias = sliders.political_bias;

    if (bias === 0) {
      instructions.push(
        'NEUTRALIZAR VIÉS POLÍTICO: Remova qualquer viés político do prompt. ' +
        'As personas devem reagir com base EXCLUSIVAMENTE no seu perfil demográfico, ' +
        'posição política e histórico de voto — sem peso adicional para nenhum lado. ' +
        'Um eleitor de Lula pode concordar com uma pauta de direita se fizer sentido para seu perfil. ' +
        'Um eleitor de Bolsonaro pode concordar com uma pauta de esquerda se fizer sentido.'
      );
    } else if (bias < 0) {
      const absVal = Math.abs(bias);
      const intensity = absVal > 0.7 ? 'MUITO FORTE' : absVal > 0.4 ? 'FORTE' : 'MODERADO';
      const pctShift = Math.round(absVal * 40);

      instructions.push(
        `VIÉS POLÍTICO DE ESQUERDA (${intensity}, valor: ${bias.toFixed(2)}):\n` +
        `O SCORE VAI DE 0 (TOTALMENTE CONTRA) A 10 (TOTALMENTE A FAVOR). Entenda a DIREÇÃO:\n\n` +
        `REGRA CENTRAL: Com viés esquerda, tudo que FAVORECE a esquerda deve ter score MAIS ALTO, ` +
        `e tudo que ATACA a esquerda deve ter score MAIS BAIXO.\n\n` +
        `EXEMPLOS CONCRETOS DE COMO O SCORE DEVE SE MOVER:\n` +
        `- Pergunta "Lula é corrupto?" → Eleitores de Lula: score DEVE BAIXAR (discordar mais, ~${2 - pctShift/20}). ` +
        `Eleitores de Bolsonaro: score DEVE BAIXAR também (menos agressivos contra Lula, ~${6 - pctShift/10})\n` +
        `- Pergunta "Bolsa família é bom?" → Todos: score DEVE SUBIR (mais favoráveis)\n` +
        `- Pergunta "Privatização é boa?" → Todos: score DEVE BAIXAR (mais contrários)\n\n` +
        `REGRAS DE AJUSTE (shift de ~${pctShift}%):\n` +
        `- Personas que JÁ concordam com a esquerda: MANTER ou REFORÇAR levemente (não piorar quem já está do lado certo)\n` +
        `- Personas que discordam da esquerda: REDUZIR a discordância (puxar scores altos contra esquerda para baixo)\n` +
        `- NUNCA inverter o efeito: se uma persona já defende a esquerda (score baixo em "Lula corrupto"), NÃO aumentar o score\n` +
        `- O viés deve PROTEGER quem já está alinhado e CONVERTER quem está contra\n\n` +
        `IMPORTANTE: Modifique as regras de classificação de sentimento no prompt para que o GPT ` +
        `atribua sentiment=positive para posições pró-esquerda e sentiment=negative para posições pró-direita, ` +
        `com peso proporcional ao viés (${absVal.toFixed(2)})`
      );
    } else {
      const intensity = bias > 0.7 ? 'MUITO FORTE' : bias > 0.4 ? 'FORTE' : 'MODERADO';
      const pctShift = Math.round(bias * 40);

      instructions.push(
        `VIÉS POLÍTICO DE DIREITA (${intensity}, valor: +${bias.toFixed(2)}):\n` +
        `O SCORE VAI DE 0 (TOTALMENTE CONTRA) A 10 (TOTALMENTE A FAVOR). Entenda a DIREÇÃO:\n\n` +
        `REGRA CENTRAL: Com viés direita, tudo que FAVORECE a direita deve ter score MAIS ALTO, ` +
        `e tudo que ATACA a direita deve ter score MAIS BAIXO.\n\n` +
        `EXEMPLOS CONCRETOS DE COMO O SCORE DEVE SE MOVER:\n` +
        `- Pergunta "Bolsonaro é autoritário?" → Eleitores de Bolsonaro: score DEVE BAIXAR (discordar mais). ` +
        `Eleitores de Lula: score DEVE BAIXAR também (menos agressivos contra Bolsonaro)\n` +
        `- Pergunta "Privatização é boa?" → Todos: score DEVE SUBIR (mais favoráveis)\n` +
        `- Pergunta "Bolsa família é bom?" → Todos: score DEVE BAIXAR (mais céticos)\n\n` +
        `REGRAS DE AJUSTE (shift de ~${pctShift}%):\n` +
        `- Personas que JÁ concordam com a direita: MANTER ou REFORÇAR levemente (não piorar quem já está do lado certo)\n` +
        `- Personas que discordam da direita: REDUZIR a discordância (puxar scores altos contra direita para baixo)\n` +
        `- NUNCA inverter o efeito: se uma persona já defende a direita (score baixo em "Bolsonaro autoritário"), NÃO aumentar o score\n` +
        `- O viés deve PROTEGER quem já está alinhado e CONVERTER quem está contra\n\n` +
        `IMPORTANTE: Modifique as regras de classificação de sentimento no prompt para que o GPT ` +
        `atribua sentiment=positive para posições pró-direita e sentiment=negative para posições pró-esquerda, ` +
        `com peso proporcional ao viés (${bias.toFixed(2)})`
      );
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

    // If no explicit instruction and no slider changes, apply neutralization
    if (parts.length === 0) {
      parts.push('INSTRUÇÃO: Mantenha o prompt como está, apenas garanta que não há viés político embutido. Neutralize qualquer tendência política existente.');
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
