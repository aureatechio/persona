import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Reprocessa uma selfie a partir do passo mais avançado possível, evitando
 * pagar OpenAI/ElevenLabs/Sync Labs de novo se os artefatos já existem.
 *
 * Estratégia:
 *   - tem final_video_path → status='sending'        (só re-envia WhatsApp)
 *   - tem lipsync_video_url → status='composing'     (pula lipsync)
 *   - tem tts_audio_path → status='generating_lipsync' (pula transcribe/GPT/TTS)
 *   - tem generated_text → status='generating_tts'   (pula transcribe/GPT)
 *   - tem transcription → status='generating_text'   (pula transcribe)
 *   - else → status='queued'                          (começa do zero)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id : null;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { data: selfie, error: fetchError } = await supabaseAdmin
      .from('video_selfies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('reprocess fetch error:', fetchError);
      return NextResponse.json({ error: 'Falha ao buscar selfie' }, { status: 500 });
    }
    if (!selfie) {
      return NextResponse.json({ error: 'Selfie não encontrada' }, { status: 404 });
    }

    // Decide o ponto de reentrada baseado nos artefatos existentes
    let nextStatus: string;
    let resumeFrom: string;

    if (selfie.final_video_path) {
      nextStatus = 'sending';
      resumeFrom = 'WhatsApp (vídeo já composto)';
    } else if (selfie.lipsync_video_url) {
      nextStatus = 'composing';
      resumeFrom = 'composição (lipsync já pronto)';
    } else if (selfie.tts_audio_path) {
      nextStatus = 'generating_lipsync';
      resumeFrom = 'lip-sync (TTS já pronto)';
    } else if (selfie.generated_text) {
      nextStatus = 'generating_tts';
      resumeFrom = 'TTS (texto já gerado)';
    } else if (selfie.transcription) {
      nextStatus = 'generating_text';
      resumeFrom = 'geração de texto (transcrição já pronta)';
    } else {
      nextStatus = 'queued';
      resumeFrom = 'início (do zero)';
    }

    // Limpa estado de retry/lock e o flag de WhatsApp para permitir reenvio.
    // kling_key_id/started_at zerados pra liberar slot do pool caso estivesse
    // ocupando.
    const updates: Record<string, unknown> = {
      status: nextStatus,
      error_message: null,
      locked_by: null,
      locked_at: null,
      retry_count: 0,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'generating_lipsync') {
      updates.kling_key_id = null;
      updates.kling_started_at = null;
      updates.lipsync_video_url = null;
    }

    if (nextStatus === 'sending') {
      // Reset WhatsApp claim para permitir reenvio
      updates.whatsapp_sent = false;
      updates.whatsapp_sent_at = null;
      updates.whatsapp_provider = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('video_selfies')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('reprocess update error:', updateError);
      return NextResponse.json({ error: 'Falha ao atualizar selfie' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id,
      next_status: nextStatus,
      resume_from: resumeFrom,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('reprocess error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
