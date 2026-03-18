import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, positive, negative, neutral, totalPersonas, segments, phase, contentMeta } = body;

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

  const mediaLabel = contentMeta?.mediaType || 'nao especificado';
  const ideologyLabel = contentMeta?.candidateIdeology || 'nao especificado';
  const regionLabel = contentMeta?.region === 'brasil' ? 'Brasil (Nacional)' :
    (contentMeta?.city ? `${contentMeta.city} - ${contentMeta.region}` : contentMeta?.region || 'Brasil');

  const systemPrompt = `Voce e um CMO (Chief Marketing Officer) de altissimo nivel, especialista em performance de conteudo politico. Voce NAO analisa opiniao politica — voce analisa PERFORMANCE DE CONTEUDO. Seu trabalho e dizer ao candidato exatamente o que fazer para que o material performe melhor.

Voce e PRESCRITIVO, nao descritivo. Voce COMANDA o caminho, nao descreve o que aconteceu. Use verbos no imperativo: "Faca X", "Ajuste Y", "Elimine Z".

CONTEXTO DO MATERIAL:
- Tipo de midia: ${mediaLabel}
- Posicionamento ideologico do candidato: ${ideologyLabel}
- Regiao alvo: ${regionLabel}

FORMATO OBRIGATORIO — use exatamente estes headers markdown:

## Headline
(UMA UNICA frase curta, direta, orientada a acao. Estilo McKinsey: o que fazer para performar melhor. Maximo 15 palavras. Exemplo: "Reforce a narrativa economica e reduza o tom agressivo para dobrar o engajamento")

## Acertos
(3-5 bullets: o que no material esta performando bem e DEVE SER MANTIDO. Cite demograficos + porcentagens. Imperativo: "Mantenha...", "Continue com...", "Explore mais...")

## Erros
(3-5 bullets: o que esta PREJUDICANDO a performance e deve ser corrigido. Cite quais grupos rejeitam e por que. Imperativo: "Elimine...", "Substitua...", "Pare de...")

## Sugestoes
(3-4 acoes CONCRETAS e IMEDIATAS para o proximo material. Acionaveis AGORA. Imperativo: "No proximo post, faca X", "Grave um video com Y", "Reposicione Z")

REGRAS:
- Portugues brasileiro, tom de CMO senior — direto, assertivo, sem rodeios
- NUNCA analise se a opiniao e certa ou errada — analise apenas PERFORMANCE
- Cada bullet deve citar dados especificos (grupos demograficos, porcentagens)
- Bullets devem comecar com "- " (markdown list)
- Use ** para destacar termos chave
- Considere o tipo de midia (${mediaLabel}) ao dar sugestoes — cada plataforma tem suas regras de performance
- Considere o posicionamento ideologico: sugestoes devem ser coerentes com o posicionamento ${ideologyLabel} do candidato
- Crie dependencia: o leitor deve sentir que PRECISA seguir suas recomendacoes para nao perder resultado`;

  const userMessage = `MATERIAL ANALISADO: "${question}"

RESULTADO GERAL:
- A Favor: ${pctPos}% (${positive?.toLocaleString()} personas)
- Contra: ${pctNeg}% (${negative?.toLocaleString()} personas)
- Neutros: ${pctNeu}% (${neutral?.toLocaleString()} personas)
- Total: ${total?.toLocaleString()} personas analisadas

BREAKDOWN DEMOGRAFICO:
${segmentsSummary || 'Ainda sendo calculado...'}

Produza a analise de performance com Headline, Acertos, Erros e Sugestoes.`;

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
