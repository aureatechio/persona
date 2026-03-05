import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { submitLipsyncJob, getLipsyncProvider } from '@/lib/lipsync';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

async function updateStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  await supabaseAdmin
    .from('video_selfies')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', id);
}

export async function POST(request: NextRequest) {
  let selfie_id = '';

  try {
    const body = await request.json();
    selfie_id = body.selfie_id;

    if (!selfie_id) {
      return NextResponse.json({ error: 'selfie_id é obrigatório' }, { status: 400 });
    }

    if (!OPENAI_API_KEY || !ELEVENLABS_API_KEY) {
      await updateStatus(selfie_id, 'failed', { error_message: 'API keys não configuradas' });
      return NextResponse.json({ error: 'API keys não configuradas' }, { status: 500 });
    }

    // Fetch selfie record
    const { data: selfie } = await supabaseAdmin
      .from('video_selfies')
      .select('*')
      .eq('id', selfie_id)
      .single();

    if (!selfie) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    // Fetch active base model
    const { data: baseModel } = await supabaseAdmin
      .from('video_base_models')
      .select('*, voice_models(*)')
      .eq('is_active', true)
      .single();

    if (!baseModel) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Nenhum modelo base ativo' });
      return NextResponse.json({ error: 'Nenhum modelo base ativo' }, { status: 404 });
    }

    // ===== STEP 1: TRANSCRIPTION (OpenAI Whisper) =====
    await updateStatus(selfie_id, 'transcribing');

    const { data: videoData } = await supabaseAdmin
      .storage.from('voice-models')
      .download(selfie.selfie_video_path);

    if (!videoData) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Falha ao baixar vídeo' });
      return NextResponse.json({ error: 'Falha ao baixar vídeo' }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await videoData.arrayBuffer());
    const ext = selfie.selfie_video_path.endsWith('.webm') ? 'webm' : 'mp4';
    const whisperForm = new FormData();
    whisperForm.append('file', new Blob([videoBuffer], { type: `video/${ext}` }), `selfie.${ext}`);
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'pt');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('Whisper error:', whisperRes.status, errText);
      await updateStatus(selfie_id, 'failed', { error_message: `Whisper failed: ${whisperRes.status}` });
      return NextResponse.json({ error: 'Falha na transcrição' }, { status: 500 });
    }

    const whisperData = await whisperRes.json();
    const transcription = whisperData.text;

    await updateStatus(selfie_id, 'generating_text', { transcription });

    // ===== STEP 2: GENERATE TEXT (GPT-4) =====
    const promptTemplate = baseModel.prompt_template || '';
    const systemPrompt = promptTemplate
      .replace(/{nome}/g, selfie.name)
      .replace(/{transcricao}/g, transcription);

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Nome: ${selfie.name}\nDepoimento: "${transcription}"` },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!gptRes.ok) {
      const errText = await gptRes.text();
      console.error('GPT error:', gptRes.status, errText);
      await updateStatus(selfie_id, 'failed', { error_message: `GPT failed: ${gptRes.status}` });
      return NextResponse.json({ error: 'Falha ao gerar texto' }, { status: 500 });
    }

    const gptData = await gptRes.json();
    const generatedText = gptData.choices[0]?.message?.content || '';

    await updateStatus(selfie_id, 'generating_tts', { generated_text: generatedText });

    // ===== STEP 3: TTS (ElevenLabs) =====
    const voiceModel = baseModel.voice_models;
    if (!voiceModel?.elevenlabs_voice_id) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Modelo de voz sem voice_id' });
      return NextResponse.json({ error: 'Modelo de voz não configurado' }, { status: 500 });
    }

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceModel.elevenlabs_voice_id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: generatedText.trim(),
          model_id: 'eleven_v3',
          language_code: 'pt',
          apply_text_normalization: 'auto',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.5,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error('TTS error:', ttsRes.status, errText);
      await updateStatus(selfie_id, 'failed', { error_message: `TTS failed: ${ttsRes.status}` });
      return NextResponse.json({ error: 'Falha ao gerar áudio TTS' }, { status: 500 });
    }

    const rawAudioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    // Apply outdoor environment effect: reverb + subtle wind noise
    let audioBuffer = rawAudioBuffer;
    try {
      const ts = Date.now();
      const rawPath = join(tmpdir(), `tts_raw_${ts}.mp3`);
      const outPath = join(tmpdir(), `tts_outdoor_${ts}.mp3`);
      await writeFile(rawPath, rawAudioBuffer);

      // Reverb (aecho) + pink noise low-passed to simulate traffic hum
      await execFileAsync('ffmpeg', [
        '-i', rawPath,
        '-filter_complex',
        '[0:a]aecho=0.8:0.7:60|80:0.15|0.1[reverbed];' +
        'anoisesrc=c=pink:a=0.006[noise];' +
        '[noise]lowpass=f=900[traffic];' +
        '[reverbed][traffic]amix=inputs=2:duration=first:weights=1 0.08[out]',
        '-map', '[out]',
        '-c:a', 'libmp3lame', '-b:a', '192k',
        '-y', outPath,
      ], { timeout: 30000 });

      audioBuffer = await readFile(outPath);
      await unlink(rawPath).catch(() => {});
      await unlink(outPath).catch(() => {});
      console.log('[pipeline] Outdoor audio effect applied');
    } catch (audioFxErr) {
      console.warn('[pipeline] Audio FX failed, using raw TTS:', audioFxErr);
      // Fallback: use raw audio without effects
    }

    const ttsPath = `tts/selfie_${selfie_id}.mp3`;

    await supabaseAdmin.storage.from('voice-models').upload(ttsPath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

    await updateStatus(selfie_id, 'generating_lipsync', { tts_audio_path: ttsPath });

    // ===== STEP 4: LIP-SYNC (via lib/lipsync — Kling AI ou Sync Labs) =====
    const { data: videoSignedUrl, error: videoSignErr } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUrl(baseModel.video_storage_path, 3600);

    const { data: audioSignedUrl, error: audioSignErr } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUrl(ttsPath, 3600);

    if (videoSignErr || audioSignErr || !videoSignedUrl?.signedUrl || !audioSignedUrl?.signedUrl) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Falha ao gerar URLs assinadas' });
      return NextResponse.json({ error: 'Falha ao gerar URLs assinadas' }, { status: 500 });
    }

    console.log(`[pipeline] Lipsync provider: ${getLipsyncProvider()}`);

    const { jobId } = await submitLipsyncJob(videoSignedUrl.signedUrl, audioSignedUrl.signedUrl);

    await updateStatus(selfie_id, 'generating_lipsync', { lipsync_job_id: jobId });

    return NextResponse.json({
      id: selfie_id,
      status: 'generating_lipsync',
      lipsync_job_id: jobId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('selfie-video/pipeline error:', msg);
    if (selfie_id) {
      await updateStatus(selfie_id, 'failed', { error_message: msg }).catch(() => {});
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
