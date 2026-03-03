import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY nao configurado' }, { status: 500 });
    }

    const { phrase } = (await request.json()) as {
      phrase: string;
    };

    if (!phrase) {
      return NextResponse.json({ error: 'phrase e obrigatorio' }, { status: 400 });
    }

    // Read campaign template from public/
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'campanha-base.jpg');
    const templateBuffer = fs.readFileSync(templatePath);
    const templateBase64 = templateBuffer.toString('base64');

    // Build Gemini request — ONLY template image + text overlay prompt
    const parts: Array<Record<string, unknown>> = [
      {
        inlineData: { mimeType: 'image/jpeg', data: templateBase64 },
      },
      {
        text: `Edite SOMENTE o topo desta imagem adicionando o seguinte texto. NAO modifique NADA na imagem original — nao mude cores, pessoas, fundo, logos, nomes, numeros, nada. A imagem deve permanecer 100% identica, apenas com o texto adicionado.

TEXTO PARA ADICIONAR NO TOPO:
"${phrase}"

REGRAS RIGIDAS:
- Adicione o texto na area SUPERIOR da imagem (acima da pessoa), onde ha espaco livre no fundo verde/azul.
- Use fonte branca, limpa, legivel, com leve sombra preta para contraste.
- Tamanho do texto proporcional — nem muito grande nem muito pequeno. Deve caber bem no topo.
- NAO altere NENHUM pixel da imagem original fora da area do texto.
- NAO mude o rosto, corpo, roupas, fundo, cores, brilhos, logos, nome, numero ou qualquer outro elemento.
- O resultado deve ser a MESMA imagem exata, so com o texto escrito em cima na parte superior.`,
      },
    ];

    // Call Gemini image generation API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
        signal: AbortSignal.timeout(60000),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return NextResponse.json(
        { error: `Gemini API retornou ${geminiRes.status}` },
        { status: 502 },
      );
    }

    const geminiData = await geminiRes.json();

    // Extract generated image from response
    const candidates = geminiData.candidates || [];
    const contentParts = candidates[0]?.content?.parts || [];

    const imagePart = contentParts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.data,
    );

    if (imagePart?.inlineData) {
      const { mimeType, data } = imagePart.inlineData;
      return NextResponse.json({
        image: `data:${mimeType};base64,${data}`,
      });
    }

    // No image returned
    const textPart = contentParts.find(
      (p: { text?: string }) => p.text,
    );

    console.error('Gemini did not return an image. Response:', JSON.stringify(geminiData).slice(0, 500));

    return NextResponse.json(
      { error: textPart?.text || 'Gemini nao gerou uma imagem' },
      { status: 502 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('generate-card error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
