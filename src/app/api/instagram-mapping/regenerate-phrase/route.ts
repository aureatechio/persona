import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/* ─── Key rotation (same strategy as analyze-follower) ─── */

const ANTHROPIC_KEYS = [
  process.env.ANTHROPIC_API_KEY,
  process.env.ANTHROPIC_API_KEY_2,
  process.env.ANTHROPIC_API_KEY_3,
  process.env.ANTHROPIC_API_KEY_4,
].filter(Boolean) as string[];

let keyIndex = 0;
function getAnthropicClient() {
  const key = ANTHROPIC_KEYS[keyIndex % ANTHROPIC_KEYS.length];
  keyIndex++;
  return new Anthropic({ apiKey: key });
}

/* ─── POST Handler ─── */

export async function POST(request: NextRequest) {
  try {
    if (ANTHROPIC_KEYS.length === 0) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY nao configurado' }, { status: 500 });
    }

    const body = await request.json();
    const {
      customPrompt,
      displayName,
      resumo,
      fraseOriginal,
      profissao,
      grupo,
      temas,
    } = body as {
      customPrompt: string;
      displayName: string;
      resumo: string;
      fraseOriginal: string;
      profissao: string;
      grupo: string;
      temas: string[];
    };

    if (!customPrompt) {
      return NextResponse.json({ error: 'customPrompt e obrigatorio' }, { status: 400 });
    }

    const systemPrompt = `Você é um especialista em comunicação política e marketing personalizado brasileiro.
Você recebeu um COMANDO do usuário para gerar uma nova frase de comunicação personalizada para um seguidor de Instagram.

COMANDO DO USUÁRIO: ${customPrompt}

FRASE ORIGINAL (já gerada anteriormente): ${fraseOriginal || 'Nenhuma'}

Dados do seguidor:
- Nome: ${displayName || 'Desconhecido'}
- Resumo do perfil: ${resumo || 'Sem resumo'}
- Profissão: ${profissao || 'Indefinido'}
- Grupo: ${grupo || 'LIFESTYLE'}
- Temas de interesse: ${(temas || []).join(', ') || 'Nenhum'}

REGRAS:
- Gere APENAS a nova frase de comunicação (texto puro, sem aspas, sem JSON, sem explicações).
- Siga o COMANDO do usuário fielmente — ele determina o tom, conteúdo e direção da frase.
- Use a frase original e os dados do seguidor como base de contexto para personalizar.
- Use o PRIMEIRO NOME do seguidor na frase (extraído do campo Nome).
- Máximo 2-3 frases curtas.
- Use português do Brasil com acentuação PERFEITA (é, ê, á, ã, ç, ó, ô, í, ú).
- Seja criativo e varie a estrutura entre diferentes perfis.`;

    const client = getAnthropicClient();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Gere a frase agora.' }],
    });

    const responseText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    // Clean up: remove surrounding quotes if present
    const cleaned = responseText.replace(/^["']|["']$/g, '').trim();

    return NextResponse.json({ frase_comunicacao: cleaned });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('regenerate-phrase error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
