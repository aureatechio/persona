import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Default voice: "Enzo - Professional and Warm" — Young Brazilian male, tom caloroso e profissional
const DEFAULT_VOICE_ID = 'b95tap8KE0pQivmClQRQ';

/* ─── Pré-processa texto para fala mais humana e natural ─── */
function humanizeTextForSpeech(raw: string): string {
  let text = raw.trim();

  // Travessão (—) → vírgula + micro-pausa natural (ElevenLabs interpreta melhor)
  text = text.replace(/\s*—\s*/g, '... ');

  // Reticências excessivas → pausa natural de 3 pontos
  text = text.replace(/\.{4,}/g, '...');

  // Adiciona micro-pausa entre frases (ponto + espaço) para respiração natural
  text = text.replace(/([.!?])\s+/g, '$1 ... ');

  // Vírgula seguida de "conte comigo" → pausa mais longa para ênfase final
  text = text.replace(/,\s*(conte comigo)/gi, '... $1');

  // Remove múltiplos espaços
  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();
}

/* ─── Busca voice model clonado aprovado ─── */
async function getClonedVoiceId(): Promise<string | null> {
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from('voice_models')
      .select('elevenlabs_voice_id')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    return data?.elevenlabs_voice_id || null;
  } catch {
    return null;
  }
}

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

    // Prioridade: voice_id explícito > modelo clonado aprovado > default Enzo
    let voiceId = voice_id || null;
    if (!voiceId) {
      const clonedId = await getClonedVoiceId();
      voiceId = clonedId || DEFAULT_VOICE_ID;
    }

    // Pré-processa texto para soar mais natural na fala
    const processedText = humanizeTextForSpeech(text);

    // Usa modelo v3 (melhor qualidade) para voz clonada, multilingual_v2 para Enzo default
    const isClonedVoice = voiceId !== DEFAULT_VOICE_ID;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: processedText,
          model_id: isClonedVoice ? 'eleven_v3' : 'eleven_multilingual_v2',
          language_code: 'pt',
          apply_text_normalization: 'auto',
          voice_settings: isClonedVoice
            ? {
                stability: 0.6,
                similarity_boost: 1.0,
                style: 0.3,
                use_speaker_boost: true,
                speed: 0.95,
              }
            : {
                stability: 0.42,
                similarity_boost: 0.72,
                style: 0.48,
                use_speaker_boost: true,
              },
        }),
        signal: AbortSignal.timeout(60000),
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
