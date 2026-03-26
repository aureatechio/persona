import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

// Round-robin across available keys
const KEYS = [
  process.env.ANTHROPIC_API_KEY,
  process.env.ANTHROPIC_API_KEY_2,
  process.env.ANTHROPIC_API_KEY_3,
  process.env.ANTHROPIC_API_KEY_4,
  process.env.ANTHROPIC_API_KEY_5,
].filter(Boolean) as string[];

let keyIndex = 0;
function getClient() {
  const key = KEYS[keyIndex % KEYS.length];
  keyIndex++;
  return new Anthropic({ apiKey: key });
}

const SYSTEM_PROMPT = `Voce e um analista especializado em extrair o CONTEXTO COMPLETO de midias para pesquisa de opiniao publica brasileira.

Sua tarefa: analisar o conteudo fornecido (video, imagem, screenshot, print de tela, foto ou texto) e produzir:

1. **CONTEXTO** (obrigatorio): Um resumo COMPLETO e DETALHADO do conteudo. Este texto sera enviado para que 20.000 personas sinteticas brasileiras formem opiniao baseado APENAS neste contexto. Inclua:
   - TUDO que esta escrito, dito ou mostrado na midia
   - O ponto central, a tese ou opiniao do autor
   - Dados, numeros, fatos mencionados
   - Tom e intencao do conteudo
   - Se for print de rede social: autor, plataforma, conteudo exato
   - NÃO resuma demais — as personas precisam de contexto RICO para formar opiniao

2. **PONTO_CENTRAL** (obrigatorio): Uma frase curta e precisa que resume a TESE PRINCIPAL do autor. Ex: "O autor defende que Fulano deveria estar preso por corrupcao."

3. **FIGURAS_POLITICAS** (obrigatorio se houver figuras publicas): Lista de figuras publicas mencionadas com alinhamento politico. Para CADA figura, informe:
   - nome: nome completo ou como e conhecida
   - alinhamento: "direita", "centro-direita", "centro", "centro-esquerda", "esquerda"
   - posicao_autor: como o autor do conteudo se posiciona em relacao a essa figura ("a favor", "contra", "neutro")

   Exemplos de alinhamento conhecidos:
   - Bolsonaro, familia Bolsonaro → direita
   - Nicolas Ferreira → direita
   - Pablo Marcal → direita
   - Tarcisio de Freitas → centro-direita
   - Lula → esquerda
   - Marina Silva → centro-esquerda
   - Guilherme Boulos → esquerda
   - Ciro Gomes → centro-esquerda
   - Tabata Amaral → centro
   - Simone Tebet → centro
   - Se nao souber o alinhamento, infira pelo contexto ou omita a figura

Regras para o CONTEXTO:
- Seja COMPLETO — inclua TODOS os detalhes relevantes do conteudo
- Identifique o PONTO CENTRAL ESPECIFICO — a tese, opiniao ou afirmacao principal do autor
- Identifique figuras publicas, partidos ou instituicoes mencionados POR NOME
- Identifique o tom geral (positivo, negativo, neutro, polemico)
- Seja factual e neutro - nao adicione opiniao propria
- Se for um print de rede social, identifique o autor, a plataforma e o conteudo exato
- Se houver texto na imagem, TRANSCREVA o texto completo

REGRA CRITICA PARA O PONTO CENTRAL:
- Abstraia o que o autor REALMENTE quer dizer — qual a TESE dele?
- Se menciona uma PESSOA ESPECIFICA, o ponto central DEVE conter o nome dela
- Se defende uma ACAO ESPECIFICA (prender, demitir, eleger, punir), o ponto central DEVE conter essa acao
- NUNCA generalize para temas abstratos. "Fulano deveria estar preso" NAO e "corrupcao e um problema"
- O ponto central responde: O QUE o autor QUER/DEFENDE, sobre QUEM, e POR QUE

FORMATO DE RESPOSTA (JSON):
{"context": "...", "core_point": "...", "political_figures": [{"nome": "...", "alinhamento": "...", "posicao_autor": "..."}]}

Se nao houver figuras politicas, use "political_figures": [].
Responda APENAS o JSON, sem markdown, sem code blocks.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { attachments, question } = body as {
      attachments: { type: string; data: string; name: string }[];
      question?: string;
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
      prompt += `Pergunta/tema de referencia: "${question}"\n\n`;
    }
    prompt += 'Analise o conteudo a seguir e extraia o contexto COMPLETO e DETALHADO.';
    content.push({ type: 'text', text: prompt });

    // Add image attachments (Claude supports images natively)
    // For videos, transcribe audio first via Whisper
    for (const att of attachments) {
      if (att.type === 'image' && att.data.startsWith('data:')) {
        // Base64 data URL (web flow)
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
      } else if (att.type === 'image' && (att.data.startsWith('http://') || att.data.startsWith('https://'))) {
        // URL flow (mobile uploads to Supabase first)
        content.push({
          type: 'image',
          source: {
            type: 'url',
            url: att.data,
          },
        } as any);
      } else if (att.type === 'url') {
        content.push({ type: 'text', text: `\n\nURL para contexto: ${att.data}` });
      } else if (att.type === 'video') {
        // Video transcripts arrive pre-resolved from frontend (transcribed via Python Whisper)
        if (att.data === '__TRANSCRIPTION_FAILED__') {
          // Transcription service failed — skip video entirely, don't mislead Claude
          console.warn(`[Analyze Media] Transcription failed for ${att.name}, skipping`);
          content.push({
            type: 'text',
            text: `\n\n[Video "${att.name}": transcricao indisponivel — servico de audio temporariamente fora. Ignore este anexo.]`,
          });
        } else if (att.data) {
          content.push({
            type: 'text',
            text: `\n\n--- TRANSCRICAO DO VIDEO "${att.name}" ---\n${att.data}\n--- FIM DA TRANSCRICAO ---`,
          });
        } else {
          content.push({
            type: 'text',
            text: `\n\n[Video anexado: ${att.name} - audio sem fala detectada]`,
          });
        }
      }
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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
      const context = parsed.context || cleanText;
      const corePoint = parsed.core_point || '';
      const politicalFigures = parsed.political_figures || [];

      return NextResponse.json({
        context,
        core_point: corePoint,
        political_figures: politicalFigures,
      });
    } catch {
      // If parsing failed, return the cleaned text as context
      cleanText = cleanText
        .replace(/^\s*\{?\s*"context"\s*:\s*"?/i, '')
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
