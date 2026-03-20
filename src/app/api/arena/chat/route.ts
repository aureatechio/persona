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

REGRAS:
- Responda em português brasileiro, tom direto e assertivo
- Base suas respostas EXCLUSIVAMENTE nos dados acima
- Seja conciso (máximo 3 parágrafos)
- Se a pergunta não tiver relação com os dados, responda brevemente e redirecione para os insights da análise
- Use números e porcentagens dos dados quando relevante
- Tom de CMO senior: prescritivo, acionável, sem rodeios`;

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
      max_tokens: 1000,
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
