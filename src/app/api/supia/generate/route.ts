import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MAX_CUSTOM_CHARS = 250;
const MAX_NAME_CHARS = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = (body.mode as string) === 'custom' ? 'custom' : 'standard';

    let supermarketName = ((body.supermarketName as string) || '').trim();
    let customPhrase: string | null = null;

    if (mode === 'custom') {
      customPhrase = ((body.customPhrase as string) || '').trim();
      if (!customPhrase) {
        return NextResponse.json({ error: 'A frase customizada é obrigatória' }, { status: 400 });
      }
      if (customPhrase.length > MAX_CUSTOM_CHARS) {
        return NextResponse.json(
          { error: `Frase muito longa (máx ${MAX_CUSTOM_CHARS} caracteres)` },
          { status: 400 },
        );
      }
      // Custom mode keeps a name for organization in the gallery; default if blank
      if (!supermarketName) supermarketName = 'Custom';
    } else {
      if (!supermarketName) {
        return NextResponse.json({ error: 'Nome do supermercado é obrigatório' }, { status: 400 });
      }
      if (supermarketName.length > MAX_NAME_CHARS) {
        return NextResponse.json(
          { error: `Nome muito longo (máx ${MAX_NAME_CHARS} caracteres)` },
          { status: 400 },
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('supia_videos')
      .insert({
        supermarket_name: supermarketName,
        custom_phrase: customPhrase,
        status: 'queued',
      })
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
