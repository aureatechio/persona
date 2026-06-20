import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function sanitizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

const LOGO_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

// Upload init: returns signed URL so browser uploads directly to Storage.
// kind = 'base'     → vídeo principal (lip-sync source legado) — mp4/webm
// kind = 'greeting' → vídeo saudação 3s (lip-sync source novo) — mp4/webm
// kind = 'closing'  → vídeo de encerramento (concatenado pelo ffmpeg) — mp4/webm
// kind = 'proposta' → PDF da proposta de governo enviada via WhatsApp
// kind = 'logo'     → logo personalizado do político (imagem) exibido na tela de selfie
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name : 'Modelo';
    const ext = typeof body?.ext === 'string' ? body.ext.toLowerCase() : 'mp4';
    const allowedKinds = ['base', 'greeting', 'closing', 'proposta', 'logo'] as const;
    const kind = (allowedKinds as readonly string[]).includes(body?.kind)
      ? (body.kind as 'base' | 'greeting' | 'closing' | 'proposta' | 'logo')
      : 'base';

    if (kind === 'proposta') {
      if (ext !== 'pdf') {
        return NextResponse.json({ error: 'Proposta aceita apenas PDF' }, { status: 400 });
      }
    } else if (kind === 'logo') {
      if (!LOGO_EXTS.includes(ext)) {
        return NextResponse.json(
          { error: 'Logo aceita apenas PNG, JPG, WEBP ou SVG' },
          { status: 400 },
        );
      }
    } else if (!['mp4', 'webm'].includes(ext)) {
      return NextResponse.json({ error: 'ext inválida. Use mp4 ou webm' }, { status: 400 });
    }

    const safeName = sanitizeName(name) || 'Modelo';
    const prefix =
      kind === 'closing'
        ? 'closing-videos'
        : kind === 'proposta'
        ? 'propostas'
        : kind === 'greeting'
        ? 'greeting-videos'
        : kind === 'logo'
        ? 'logos'
        : 'base-models';
    const videoPath = `${prefix}/${Date.now()}_${safeName}.${ext}`;

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
