import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

export const maxDuration = 120;

async function extractAudio(videoBuffer: Buffer, inputExt: string): Promise<Buffer> {
  const id = Date.now();
  const inputPath = join(tmpdir(), `extract_in_${id}.${inputExt}`);
  const outputPath = join(tmpdir(), `extract_out_${id}.mp3`);

  try {
    await writeFile(inputPath, videoBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vn', '-acodec', 'libmp3lame', '-b:a', '128k',
      '-y', outputPath,
    ], { timeout: 60000 });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

// GET — Retorna modelo base ativo
export async function GET() {
  try {
    const { data: model } = await supabaseAdmin
      .from('video_base_models')
      .select('*, voice_models(*)')
      .eq('is_active', true)
      .single();

    return NextResponse.json({ model: model || null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — Recebe videoPath (já uploadado via /upload) + clona voz + cria modelo
export async function POST(request: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurado' }, { status: 500 });
    }

    const body = await request.json();
    const { videoPath, name, prompt_template } = body;

    if (!videoPath || !prompt_template) {
      return NextResponse.json({ error: 'videoPath e prompt_template são obrigatórios' }, { status: 400 });
    }

    // 1. Download vídeo do Storage para enviar ao ElevenLabs
    const { data: videoData, error: dlError } = await supabaseAdmin
      .storage.from('voice-models')
      .download(videoPath);

    if (dlError || !videoData) {
      console.error('Download error:', dlError);
      return NextResponse.json({ error: 'Falha ao baixar vídeo do storage' }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await videoData.arrayBuffer());
    const ext = videoPath.endsWith('.webm') ? 'webm' : 'mp4';

    // 2. Extrair áudio do vídeo (ElevenLabs tem limite de 11MB)
    let audioBuffer: Buffer;
    try {
      audioBuffer = await extractAudio(videoBuffer, ext);
      console.log('[video-modelo] Audio extracted, size:', audioBuffer.length);
    } catch (err) {
      console.error('FFmpeg audio extract error:', err);
      // Fallback: enviar vídeo original se FFmpeg não disponível
      audioBuffer = videoBuffer;
    }

    // 3. Clonar voz a partir do áudio (ElevenLabs Instant Voice Clone)
    const elForm = new FormData();
    elForm.append('name', `VideoBase_${name || 'Modelo'}_${Date.now()}`);
    elForm.append('files', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' }), 'audio.mp3');
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
      return NextResponse.json({ error: `Falha ao clonar voz: ${elRes.status}` }, { status: 500 });
    }

    const elData = await elRes.json();

    // 3. Criar registro em voice_models
    const { data: voiceModel, error: vmError } = await supabaseAdmin
      .from('voice_models')
      .insert({
        name: `Base: ${name || 'Modelo'}`,
        status: 'approved',
        video_storage_path: videoPath,
        elevenlabs_voice_id: elData.voice_id,
      })
      .select()
      .single();

    if (vmError || !voiceModel) {
      console.error('Voice model DB error:', vmError);
      return NextResponse.json({ error: 'Falha ao salvar modelo de voz' }, { status: 500 });
    }

    // 4. Desativar modelos base anteriores
    await supabaseAdmin
      .from('video_base_models')
      .update({ is_active: false })
      .eq('is_active', true);

    // 5. Criar modelo base
    const { data: model, error: dbError } = await supabaseAdmin
      .from('video_base_models')
      .insert({
        name: name || 'Modelo Principal',
        video_storage_path: videoPath,
        voice_model_id: voiceModel.id,
        prompt_template,
        is_active: true,
      })
      .select('*, voice_models(*)')
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Falha ao criar modelo base' }, { status: 500 });
    }

    return NextResponse.json({ model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('admin/video-modelo POST error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH — Atualizar prompt template ou nome
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, prompt_template, name } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (prompt_template !== undefined) updates.prompt_template = prompt_template;
    if (name !== undefined) updates.name = name;

    const { data: model, error } = await supabaseAdmin
      .from('video_base_models')
      .update(updates)
      .eq('id', id)
      .select('*, voice_models(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Falha ao atualizar modelo' }, { status: 500 });
    }

    return NextResponse.json({ model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — Desativar modelo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    await supabaseAdmin
      .from('video_base_models')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
