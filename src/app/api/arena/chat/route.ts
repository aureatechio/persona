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

  const systemPrompt = `Você é um estrategista de comunicação política de altíssimo nível. Você tem acesso aos seguintes dados de análise:

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

REGRAS ABSOLUTAS:
- Você é um amigo que entende de comunicação ajudando a pessoa a melhorar o post dela
- Responda em português brasileiro, como numa conversa de WhatsApp entre amigos
- MÁXIMO 2-3 frases curtas. NUNCA mais que isso
- NUNCA use formatação markdown (sem **, sem ##, sem listas com -, sem tópicos). Texto corrido simples
- NUNCA use palavras técnicas (engajamento→interação, frame→formato, target→público, conversão→resultado, retenção→atenção, alcance→pessoas que vão ver)
- NUNCA cite porcentagens exatas. Use palavras naturais ("a maioria", "quase metade", "pouca gente")
- Se a pessoa pedir "me explique melhor", faça um novo resumo curto e simples do que ela precisa fazer, sem repetir o que já disse
- Se a pessoa fizer uma pergunta vaga, responda de forma útil e pergunte algo específico pra ajudar melhor
- Tom: amigável, prático, direto. Como se estivesse falando pessoalmente com a pessoa`;

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

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';

    return Response.json({ answer });
  } catch (err) {
    console.error('[Arena Chat] Error:', err);
    return Response.json({ error: 'Falha ao processar pergunta' }, { status: 500 });
  }
}
