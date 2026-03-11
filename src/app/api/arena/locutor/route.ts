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

  // Build segments summary
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
Posicao Politica: ${formatSeg(segments.politicalLeaning)}`;
  }

  const isPartial = phase !== 'complete';

  const systemPrompt = `Voce e um consultor politico e de comunicacao estrategica de altissimo nivel. Voce esta analisando os resultados de uma pesquisa sintetica com ${totalPersonas?.toLocaleString() || 'milhares de'} personas digitais que representam o eleitorado brasileiro.

Seu papel e dar um PARECER ESTRATEGICO claro e direto sobre como o publico reagiu ao conteudo/pergunta apresentado.

REGRAS:
- Fale em portugues brasileiro, tom profissional mas acessivel
- Seja DIRETO e ESTRATEGICO — nada de enrolacao
- Identifique os PONTOS CRITICOS: o que causou rejeicao e o que gerou aprovacao
- De RECOMENDACOES CONCRETAS de como melhorar a aceitacao
- Destaque grupos demograficos chave (quem aprova, quem rejeita e por que)
- ${isPartial ? 'Esta e uma analise PRELIMINAR com dados parciais. Indique isso brevemente no inicio.' : 'Esta e a analise FINAL com todos os dados processados.'}
- Maximo 4-5 paragrafos
- Use dados especificos (porcentagens, grupos) para embasar suas conclusoes`;

  const userMessage = `CONTEUDO ANALISADO: "${question}"

RESULTADO GERAL:
- A Favor: ${pctPos}% (${positive?.toLocaleString()} personas)
- Contra: ${pctNeg}% (${negative?.toLocaleString()} personas)
- Neutros: ${pctNeu}% (${neutral?.toLocaleString()} personas)
- Total: ${total?.toLocaleString()} personas analisadas${isPartial ? ' (parcial)' : ''}

BREAKDOWN DEMOGRAFICO:
${segmentsSummary || 'Ainda sendo calculado...'}

Faca seu parecer estrategico.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
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
        console.error('[Locutor] Error:', err);
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
