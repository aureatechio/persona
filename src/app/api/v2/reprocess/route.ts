import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id : null;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { data: selfie, error: fetchError } = await supabaseAdmin
      .from('v2_video_selfies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('v2 reprocess fetch error:', fetchError);
      return NextResponse.json({ error: 'Falha ao buscar selfie' }, { status: 500 });
    }
    if (!selfie) {
      return NextResponse.json({ error: 'Selfie não encontrada' }, { status: 404 });
    }

    let nextStatus: string;
    if (selfie.final_video_path) {
      nextStatus = 'sending';
    } else if (selfie.lipsync_video_url) {
      nextStatus = 'composing';
    } else if (selfie.tts_audio_path) {
      nextStatus = 'generating_lipsync';
    } else if (selfie.generated_text) {
      nextStatus = 'generating_tts';
    } else if (selfie.transcription) {
      nextStatus = 'generating_text';
    } else {
      nextStatus = 'queued';
    }

    const updates: Record<string, unknown> = {
      status: nextStatus,
      error_message: null,
      locked_by: null,
      locked_at: null,
      retry_count: 0,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'generating_lipsync') {
      updates.lipsync_video_url = null;
    }

    if (nextStatus === 'sending') {
      updates.whatsapp_sent = false;
      updates.whatsapp_sent_at = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('v2_video_selfies')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('v2 reprocess update error:', updateError);
      return NextResponse.json({ error: 'Falha ao atualizar selfie' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id, next_status: nextStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('v2 reprocess error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
