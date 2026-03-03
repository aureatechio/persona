import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// Default voice: "Rachel" — multilingual, works well with Portuguese
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY nao configurado' }, { status: 500 });
    }

    const body = await request.json();
    const { text, voice_id } = body as { text: string; voice_id?: string };

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'text e obrigatorio' }, { status: 400 });
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
            stability: 0.5,
            similarity_boost: 0.75,
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
