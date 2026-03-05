import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const UAZAPI_URL = process.env.UAZAPI_URL || 'https://aureatech.uazapi.com';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';

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

    if (!UAZAPI_TOKEN) {
      await updateStatus(selfie_id, 'failed', { error_message: 'UAZAPI_TOKEN não configurado' });
      return NextResponse.json({ error: 'UAZAPI_TOKEN não configurado' }, { status: 500 });
    }

    const { data: record } = await supabaseAdmin
      .from('video_selfies')
      .select('*')
      .eq('id', selfie_id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    if (!record.final_video_path) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Vídeo final não disponível' });
      return NextResponse.json({ error: 'Vídeo final não disponível' }, { status: 500 });
    }

    // Generate a signed URL for the final video (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUrl(record.final_video_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      await updateStatus(selfie_id, 'failed', { error_message: 'Falha ao gerar URL do vídeo' });
      return NextResponse.json({ error: 'Falha ao gerar URL do vídeo' }, { status: 500 });
    }

    // Send via UAZAPI /send/media endpoint (with retry for transient errors)
    const phone = record.phone.startsWith('55') ? record.phone : `55${record.phone}`;
    const MAX_RETRIES = 3;
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[send-whatsapp] Attempt ${attempt}/${MAX_RETRIES} for ${selfie_id}`);

      const uazRes = await fetch(`${UAZAPI_URL}/send/media`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'token': UAZAPI_TOKEN,
        },
        body: JSON.stringify({
          number: phone,
          type: 'video',
          file: signedUrlData.signedUrl,
          text: `Olá ${record.name}! Aqui está seu vídeo personalizado do evento!`,
        }),
      });

      if (uazRes.ok) {
        const uazData = await uazRes.json();
        console.log('UAZAPI response:', JSON.stringify(uazData));
        lastError = '';
        break;
      }

      lastError = await uazRes.text();
      console.error(`UAZAPI error (attempt ${attempt}):`, uazRes.status, lastError);

      if (attempt < MAX_RETRIES) {
        // Wait before retry: 5s, 10s
        await new Promise(r => setTimeout(r, attempt * 5000));
      }
    }

    if (lastError) {
      await updateStatus(selfie_id, 'failed', { error_message: `UAZAPI failed after ${MAX_RETRIES} attempts: ${lastError}` });
      return NextResponse.json({ error: 'Falha ao enviar WhatsApp' }, { status: 500 });
    }

    await updateStatus(selfie_id, 'completed', {
      whatsapp_sent: true,
      whatsapp_sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: 'completed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('selfie-video/send-whatsapp error:', msg);
    if (selfie_id) {
      await updateStatus(selfie_id, 'failed', { error_message: msg }).catch(() => {});
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
