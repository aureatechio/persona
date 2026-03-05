import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

async function tryConvertToMp4(inputBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  // Tenta converter WebM → MP4 via ffmpeg do sistema
  const id = Date.now();
  const inputPath = join(tmpdir(), `voice_input_${id}.webm`);
  const outputPath = join(tmpdir(), `voice_output_${id}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-y', outputPath,
    ], { timeout: 120000 });

    const mp4Buffer = await readFile(outputPath);
    console.log('[clone] FFmpeg conversion OK, MP4 size:', mp4Buffer.length);
    return { buffer: mp4Buffer, contentType: 'video/mp4', ext: 'mp4' };
  } catch {
    console.log('[clone] FFmpeg not available, using original file');
    return { buffer: inputBuffer, contentType: 'video/webm', ext: 'webm' };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurado' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = (formData.get('name') as string) || 'Meu Modelo';

    if (!file) {
      return NextResponse.json({ error: 'Arquivo de vídeo é obrigatório' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const isAlreadyMp4 = file.type === 'video/mp4' || file.name?.endsWith('.mp4');

    // 1. Prepara o vídeo para Sync Labs (precisa de MP4)
    let videoBuffer: Buffer;
    let videoContentType: string;
    let videoExt: string;

    if (isAlreadyMp4) {
      // Browser gravou como MP4 (Safari, Chrome recente)
      videoBuffer = fileBuffer;
      videoContentType = 'video/mp4';
      videoExt = 'mp4';
      console.log('[clone] File already MP4, size:', fileBuffer.length);
    } else {
      // Browser gravou como WebM — tenta converter
      const result = await tryConvertToMp4(fileBuffer);
      videoBuffer = result.buffer;
      videoContentType = result.contentType;
      videoExt = result.ext;
    }

    // 2. Upload video to Supabase Storage
    const videoPath = `recordings/${Date.now()}_${name.replace(/\s+/g, '_')}.${videoExt}`;

    const { error: uploadError } = await supabaseAdmin
      .storage.from('voice-models')
      .upload(videoPath, videoBuffer, {
        contentType: videoContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Falha ao fazer upload do vídeo' }, { status: 500 });
    }

    // 3. Create DB record
    const { data: model, error: dbError } = await supabaseAdmin
      .from('voice_models')
      .insert({
        status: 'processing',
        video_storage_path: videoPath,
        name,
      })
      .select()
      .single();

    if (dbError || !model) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Falha ao criar registro do modelo' }, { status: 500 });
    }

    // 4. Send to ElevenLabs for Instant Voice Cloning
    const elForm = new FormData();
    elForm.append('name', `SyntheticPerson_${name}_${model.id.slice(0, 8)}`);
    elForm.append('files', new Blob([fileBuffer], { type: file.type || 'video/webm' }), `recording.${videoExt}`);
    elForm.append('remove_background_noise', 'true');
    elForm.append('labels', JSON.stringify({ language: 'pt-BR' }));

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body: elForm,
    });

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error('ElevenLabs clone error:', elRes.status, errText);
      await supabaseAdmin.from('voice_models').update({ status: 'deleted' }).eq('id', model.id);
      return NextResponse.json({ error: `Falha ao clonar voz: ${elRes.status}` }, { status: 500 });
    }

    const elData = await elRes.json();

    // 5. Update DB record
    await supabaseAdmin
      .from('voice_models')
      .update({
        elevenlabs_voice_id: elData.voice_id,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', model.id);

    return NextResponse.json({
      model: {
        id: model.id,
        elevenlabs_voice_id: elData.voice_id,
        status: 'ready',
        name,
        video_storage_path: videoPath,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('voice-model/clone error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
