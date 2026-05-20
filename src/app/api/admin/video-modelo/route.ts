import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_MAX_SAMPLE_BYTES = 11 * 1024 * 1024; // 11MB

export const maxDuration = 120;

const DEFAULT_LIPSYNC = { model: 'lipsync-2-pro', sync_mode: 'loop', temperature: 0.3 };

interface CloneVoiceResult {
  voice_model_id: string;
  elevenlabs_voice_id: string;
}

async function extractAudio(videoBuffer: Buffer, inputExt: string): Promise<Buffer> {
  const id = Date.now();
  const inputPath = join(tmpdir(), `extract_in_${id}.${inputExt}`);
  const outputPath = join(tmpdir(), `extract_out_${id}.mp3`);

  try {
    await writeFile(inputPath, videoBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vn', '-ac', '1', '-ar', '22050', '-acodec', 'libmp3lame', '-b:a', '64k',
      '-y', outputPath,
    ], { timeout: 60000 });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Faz download do vídeo no Storage, extrai áudio, sobe pro ElevenLabs (Instant
 * Voice Clone) e cria uma linha em `voice_models`. Retorna o id do voice_model.
 *
 * Lança Error com mensagem amigável em caso de falha; a chamada deve traduzir
 * isso pra resposta HTTP apropriada.
 */
async function cloneVoiceFromVideo(videoPath: string, label: string): Promise<CloneVoiceResult> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY não configurado');
  }

  const { data: videoData, error: dlError } = await supabaseAdmin
    .storage.from('voice-models')
    .download(videoPath);

  if (dlError || !videoData) {
    console.error('Download error:', dlError);
    throw new Error('Falha ao baixar vídeo do storage');
  }

  const videoBuffer = Buffer.from(await videoData.arrayBuffer());
  const ext = videoPath.endsWith('.webm') ? 'webm' : 'mp4';

  let audioBuffer: Buffer;
  let payloadMime = 'audio/mpeg';
  let payloadFilename = 'audio.mp3';
  try {
    audioBuffer = await extractAudio(videoBuffer, ext);
    console.log('[video-modelo] Audio extracted, size:', audioBuffer.length);
  } catch (err) {
    console.error('FFmpeg audio extract error:', err);
    audioBuffer = videoBuffer;
    payloadMime = ext === 'webm' ? 'video/webm' : 'video/mp4';
    payloadFilename = ext === 'webm' ? 'video.webm' : 'video.mp4';
  }

  if (audioBuffer.length > ELEVENLABS_MAX_SAMPLE_BYTES) {
    const mb = (audioBuffer.length / 1024 / 1024).toFixed(1);
    const err = new Error(
      `Amostra excede limite do ElevenLabs (${mb}MB > 11MB). Envie um vídeo menor/mais curto.`,
    );
    (err as Error & { status?: number }).status = 413;
    throw err;
  }

  const elForm = new FormData();
  elForm.append('name', `VideoBase_${label || 'Modelo'}_${Date.now()}`);
  elForm.append('files', new Blob([new Uint8Array(audioBuffer)], { type: payloadMime }), payloadFilename);
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
    const details = errText.slice(0, 220).replace(/\s+/g, ' ').trim();
    const err = new Error(`Falha ao clonar voz (${elRes.status}): ${details}`);
    (err as Error & { status?: number }).status = elRes.status === 413 ? 413 : 500;
    throw err;
  }

  const elData = await elRes.json();

  const { data: voiceModel, error: vmError } = await supabaseAdmin
    .from('voice_models')
    .insert({
      name: `Base: ${label || 'Modelo'}`,
      status: 'approved',
      video_storage_path: videoPath,
      elevenlabs_voice_id: elData.voice_id,
    })
    .select()
    .single();

  if (vmError || !voiceModel) {
    console.error('Voice model DB error:', vmError);
    throw new Error('Falha ao salvar modelo de voz');
  }

  return {
    voice_model_id: voiceModel.id,
    elevenlabs_voice_id: elData.voice_id,
  };
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  // letras/números/hifens; substitui acentos
  return trimmed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function statusFromError(err: unknown): { status: number; message: string } {
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    return { status: typeof status === 'number' ? status : 500, message: err.message };
  }
  return { status: 500, message: 'Erro interno' };
}

