import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120;

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BASE_MODEL_SLUG = 'mariadocarmo';

/**
 * Resolve o voice_id da Maria do Carmo a partir do base model ativo.
 * base model (slug) -> voice_model_id -> voice_models.elevenlabs_voice_id
 */
async function resolveVoice(): Promise<{ voiceId: string; voiceName: string } | null> {
  if (!supabaseUrl || !supabaseKey) return null;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: base } = await supabase
    .from('video_base_models')
    .select('voice_model_id, display_name')
    .eq('slug', BASE_MODEL_SLUG)
    .single();
  if (!base?.voice_model_id) return null;

  const { data: vm } = await supabase
    .from('voice_models')
    .select('elevenlabs_voice_id, name')
    .eq('id', base.voice_model_id)
    .single();
  if (!vm?.elevenlabs_voice_id) return null;

  return { voiceId: vm.elevenlabs_voice_id, voiceName: base.display_name || vm.name };
}

export async function GET() {
  const v = await resolveVoice();
  if (!v) return NextResponse.json({ error: 'Voz não encontrada' }, { status: 404 });
  return NextResponse.json(v);
}

export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurado' }, { status: 500 });
    }

    const body = await request.json();
    const {
      text,
      model_id = 'eleven_v3',
      stability = 0.6,
      similarity_boost = 0.75,
      style = 0.35,
      speed = 0.88,
      use_speaker_boost = false,
    } = body as {
      text: string;
      model_id?: string;
      stability?: number;
      similarity_boost?: number;
      style?: number;
      speed?: number;
      use_speaker_boost?: boolean;
    };

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'text é obrigatório' }, { status: 400 });
    }

    const resolved = await resolveVoice();
    if (!resolved) {
      return NextResponse.json({ error: 'Voz da Maria do Carmo não encontrada no banco' }, { status: 404 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolved.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id,
          language_code: 'pt',
          apply_text_normalization: 'auto',
          voice_settings: {
            stability,
            similarity_boost,
            style,
            speed,
            use_speaker_boost,
          },
        }),
        signal: AbortSignal.timeout(110000),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[voz-teste] ElevenLabs error:', res.status, errorText.slice(0, 400));
      return NextResponse.json(
        { error: `ElevenLabs API error: ${res.status}`, detail: errorText.slice(0, 400) },
        { status: res.status },
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'X-Voice-Id': resolved.voiceId,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[voz-teste] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
