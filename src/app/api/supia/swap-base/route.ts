import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegStatic from 'ffmpeg-static';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const execFileP = promisify(execFile);
const FFMPEG: string = (ffmpegStatic as unknown as string) || 'ffmpeg';

// Detect the end of the leading silence period. Returns 0 if the video already
// starts with audio above the threshold.
async function detectLeadingSilenceEnd(inputPath: string): Promise<number> {
  try {
    const { stderr } = await execFileP(FFMPEG, [
      '-hide_banner',
      '-i', inputPath,
      '-af', 'silencedetect=noise=-30dB:duration=0.2',
      '-f', 'null',
      '-',
    ]);

    // Parse first silence_end where the matching silence_start was at/near 0.
    // Format: "silencedetect ... silence_start: 0\n... silence_end: 1.234"
    const startMatch = stderr.match(/silence_start:\s*([0-9.]+)/);
    const endMatch = stderr.match(/silence_end:\s*([0-9.]+)/);

    if (!startMatch || !endMatch) return 0;
    const start = parseFloat(startMatch[1]);
    const end = parseFloat(endMatch[1]);

    // Only trim leading silence (silence_start was at the very beginning).
    if (start > 0.1) return 0;
    // Cap to 5s — anything beyond that is probably wrong detection or unusual content.
    return Math.min(end, 5);
  } catch (e) {
    // execFile rejects on stderr non-empty for some ffmpeg builds; fall back to
    // checking if rejection contains the silence info.
    const stderr = (e as { stderr?: string })?.stderr ?? '';
    const startMatch = stderr.match(/silence_start:\s*([0-9.]+)/);
    const endMatch = stderr.match(/silence_end:\s*([0-9.]+)/);
    if (!startMatch || !endMatch) return 0;
    const start = parseFloat(startMatch[1]);
    const end = parseFloat(endMatch[1]);
    if (start > 0.1) return 0;
    return Math.min(end, 5);
  }
}

// Trim from a given offset, re-encoding so we always start on a keyframe.
async function trimFromOffset(inputPath: string, outputPath: string, offsetSec: number) {
  await execFileP(FFMPEG, [
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', offsetSec.toFixed(3),
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ]);
}

export async function POST(request: NextRequest) {
  let workdir: string | null = null;
  try {
    const body = await request.json();
    const tempPath = (body.tempPath as string) || '';
    const autoTrim = body.autoTrim !== false; // default true

    if (!tempPath || !tempPath.startsWith('supia/_pending/')) {
      return NextResponse.json({ error: 'tempPath inválido' }, { status: 400 });
    }

    workdir = await mkdtemp(join(tmpdir(), 'supia-base-'));
    const inputPath = join(workdir, 'in.mp4');
    const outputPath = join(workdir, 'out.mp4');

    // Download the pending upload from Storage
    const { data: blob, error: dlError } = await supabaseAdmin.storage
      .from('voice-models')
      .download(tempPath);

    if (dlError || !blob) {
      console.error('swap-base download error:', dlError);
      return NextResponse.json({ error: 'Falha ao baixar upload' }, { status: 500 });
    }

    const inputBytes = Buffer.from(await blob.arrayBuffer());
    await writeFile(inputPath, inputBytes);

    let trimmedSec = 0;
    if (autoTrim) {
      trimmedSec = await detectLeadingSilenceEnd(inputPath);
    }

    let finalBytes: Buffer;
    if (trimmedSec > 0.15) {
      await trimFromOffset(inputPath, outputPath, trimmedSec);
      finalBytes = await readFile(outputPath);
    } else {
      // No meaningful leading silence — keep the original bytes
      finalBytes = inputBytes;
    }

    // Replace the production base
    const { error: upError } = await supabaseAdmin.storage
      .from('voice-models')
      .upload('supia/base.mp4', finalBytes, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (upError) {
      console.error('swap-base upload error:', upError);
      return NextResponse.json({ error: 'Falha ao publicar novo base.mp4' }, { status: 500 });
    }

    // Best-effort cleanup of the temp file
    await supabaseAdmin.storage.from('voice-models').remove([tempPath]).catch(() => {});

    return NextResponse.json({
      ok: true,
      trimmedSeconds: Number(trimmedSec.toFixed(3)),
      finalSize: finalBytes.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('supia/swap-base error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (workdir) {
      await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
