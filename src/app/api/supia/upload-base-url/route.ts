import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    const tempPath = `supia/_pending/${randomUUID()}.mp4`;
    const { data, error } = await supabaseAdmin.storage
      .from('voice-models')
      .createSignedUploadUrl(tempPath);

    if (error || !data) {
      console.error('supia/upload-base-url error:', error);
      return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      tempPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('supia/upload-base-url error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
