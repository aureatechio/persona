import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * V2 Confirm Upload: Transitions v2_video_selfies from "uploading" -> "queued".
 * Called by the browser after the video upload to Storage completes.
 */
export async function POST(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id: string };

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('v2_video_selfies')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'uploading');

    if (error) {
      console.error('[v2/confirm-upload] error:', error);
      return NextResponse.json({ error: 'Falha ao confirmar upload' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[v2/confirm-upload] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
