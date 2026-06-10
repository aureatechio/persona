import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('v3_video_selfies')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'uploading');

    if (error) {
      return NextResponse.json({ error: 'Falha ao confirmar upload' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
