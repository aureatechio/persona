import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

// Round-robin across available keys
const KEYS = [
  process.env.ANTHROPIC_API_KEY,
  process.env.ANTHROPIC_API_KEY_2,
  process.env.ANTHROPIC_API_KEY_3,
  process.env.ANTHROPIC_API_KEY_4,
].filter(Boolean) as string[];

let keyIndex = 0;
function getClient() {
  const key = KEYS[keyIndex % KEYS.length];
  keyIndex++;
  return new Anthropic({ apiKey: key });
}

const SYSTEM_PROMPT = `Voce e um analista especializado em extrair contexto de midias para pesquisa de opiniao publica brasileira.

Sua tarefa: analisar o conteudo fornecido (imagem, screenshot, print de tela, foto ou texto) e produzir:

1. **CONTEXTO** (obrigatorio): Um resumo estruturado do conteudo que sera usado para que 2.000 personas sinteticas brasileiras formem opiniao.

2. **PERGUNTA** (somente se solicitado): Uma pergunta clara e direta para ser feita as personas sobre o conteudo analisado.

Regras para o CONTEXTO:
- Extraia TODOS os fatos, argumentos, numeros e posicoes mencionados
- Identifique o tema central e subtemas
- Identifique figuras publicas, partidos ou instituicoes mencionados
- Identifique o tom geral (positivo, negativo, neutro, polemico)
- Seja factual e neutro - nao adicione opiniao propria
- Se for um print de rede social, identifique o autor, a plataforma e o conteudo exato
- Formato: texto corrido em 2-4 paragrafos, maximo 500 palavras

Regras para a PERGUNTA (quando solicitada):
- Deve ser direta e compreensivel para qualquer brasileiro
- Deve gerar opiniao polarizada (concordo/discordo/neutro)
- Deve refletir o tema central do conteudo
- Maximo 1 frase
- Exemplo: "Voce concorda com a proposta de...?" ou "O que voce acha sobre...?"

FORMATO DE RESPOSTA (JSON):
{"context": "...", "generated_question": "..."}

Se nao foi pedida pergunta, omita o campo generated_question.
Responda APENAS o JSON, sem markdown, sem code blocks.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { attachments, question, generate_question } = body as {
      attachments: { type: string; data: string; name: string }[];
      question?: string;
      generate_question?: boolean;
    };

    if (!attachments || attachments.length === 0) {
      return NextResponse.json({ error: 'Nenhum anexo fornecido' }, { status: 400 });
    }

    if (KEYS.length === 0) {
      return NextResponse.json({ error: 'Nenhuma API key configurada' }, { status: 500 });
    }

    const client = getClient();

    // Build content blocks for Claude multimodal request
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    // Add prompt text
    let prompt = '';
    if (question) {
      prompt += `Pergunta que sera feita as personas: "${question}"\n\n`;
    }
    prompt += 'Analise o conteudo a seguir e extraia o contexto completo.';
    if (generate_question) {
      prompt += '\n\nIMPORTANTE: O usuario NAO forneceu uma pergunta. Voce DEVE gerar uma pergunta adequada no campo "generated_question" do JSON.';
    }
    content.push({ type: 'text', text: prompt });

    // Add image attachments (Claude supports images natively)
    // For videos, transcribe audio first via Whisper
    for (const att of attachments) {
      if (att.type === 'image' && att.data.startsWith('data:')) {
        const match = att.data.match(/^data:(image\/[\w+]+);base64,(.+)$/);
        if (match) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: match[2],
            },
          });
        }
      } else if (att.type === 'url') {
        content.push({ type: 'text', text: `\n\nURL para contexto: ${att.data}` });
      } else if (att.type === 'video') {
        // Transcribe video audio via Whisper
        try {
          const origin = request.headers.get('origin') || request.headers.get('host') || '';
          const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;

          const transcribeRes = await fetch(`${baseUrl}/api/transcribe-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: att.data, name: att.name }),
          });

          if (transcribeRes.ok) {
            const { transcript } = await transcribeRes.json();
            if (transcript) {
              content.push({
                type: 'text',
                text: `\n\n--- TRANSCRICAO DO VIDEO "${att.name}" ---\n${transcript}\n--- FIM DA TRANSCRICAO ---`,
              });
            } else {
              content.push({
                type: 'text',
                text: `\n\n[Video anexado: ${att.name} - audio sem fala detectada]`,
              });
            }
          } else {
            console.warn('[Analyze Media] Transcription failed for', att.name);
            content.push({
              type: 'text',
              text: `\n\n[Video anexado: ${att.name} - transcricao indisponivel]`,
            });
          }
        } catch (transcribeErr) {
          console.warn('[Analyze Media] Transcription error:', transcribeErr);
          content.push({
            type: 'text',
            text: `\n\n[Video anexado: ${att.name} - erro na transcricao]`,
          });
        }
      }
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const rawText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    // Parse JSON response from Claude — strip code fences first
    let cleanText = rawText
      .replace(/```(?:json|JSON)?\s*/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      // Find JSON object boundaries
      const start = cleanText.indexOf('{');
      const end = cleanText.lastIndexOf('}');
      const jsonStr = start !== -1 && end > start ? cleanText.slice(start, end + 1) : cleanText;

      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({
        context: parsed.context || cleanText,
        ...(parsed.generated_question && { generated_question: parsed.generated_question }),
      });
    } catch {
      // If parsing failed, return the cleaned text as context
      // Also strip residual JSON keys if present
      cleanText = cleanText
        .replace(/^\s*\{?\s*"context"\s*:\s*"?/i, '')
        .replace(/"?\s*,?\s*"generated_question"\s*:[\s\S]*$/i, '')
        .replace(/"\s*\}\s*$/g, '')
        .replace(/\\n/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return NextResponse.json({ context: cleanText });
    }
  } catch (err: any) {
    console.error('[Analyze Media] Claude error:', err?.message || err);
    return NextResponse.json(
      { error: 'Falha ao analisar midia', detail: err?.message },
      { status: 500 },
    );
  }
}
