import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supermarketName = ((body.supermarketName as string) || '').trim();

    if (!supermarketName) {
      return NextResponse.json({ error: 'Nome do supermercado é obrigatório' }, { status: 400 });
    }
    if (supermarketName.length > 60) {
      return NextResponse.json({ error: 'Nome muito longo (máx 60 caracteres)' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('supia_videos')
      .insert({ supermarket_name: supermarketName, status: 'queued' })
      .select('id')
      .single();

    if (error || !data) {
      console.error('supia/generate insert error:', error);
      return NextResponse.json({ error: 'Falha ao enfileirar' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('supia/generate error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
