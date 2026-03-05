import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const SYNC_API_KEY = process.env.SYNC_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY || !SYNC_API_KEY) {
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

    // 6. Get public URLs
    const { data: videoUrlData } = supabaseAdmin
      .storage.from('voice-models')
      .getPublicUrl(voiceModel.video_storage_path);

    const { data: audioUrlData } = supabaseAdmin
      .storage.from('voice-models')
      .getPublicUrl(ttsPath);

    const videoPublicUrl = videoUrlData.publicUrl;
    const audioPublicUrl = audioUrlData.publicUrl;

    // 7. Update status
    await supabaseAdmin
      .from('lipsync_videos')
      .update({
        status: 'generating_lipsync',
        tts_audio_path: ttsPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lipsyncRecord!.id);

    // 8. Submit to Sync Labs
    const syncRes = await fetch('https://api.sync.so/v2/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SYNC_API_KEY,
      },
      body: JSON.stringify({
        model: 'lipsync-2-pro',
        input: [
          { type: 'video', url: videoPublicUrl },
          { type: 'audio', url: audioPublicUrl },
        ],
        options: {
          sync_mode: 'cut_off',
        },
      }),
    });

    if (!syncRes.ok) {
      const errText = await syncRes.text();
      console.error('Sync Labs error:', syncRes.status, errText);

      await supabaseAdmin
        .from('lipsync_videos')
        .update({ status: 'failed', error_message: `Sync Labs failed: ${syncRes.status} - ${errText}` })
        .eq('id', lipsyncRecord!.id);

      return NextResponse.json({ error: 'Falha ao submeter lip-sync' }, { status: 500 });
    }

    const syncData = await syncRes.json();

    // 9. Save sync job ID
    await supabaseAdmin
      .from('lipsync_videos')
      .update({
        sync_job_id: syncData.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lipsyncRecord!.id);

    return NextResponse.json({
      lipsync: {
        id: lipsyncRecord!.id,
        sync_job_id: syncData.id,
        status: 'generating_lipsync',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('voice-model/generate-video error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
