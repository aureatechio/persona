import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * V2 WhatsApp Click: Records when the voter clicks "Quero receber meu vídeo".
 * Metric only — does not affect the pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id?: string };

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('v2_video_selfies')
      .update({ whatsapp_button_clicked_at: new Date().toISOString() })
      .eq('id', id)
      .is('whatsapp_button_clicked_at', null);

    if (error) {
      console.warn('[v2/whatsapp-click] error:', error.message);
      return NextResponse.json({ error: 'Falha ao registrar click' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[v2/whatsapp-click] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
