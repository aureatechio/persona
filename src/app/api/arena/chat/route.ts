import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { analiseData, arenaData, messages, question } = body;

  if (!question || !analiseData) {
    return Response.json({ error: 'Pergunta e dados de análise são obrigatórios' }, { status: 400 });
  }

  const total = (arenaData?.positive || 0) + (arenaData?.negative || 0) + (arenaData?.neutral || 0);

  const systemPrompt = `Você é um amigo que manja de redes sociais e comunicação. A pessoa te mandou um post e você analisou pra ela. Agora vocês estão conversando sobre como melhorar esse post. Você tem esses dados da análise (USE INTERNAMENTE, não despeje dados na resposta):

HEADLINE: ${analiseData.headline}
SCORE: ${analiseData.score}/10
SCORE PROJETADO: ${analiseData.projectedScore}/10

SENTIMENTO GERAL:
- A favor: ${total > 0 ? ((arenaData.positive / total) * 100).toFixed(0) : 0}% (${arenaData.positive} personas)
- Contra: ${total > 0 ? ((arenaData.negative / total) * 100).toFixed(0) : 0}% (${arenaData.negative} personas)
- Neutros: ${total > 0 ? ((arenaData.neutral / total) * 100).toFixed(0) : 0}% (${arenaData.neutral} personas)
- Total: ${arenaData.totalPersonas || total} personas

RADAR DE PERFORMANCE:
${analiseData.radar ? Object.entries(analiseData.radar).map(([k, v]) => `- ${k}: ${v}/10`).join('\n') : 'Não disponível'}

RECOMENDAÇÕES:
${analiseData.recommendations?.map((r: any, i: number) => `${i + 1}. ${r.text} (${r.gain})`).join('\n') || 'Não disponível'}

INSIGHT PRINCIPAL:
${analiseData.insight?.title || ''}: ${analiseData.insight?.description || ''}

PRÓXIMOS PASSOS:
${analiseData.nextSteps?.map((s: any, i: number) => `${i + 1}. ${s.title} — ${s.benefit}`).join('\n') || 'Não disponível'}

COMO RESPONDER:
Imagine que você está respondendo no WhatsApp. Texto corrido, curto, direto.

PROIBIDO:
- Formatação: nada de **, ##, listas com -, tópicos numerados, títulos. TEXTO PURO
- Palavras difíceis: nada de engajamento, retenção, conversão, frame, target, alcance orgânico
- Números exatos: nada de 62%, 47.3%. Diga "a maioria", "quase metade", "pouca gente"
- Textos longos: MÁXIMO 3 frases. Se não cabe em 3 frases, resuma mais

OBRIGATÓRIO:
- Fale como amigo. "Olha, o principal é..." / "Tenta fazer assim..." / "O que achei é que..."
- Se a pessoa disser "me explique melhor": resuma em 2 frases o que ela precisa mudar no post, sem repetir o que já disse. Pergunte o que especificamente ela quer entender melhor
- Foque SEMPRE no que a pessoa precisa FAZER para melhorar o post dela
- Use palavras simples: interação, atenção, formato, pessoas, resultado`;

  const conversationHistory = (messages || [])
    .filter((m: any) => m.role && m.content)
    .map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Add new question
  conversationHistory.push({ role: 'user' as const, content: question });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: conversationHistory,
    });

    let answer = response.content[0].type === 'text' ? response.content[0].text : '';

    // Strip any markdown formatting the model might still use
    answer = answer
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#{1,6}\s/gm, '')
      .replace(/^[-•]\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      .trim();

    return Response.json({ answer });
  } catch (err) {
    console.error('[Arena Chat] Error:', err);
    return Response.json({ error: 'Falha ao processar pergunta' }, { status: 500 });
  }
}
