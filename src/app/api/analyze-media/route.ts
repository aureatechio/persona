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

const SYSTEM_PROMPT = `Voce e um analista especializado em extrair o PONTO CENTRAL de midias para pesquisa de opiniao publica brasileira.

Sua tarefa: analisar o conteudo fornecido (video, imagem, screenshot, print de tela, foto ou texto) e produzir:

1. **CONTEXTO** (obrigatorio): Um resumo estruturado do conteudo que sera usado para que 2.000 personas sinteticas brasileiras formem opiniao.

2. **PERGUNTA** (somente se solicitado): Uma pergunta clara e direta para ser feita as personas sobre o conteudo analisado.

3. **PONTO_CENTRAL** (obrigatorio): Uma frase curta e precisa que resume a TESE PRINCIPAL do autor. Ex: "O autor defende que Fulano deveria estar preso por corrupcao."

4. **FIGURAS_POLITICAS** (obrigatorio se houver figuras publicas): Lista de figuras publicas mencionadas com alinhamento politico. Para CADA figura, informe:
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
- O contexto e um RESUMO BREVE para referencia — a transcricao completa sera enviada separadamente as personas
- Identifique o PONTO CENTRAL ESPECIFICO — a tese, opiniao ou afirmacao principal do autor
- Identifique figuras publicas, partidos ou instituicoes mencionados POR NOME
- Identifique o tom geral (positivo, negativo, neutro, polemico)
- Seja factual e neutro - nao adicione opiniao propria
- Se for um print de rede social, identifique o autor, a plataforma e o conteudo exato
- Formato: texto corrido em 1-2 paragrafos curtos (maximo 200 palavras) — APENAS o essencial para identificar o tema

REGRA CRITICA PARA O PONTO CENTRAL:
- Abstraia o que o autor REALMENTE quer dizer — qual a TESE dele?
- Se menciona uma PESSOA ESPECIFICA, o ponto central DEVE conter o nome dela
- Se defende uma ACAO ESPECIFICA (prender, demitir, eleger, punir), o ponto central DEVE conter essa acao
- NUNCA generalize para temas abstratos. "Fulano deveria estar preso" NAO e "corrupcao e um problema"
- O ponto central responde: O QUE o autor QUER/DEFENDE, sobre QUEM, e POR QUE

Regras para a PERGUNTA (quando solicitada):
- DEVE preservar o ponto central especifico — nomes, acoes, entidades
- Se o autor fala de "Fulano deveria estar preso", a pergunta DEVE ser sobre Fulano estar preso, NAO sobre corrupcao em geral
- Deve ser direta e compreensivel para qualquer brasileiro
- Deve gerar opiniao polarizada (concordo/discordo/neutro)
- Maximo 1 frase
- Exemplos corretos:
  - Autor: "O Vorcaro deveria estar preso" → "Voce concorda que o Vorcaro deveria estar preso?"
  - Autor: "O Pablo Marcal e um perigo" → "Voce concorda que o Pablo Marcal representa um perigo?"
  - Autor: "O SUS nao funciona" → "Voce concorda que o SUS nao funciona?"
- Exemplos ERRADOS (nunca faca isso):
  - Autor: "O Vorcaro deveria estar preso" → "A corrupcao e um problema no Brasil?" (ERRADO - generalizou)
  - Autor: "O Pablo Marcal e um perigo" → "Politicos populistas sao perigosos?" (ERRADO - generalizou)

FORMATO DE RESPOSTA (JSON):
{"context": "...", "core_point": "...", "generated_question": "...", "political_figures": [{"nome": "...", "alinhamento": "...", "posicao_autor": "..."}]}

Se nao foi pedida pergunta, omita o campo generated_question.
Se nao houver figuras politicas, use "political_figures": [].
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
      const context = parsed.context || cleanText;
      const corePoint = parsed.core_point || '';
      const generatedQuestion = parsed.generated_question || '';
      const politicalFigures = parsed.political_figures || [];

      // ── Fidelity verification: check if core_point and question preserve specifics ──
      // Extract transcriptions from the original attachments for comparison
      const transcriptions: string[] = [];
      for (const att of attachments) {
        if (att.type === 'video' && att.data && att.data !== '__TRANSCRIPTION_FAILED__') {
          transcriptions.push(att.data);
        }
      }

      if (transcriptions.length > 0 && (generatedQuestion || corePoint)) {
        const verifyClient = getClient();
        try {
          const verifyRes = await verifyClient.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system: `Voce e um verificador de fidelidade. Sua tarefa e checar se a analise de um conteudo preservou o PONTO CENTRAL ESPECIFICO do que foi dito.

REGRAS:
- Se o autor citou uma PESSOA ESPECIFICA pelo nome, a analise DEVE conter esse nome
- Se o autor defendeu uma ACAO ESPECIFICA (prender, demitir, proibir), a analise DEVE conter essa acao
- Se o autor falou sobre um EVENTO ESPECIFICO, a analise DEVE referenciar o evento
- O ponto central NAO pode ter sido diluido em tema generico

Responda APENAS com JSON (sem markdown):
{"faithful": true|false, "issue": "explicacao curta se faithful=false", "corrected_question": "pergunta corrigida se faithful=false"}`,
            messages: [{
              role: 'user',
              content: `TRANSCRICAO ORIGINAL:\n${transcriptions.join('\n---\n')}\n\nPONTO CENTRAL EXTRAIDO: ${corePoint}\nPERGUNTA GERADA: ${generatedQuestion}\nCONTEXTO: ${context}`,
            }],
          });

          const verifyRaw = verifyRes.content.find(b => b.type === 'text')?.text?.trim() || '';
          const vStart = verifyRaw.indexOf('{');
          const vEnd = verifyRaw.lastIndexOf('}');
          if (vStart !== -1 && vEnd > vStart) {
            const verification = JSON.parse(verifyRaw.slice(vStart, vEnd + 1));
            console.log('[Analyze Media] Fidelity check:', verification);

            if (!verification.faithful) {
              console.warn('[Analyze Media] Fidelity FAILED:', verification.issue);
              // Use corrected question if provided
              if (verification.corrected_question) {
                return NextResponse.json({
                  context,
                  core_point: corePoint,
                  political_figures: politicalFigures,
                  ...(verification.corrected_question && { generated_question: verification.corrected_question }),
                  fidelity_corrected: true,
                  fidelity_issue: verification.issue,
                });
              }
            }
          }
        } catch (verifyErr) {
          console.warn('[Analyze Media] Fidelity check failed, continuing:', verifyErr);
        }
      }

      return NextResponse.json({
        context,
        core_point: corePoint,
        political_figures: politicalFigures,
        ...(generatedQuestion && { generated_question: generatedQuestion }),
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
