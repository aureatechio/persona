import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Normaliza vídeo para MP4 com mínimo 720px de largura (requisito Kling AI: 512-2160px)
async function normalizeVideo(inputBuffer: Buffer, inputExt: string): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const id = Date.now();
  const inputPath = join(tmpdir(), `base_input_${id}.${inputExt}`);
  const outputPath = join(tmpdir(), `base_output_${id}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
      '-vf', "scale='max(720,iw):-2'",
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-y', outputPath,
    ], { timeout: 120000 });

    const mp4Buffer = await readFile(outputPath);
    return { buffer: mp4Buffer, contentType: 'video/mp4', ext: 'mp4' };
  } catch {
    return { buffer: inputBuffer, contentType: `video/${inputExt}`, ext: inputExt };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

// Upload vídeo base ao Supabase Storage (rota separada para evitar limite de body size)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || 'Modelo';

    if (!file) {
      return NextResponse.json({ error: 'file é obrigatório' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const inputExt = (file.type === 'video/mp4' || file.name?.endsWith('.mp4')) ? 'mp4' : 'webm';

    // Always normalize: convert to MP4 + ensure min 720px width (Kling AI requires 512-2160px)
    const { buffer: videoBuffer, contentType: videoContentType, ext: videoExt } = await normalizeVideo(fileBuffer, inputExt);

    const videoPath = `base-models/${Date.now()}_${name.replace(/\s+/g, '_')}.${videoExt}`;

    const { error: uploadError } = await supabaseAdmin
      .storage.from('voice-models')
      .upload(videoPath, videoBuffer, {
        contentType: videoContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Falha no upload do vídeo' }, { status: 500 });
    }

    return NextResponse.json({ videoPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('video-modelo/upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
