import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const maxDuration = 120;

async function updateStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  await supabaseAdmin
    .from('video_selfies')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', id);
}

export async function POST(request: NextRequest) {
  let selfie_id = '';
  const tmpFiles: string[] = [];

  try {
    const body = await request.json();
    selfie_id = body.selfie_id;

    if (!selfie_id) {
      return NextResponse.json({ error: 'selfie_id é obrigatório' }, { status: 400 });
    }

    const { data: record } = await supabaseAdmin
      .from('video_selfies')
      .select('*')
      .eq('id', selfie_id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    await updateStatus(selfie_id, 'composing');

    // 1. Download selfie video from Supabase Storage
    const { data: selfieData } = await supabaseAdmin
      .storage.from('voice-models')
      .download(record.selfie_video_path);

    if (!selfieData) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Falha ao baixar selfie' });
      return NextResponse.json({ error: 'Falha ao baixar selfie' }, { status: 500 });
    }

    // 2. Download lipsync video from Sync Labs URL
    const lipsyncUrl = record.lipsync_video_url;
    if (!lipsyncUrl) {
      await updateStatus(selfie_id, 'failed', { error_message: 'URL do lip-sync não disponível' });
      return NextResponse.json({ error: 'URL do lip-sync não disponível' }, { status: 500 });
    }

    const lipsyncRes = await fetch(lipsyncUrl);
    if (!lipsyncRes.ok) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Falha ao baixar vídeo lip-sync' });
      return NextResponse.json({ error: 'Falha ao baixar vídeo lip-sync' }, { status: 500 });
    }

    // 3. Write both videos to temp files
    const ts = Date.now();
    const selfieExt = record.selfie_video_path.endsWith('.webm') ? 'webm' : 'mp4';
    const selfiePath = join(tmpdir(), `selfie_${ts}.${selfieExt}`);
    const lipsyncPath = join(tmpdir(), `lipsync_${ts}.mp4`);
    const outputPath = join(tmpdir(), `final_${ts}.mp4`);
    const listPath = join(tmpdir(), `concat_${ts}.txt`);

    tmpFiles.push(selfiePath, lipsyncPath, outputPath, listPath);

    const selfieBuffer = Buffer.from(await selfieData.arrayBuffer());
    const lipsyncBuffer = Buffer.from(await lipsyncRes.arrayBuffer());

    await writeFile(selfiePath, selfieBuffer);
    await writeFile(lipsyncBuffer.length > 0 ? lipsyncPath : lipsyncPath, lipsyncBuffer);

    // 4. Re-encode both to same format, then concatenate with FFmpeg
    // First, normalize both videos to same codec/resolution
    const selfieNorm = join(tmpdir(), `selfie_norm_${ts}.mp4`);
    const lipsyncNorm = join(tmpdir(), `lipsync_norm_${ts}.mp4`);
    tmpFiles.push(selfieNorm, lipsyncNorm);

    // Normalize selfie (force 30fps + same timescale for clean concat)
    await execFileAsync('ffmpeg', [
      '-i', selfiePath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-r', '30', '-video_track_timescale', '15360',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2',
      '-movflags', '+faststart', '-y', selfieNorm,
    ], { timeout: 120000 });

    // Normalize lipsync (force 30fps + same timescale for clean concat)
    await execFileAsync('ffmpeg', [
      '-i', lipsyncPath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-r', '30', '-video_track_timescale', '15360',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2',
      '-movflags', '+faststart', '-y', lipsyncNorm,
    ], { timeout: 120000 });

    // 5. Concatenate using concat demuxer
    await writeFile(listPath, `file '${selfieNorm}'\nfile '${lipsyncNorm}'\n`);

    await execFileAsync('ffmpeg', [
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-c', 'copy', '-movflags', '+faststart',
      '-y', outputPath,
    ], { timeout: 120000 });

    // 6. Upload final video to Supabase Storage
    const finalBuffer = await readFile(outputPath);
    const finalPath = `final/${selfie_id}.mp4`;

    await supabaseAdmin.storage.from('voice-models').upload(finalPath, finalBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

    await updateStatus(selfie_id, 'sending', { final_video_path: finalPath });

    // 7. Trigger WhatsApp send
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/selfie-video/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selfie_id }),
    }).catch(err => console.error('WhatsApp trigger error:', err));

    return NextResponse.json({ status: 'sending' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('selfie-video/compose error:', msg);
    if (selfie_id) {
      await updateStatus(selfie_id, 'failed', { error_message: msg }).catch(() => {});
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // Cleanup temp files
    for (const f of tmpFiles) {
      await unlink(f).catch(() => {});
    }
  }
}
