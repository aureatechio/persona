import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// Default voice: "Waldemar" — Brazilian male, tom humano e expressivo
const DEFAULT_VOICE_ID = 'DVdr1unwF4OS3bcbxy9C';

export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurado' }, { status: 500 });
    }

    const body = await request.json();
    const { text, voice_id } = body as { text: string; voice_id?: string };

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'text é obrigatório' }, { status: 400 });
    }

    const voiceId = voice_id || DEFAULT_VOICE_ID;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.15,
            similarity_boost: 0.9,
            style: 1.0,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error('ElevenLabs error:', res.status, errorText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${res.status}` },
        { status: res.status },
      );
    }

    const audioBuffer = await res.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('tts/elevenlabs error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
