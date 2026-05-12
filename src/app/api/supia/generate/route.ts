import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MAX_CUSTOM_CHARS = 250;
const MAX_NAME_CHARS = 60;
const DEFAULT_MODEL = 'lipsync-2-pro';
const DEFAULT_TEMPERATURE = 0.5;
const ALLOWED_MODELS = ['sync-3', 'lipsync-2-pro', 'lipsync-2'] as const;
const MODELS_WITH_TEMPERATURE: Set<string> = new Set(['lipsync-2-pro', 'lipsync-2']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = (body.mode as string) === 'custom' ? 'custom' : 'standard';

    let supermarketName = ((body.supermarketName as string) || '').trim();
    let customPhrase: string | null = null;

    // Model selection
    const rawModel = (body.model as string) || DEFAULT_MODEL;
    if (!ALLOWED_MODELS.includes(rawModel as (typeof ALLOWED_MODELS)[number])) {
      return NextResponse.json(
        { error: `Modelo inválido. Use: ${ALLOWED_MODELS.join(', ')}` },
        { status: 400 },
      );
    }
    const model = rawModel;

    // Temperature: persisted only when model supports it; null otherwise so the
    // worker won't accidentally send it to sync-3.
    let temperature: number | null = null;
    if (MODELS_WITH_TEMPERATURE.has(model)) {
      const rawTemp = body.temperature;
      let t = DEFAULT_TEMPERATURE;
      if (rawTemp !== undefined && rawTemp !== null && rawTemp !== '') {
        const parsed = Number(rawTemp);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          return NextResponse.json(
            { error: 'Temperatura deve ser um número entre 0 e 1' },
            { status: 400 },
          );
        }
        t = parsed;
      }
      temperature = Math.round(t * 100) / 100;
    }

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
        lipsync_model: model,
        lipsync_temperature: temperature,
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
