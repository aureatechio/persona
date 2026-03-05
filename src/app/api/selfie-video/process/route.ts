import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function tryConvertToMp4(inputBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const id = Date.now();
  const inputPath = join(tmpdir(), `selfie_input_${id}.webm`);
  const outputPath = join(tmpdir(), `selfie_output_${id}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-y', outputPath,
    ], { timeout: 120000 });

    const mp4Buffer = await readFile(outputPath);
    return { buffer: mp4Buffer, contentType: 'video/mp4', ext: 'mp4' };
  } catch {
    return { buffer: inputBuffer, contentType: 'video/webm', ext: 'webm' };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = (formData.get('name') as string) || '';
    const phone = (formData.get('phone') as string) || '';

    if (!file || !name || !phone) {
      return NextResponse.json({ error: 'file, name e phone são obrigatórios' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const isAlreadyMp4 = file.type === 'video/mp4' || file.name?.endsWith('.mp4');

    let videoBuffer: Buffer;
    let videoContentType: string;
    let videoExt: string;

    if (isAlreadyMp4) {
      videoBuffer = fileBuffer;
      videoContentType = 'video/mp4';
      videoExt = 'mp4';
    } else {
      const result = await tryConvertToMp4(fileBuffer);
      videoBuffer = result.buffer;
      videoContentType = result.contentType;
      videoExt = result.ext;
    }

    // 1. Create DB record
    const { data: record, error: dbError } = await supabaseAdmin
      .from('video_selfies')
      .insert({
        name,
        phone: phone.replace(/\D/g, ''),
        status: 'queued',
      })
      .select()
      .single();

    if (dbError || !record) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Falha ao criar registro' }, { status: 500 });
    }

    // 2. Upload selfie video to Supabase Storage
    const videoPath = `selfies/${record.id}.${videoExt}`;
    const { error: uploadError } = await supabaseAdmin
      .storage.from('voice-models')
      .upload(videoPath, videoBuffer, {
        contentType: videoContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      await supabaseAdmin.from('video_selfies').update({ status: 'failed', error_message: 'Upload failed' }).eq('id', record.id);
      return NextResponse.json({ error: 'Falha no upload do vídeo' }, { status: 500 });
    }

    // 3. Update record with video path
    await supabaseAdmin
      .from('video_selfies')
      .update({ selfie_video_path: videoPath, updated_at: new Date().toISOString() })
      .eq('id', record.id);

    // 4. Worker Python picks up 'queued' items automatically
    return NextResponse.json({ id: record.id, status: 'queued' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('selfie-video/process error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