// ─── GET ────────────────────────────────────────────────────────────────────
// Sem ?id → lista todos. Com ?id=... → retorna um.
// `?legacy=1` mantém compat com versões antigas da UI que ainda esperam
// `{ model }` (o modelo ativo único).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const legacy = searchParams.get('legacy') === '1';

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('video_base_models')
        .select('*, voice_models(*)')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('GET by id error:', error);
        return NextResponse.json({ error: 'Falha ao carregar modelo' }, { status: 500 });
      }
      return NextResponse.json({ model: data || null });
    }

    if (legacy) {
      const { data } = await supabaseAdmin
        .from('video_base_models')
        .select('*, voice_models(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      return NextResponse.json({ model: data?.[0] || null });
    }

    const { data, error } = await supabaseAdmin
      .from('video_base_models')
      .select('*, voice_models(*)')
      .order('is_active', { ascending: false })
      .order('display_name', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET list error:', error);
      return NextResponse.json({ error: 'Falha ao listar modelos' }, { status: 500 });
    }

    return NextResponse.json({ models: data || [] });
  } catch (err) {
    const { status, message } = statusFromError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Cria um novo modelo. videoPath é opcional — se enviado, clona a voz.
// NÃO desativa outros modelos (cada slug é independente).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      videoPath,
      name,
      slug: rawSlug,
      display_name,
      prompt_template,
      lipsync_config,
      whatsapp_message_template,
      thank_you_message,
      closing_video_path,
      proposta_pdf_path,
      proposta_message_template,
      is_active,
    } = body;

    if (!prompt_template || typeof prompt_template !== 'string' || !prompt_template.trim()) {
      return NextResponse.json({ error: 'prompt_template é obrigatório' }, { status: 400 });
    }

    const slug = normalizeSlug(rawSlug);
    if (!slug) {
      return NextResponse.json({ error: 'slug é obrigatório (ex: flavio)' }, { status: 400 });
    }

    // Slug único — checagem prévia pra erro amigável
    const { data: existingSlug } = await supabaseAdmin
      .from('video_base_models')
      .select('id')
      .eq('slug', slug)
      .limit(1);
    if (existingSlug && existingSlug.length > 0) {
      return NextResponse.json(
        { error: `Já existe um modelo com slug "${slug}". Escolha outro.` },
        { status: 409 },
      );
    }

    let voice_model_id: string | null = null;
    if (videoPath && typeof videoPath === 'string') {
      const cloned = await cloneVoiceFromVideo(videoPath, name || display_name || slug);
      voice_model_id = cloned.voice_model_id;
    }

    const insertData: Record<string, unknown> = {
      name: name || display_name || 'Modelo',
      slug,
      display_name: display_name || name || slug,
      video_storage_path: videoPath || null,
      voice_model_id,
      prompt_template,
      lipsync_config: lipsync_config || DEFAULT_LIPSYNC,
      is_active: is_active !== false, // default true
    };
    if (whatsapp_message_template) insertData.whatsapp_message_template = whatsapp_message_template;
    if (thank_you_message !== undefined) insertData.thank_you_message = thank_you_message;
    if (closing_video_path !== undefined) insertData.closing_video_path = closing_video_path;
    if (proposta_pdf_path !== undefined) insertData.proposta_pdf_path = proposta_pdf_path;
    if (proposta_message_template !== undefined) insertData.proposta_message_template = proposta_message_template;

    const { data: model, error: dbError } = await supabaseAdmin
      .from('video_base_models')
      .insert(insertData)
      .select('*, voice_models(*)')
      .single();

    if (dbError) {
      console.error('Insert error:', dbError);
      return NextResponse.json({ error: 'Falha ao criar modelo base' }, { status: 500 });
    }

    return NextResponse.json({ model });
  } catch (err) {
    const { status, message } = statusFromError(err);
    console.error('admin/video-modelo POST error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────
// Atualiza por id. Se videoPath for enviado, re-clona voz e atualiza
// video_storage_path + voice_model_id.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      videoPath,
      name,
      slug: rawSlug,
      display_name,
      prompt_template,
      lipsync_config,
      whatsapp_message_template,
      thank_you_message,
      closing_video_path,
      proposta_pdf_path,
      proposta_message_template,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (rawSlug !== undefined) {
      const slug = normalizeSlug(rawSlug);
      if (!slug) {
        return NextResponse.json({ error: 'slug inválido' }, { status: 400 });
      }
      // Garante que não colide com outro id
      const { data: collision } = await supabaseAdmin
        .from('video_base_models')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .limit(1);
      if (collision && collision.length > 0) {
        return NextResponse.json({ error: `Slug "${slug}" já está em uso.` }, { status: 409 });
      }
      updates.slug = slug;
    }

    if (name !== undefined) updates.name = name;
    if (display_name !== undefined) updates.display_name = display_name;
    if (prompt_template !== undefined) updates.prompt_template = prompt_template;
    if (lipsync_config !== undefined) updates.lipsync_config = lipsync_config;
    if (whatsapp_message_template !== undefined) updates.whatsapp_message_template = whatsapp_message_template;
    if (thank_you_message !== undefined) updates.thank_you_message = thank_you_message;
    if (closing_video_path !== undefined) updates.closing_video_path = closing_video_path;
    if (proposta_pdf_path !== undefined) updates.proposta_pdf_path = proposta_pdf_path;
    if (proposta_message_template !== undefined) updates.proposta_message_template = proposta_message_template;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    // Troca de vídeo base → re-clonar voz
    if (videoPath && typeof videoPath === 'string') {
      const cloned = await cloneVoiceFromVideo(videoPath, display_name || name || id);
      updates.video_storage_path = videoPath;
      updates.voice_model_id = cloned.voice_model_id;
    }

    const { data: model, error } = await supabaseAdmin
      .from('video_base_models')
      .update(updates)
      .eq('id', id)
      .select('*, voice_models(*)')
      .single();

    if (error) {
      console.error('PATCH error:', error);
      return NextResponse.json({ error: 'Falha ao atualizar modelo' }, { status: 500 });
    }

    return NextResponse.json({ model });
  } catch (err) {
    const { status, message } = statusFromError(err);
    console.error('admin/video-modelo PATCH error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
// Soft-delete (is_active=false) apenas do id recebido. NÃO afeta outros.
// Hard-delete não é permitido para não quebrar FK em video_selfies.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('video_base_models')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('DELETE error:', error);
      return NextResponse.json({ error: 'Falha ao desativar modelo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, message } = statusFromError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
