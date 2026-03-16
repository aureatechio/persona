import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Called by the browser after the video upload to Supabase Storage completes.
 * Transitions the record from "uploading" → "queued" so the worker can claim it.
 */
export async function POST(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id: string };

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('video_selfies')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'uploading');

    if (error) {
      console.error('confirm-upload error:', error);
      return NextResponse.json({ error: 'Falha ao confirmar upload' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('confirm-upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
