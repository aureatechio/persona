import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { submitLipsyncJob } from '@/lib/lipsync';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'API keys não configuradas' }, { status: 500 });
    }

    const { voice_model_id, username, phrase, phrase_hash } = await request.json();

    if (!voice_model_id || !username || !phrase || !phrase_hash) {
      return NextResponse.json(
        { error: 'voice_model_id, username, phrase, phrase_hash são obrigatórios' },
        { status: 400 },
      );
    }

    // 1. Check cache
    const { data: existing } = await supabaseAdmin
      .from('lipsync_videos')
      .select('*')
      .eq('voice_model_id', voice_model_id)
      .eq('username', username)
      .eq('phrase_hash', phrase_hash)
      .single();

    if (existing?.status === 'completed' && existing.video_url) {
      return NextResponse.json({ lipsync: existing });
    }

    if (existing?.status === 'generating_lipsync' || existing?.status === 'generating_tts') {
      return NextResponse.json({ lipsync: existing });
    }

    // 2. Fetch voice model
    const { data: voiceModel } = await supabaseAdmin
      .from('voice_models')
      .select('*')
      .eq('id', voice_model_id)
      .single();

    if (!voiceModel || !voiceModel.elevenlabs_voice_id) {
      return NextResponse.json({ error: 'Modelo de voz não encontrado' }, { status: 404 });
    }

    // 3. Create/update lipsync record
    let lipsyncRecord = existing;
    if (!lipsyncRecord) {
      const { data: created } = await supabaseAdmin
        .from('lipsync_videos')
        .insert({
          voice_model_id,
          username,
          phrase_hash,
          status: 'generating_tts',
        })
        .select()
        .single();
      lipsyncRecord = created;
    } else {
      await supabaseAdmin
        .from('lipsync_videos')
        .update({ status: 'generating_tts', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }

    // 4. Generate TTS with cloned voice
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceModel.elevenlabs_voice_id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: phrase.trim(),
          model_id: 'eleven_v3',
          language_code: 'pt',
          apply_text_normalization: 'auto',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 1.0,
            style: 0.3,
            use_speaker_boost: true,
            speed: 0.95,
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error('TTS error:', ttsRes.status, errText);

      await supabaseAdmin
        .from('lipsync_videos')
        .update({ status: 'failed', error_message: `TTS failed: ${ttsRes.status}` })
        .eq('id', lipsyncRecord!.id);

      return NextResponse.json({ error: 'Falha ao gerar áudio TTS' }, { status: 500 });
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    // 5. Upload TTS audio to Supabase Storage
    const ttsPath = `tts/${voice_model_id}/${username}_${phrase_hash}.mp3`;
    await supabaseAdmin.storage.from('voice-models').upload(ttsPath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

    // 6. Get signed URLs (1h) — bucket may not be public
    const { data: videoSignedUrl } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUrl(voiceModel.video_storage_path, 3600);

    const { data: audioSignedUrl } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUrl(ttsPath, 3600);

    const videoPublicUrl = videoSignedUrl?.signedUrl || '';
    const audioPublicUrl = audioSignedUrl?.signedUrl || '';

    // 7. Update status
    await supabaseAdmin
      .from('lipsync_videos')
      .update({
        status: 'generating_lipsync',
        tts_audio_path: ttsPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lipsyncRecord!.id);

    // 8. Submit to lip-sync provider (Kling AI or Sync Labs)
    const { jobId } = await submitLipsyncJob(videoPublicUrl, audioPublicUrl);

    // 9. Save job ID
    await supabaseAdmin
      .from('lipsync_videos')
      .update({
        sync_job_id: jobId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lipsyncRecord!.id);

    return NextResponse.json({
      lipsync: {
        id: lipsyncRecord!.id,
        sync_job_id: jobId,
        status: 'generating_lipsync',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('voice-model/generate-video error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
