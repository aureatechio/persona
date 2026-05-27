import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Registra o instante em que o eleitor clicou no botão "Quero receber meu
 * vídeo" e foi redirecionado pro wa.me. Não bloqueia nem afeta o pipeline —
 * é apenas métrica para decidir se vale implementar o gate por webhook.
 */
export async function POST(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id?: string };

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('video_selfies')
      .update({ whatsapp_button_clicked_at: new Date().toISOString() })
      .eq('id', id)
      .is('whatsapp_button_clicked_at', null);

    if (error) {
      console.warn('[whatsapp-click] update error:', error.message);
      return NextResponse.json({ error: 'Falha ao registrar click' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[whatsapp-click] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
