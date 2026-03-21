import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function sanitizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

// Upload init: returns signed URL so browser uploads directly to Storage.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name : 'Modelo';
    const ext = typeof body?.ext === 'string' ? body.ext.toLowerCase() : 'mp4';

    if (!['mp4', 'webm'].includes(ext)) {
      return NextResponse.json({ error: 'ext inválida. Use mp4 ou webm' }, { status: 400 });
    }

    const safeName = sanitizeName(name) || 'Modelo';
    const videoPath = `base-models/${Date.now()}_${safeName}.${ext}`;

    const { data: signed, error: uploadError } = await supabaseAdmin
      .storage.from('voice-models')
      .createSignedUploadUrl(videoPath);

    if (uploadError || !signed) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: signed.signedUrl,
      token: signed.token,
      videoPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('video-modelo/upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
