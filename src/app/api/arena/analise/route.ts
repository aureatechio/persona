import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, positive, negative, neutral, totalPersonas, segments, phase } = body;

  const total = positive + negative + neutral;
  const pctPos = total > 0 ? ((positive / total) * 100).toFixed(1) : '0';
  const pctNeg = total > 0 ? ((negative / total) * 100).toFixed(1) : '0';
  const pctNeu = total > 0 ? ((neutral / total) * 100).toFixed(1) : '0';

  let segmentsSummary = '';
  if (segments) {
    const formatSeg = (items: any[]) =>
      items?.slice(0, 5).map((s: any) => {
        const t = s.positive + s.negative + s.neutral;
        return `${s.label}: ${t > 0 ? ((s.positive / t) * 100).toFixed(0) : 0}% favor, ${t > 0 ? ((s.negative / t) * 100).toFixed(0) : 0}% contra`;
      }).join('; ') || '';

    segmentsSummary = `
Genero: ${formatSeg(segments.gender)}
Religiao: ${formatSeg(segments.religion)}
Raca/Etnia: ${formatSeg(segments.race)}
Regiao: ${formatSeg(segments.region)}
Geracao: ${formatSeg(segments.generation)}
Classe Social: ${formatSeg(segments.socialClass)}
Escolaridade: ${formatSeg(segments.education)}
Posicao Politica: ${formatSeg(segments.politicalLeaning)}
Voto 2022: ${formatSeg(segments.voto2022)}
Intencao 2026: ${formatSeg(segments.voto2026)}`;
  }

  const systemPrompt = `Voce e um consultor politico e de comunicacao estrategica de altissimo nivel. Analise os resultados da pesquisa sintetica com ${totalPersonas?.toLocaleString() || 'milhares de'} personas digitais e produza uma analise estruturada.

FORMATO OBRIGATORIO — use exatamente estes headers markdown:

## Acertos
(3-5 bullets com dados especificos: por que o publico aprovou, quais grupos demograficos, porcentagens)

## Erros
(3-5 bullets com dados especificos: por que houve rejeicao, quais grupos rejeitaram, porcentagens)

## Sugestoes
(3-4 sugestoes concretas e acionaveis de como melhorar a aceitacao, baseadas nos erros identificados)

REGRAS:
- Portugues brasileiro, tom profissional
- Cada bullet deve citar dados especificos (grupos, porcentagens)
- Bullets devem comecar com "- " (markdown list)
- Seja direto e estrategico, sem enrolacao
- Use ** para destacar termos chave`;

  const userMessage = `CONTEUDO ANALISADO: "${question}"

RESULTADO GERAL:
- A Favor: ${pctPos}% (${positive?.toLocaleString()} personas)
- Contra: ${pctNeg}% (${negative?.toLocaleString()} personas)
- Neutros: ${pctNeu}% (${neutral?.toLocaleString()} personas)
- Total: ${total?.toLocaleString()} personas analisadas

BREAKDOWN DEMOGRAFICO:
${segmentsSummary || 'Ainda sendo calculado...'}

Produza a analise estruturada com Acertos, Erros e Sugestoes.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error('[Analise] Error:', err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Falha na analise' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
