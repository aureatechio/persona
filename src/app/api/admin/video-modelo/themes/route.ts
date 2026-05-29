import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const STORAGE_BUCKET = 'voice-models';
const SIGNED_URL_TTL = 60 * 30; // 30 min — tempo suficiente pra upload de vídeo grande

// ─── GET ────────────────────────────────────────────────────────────────────
// Lista os 31 temas + status (is_uploaded, video_storage_path) para um base_model.
// Faz JOIN com themes_template pra trazer label/category/description em uma só
// consulta. Se o base_model ainda não tem rows em video_theme_models (legado),
// criamos as 31 on-demand antes de devolver.
export async function GET(request: NextRequest) {
  try {
    const baseModelId = new URL(request.url).searchParams.get('baseModelId');
    if (!baseModelId) {
      return NextResponse.json({ error: 'baseModelId é obrigatório' }, { status: 400 });
    }

    // Tenta backfill caso esteja faltando rows (ocorre se a migration de
    // backfill rodou antes da inserção do base_model em questão).
    const { count } = await supabaseAdmin
      .from('video_theme_models')
      .select('id', { count: 'exact', head: true })
      .eq('base_model_id', baseModelId);

    if ((count || 0) === 0) {
      const { data: themes } = await supabaseAdmin
        .from('themes_template')
        .select('slug');
      if (themes && themes.length > 0) {
        await supabaseAdmin
          .from('video_theme_models')
          .insert(themes.map((t) => ({ base_model_id: baseModelId, theme_slug: t.slug })));
      }
    }

    const { data, error } = await supabaseAdmin
      .from('video_theme_models')
      .select('id, theme_slug, video_storage_path, is_uploaded, updated_at, themes_template(label, category, priority, description, is_default, display_order)')
      .eq('base_model_id', baseModelId)
      .order('themes_template(display_order)', { ascending: true });

    if (error) {
      console.error('[themes] GET error:', error);
      return NextResponse.json({ error: 'Falha ao listar temas' }, { status: 500 });
    }

    return NextResponse.json({ themes: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// { action: 'upload-url', baseModelId, themeSlug, ext }
//   → gera signed URL pra upload direto no Storage.
//
// { action: 'confirm-upload', baseModelId, themeSlug }
//   → marca is_uploaded=true após upload bem-sucedido.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action as string | undefined;
    const baseModelId = body?.baseModelId as string | undefined;
    const themeSlug = body?.themeSlug as string | undefined;

    if (!action || !baseModelId || !themeSlug) {
      return NextResponse.json({ error: 'action, baseModelId e themeSlug são obrigatórios' }, { status: 400 });
    }

    if (action === 'upload-url') {
      const ext = (body?.ext as string | undefined) || 'mp4';
      const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'mp4';
      const path = `themes/${baseModelId}/${themeSlug}.${safeExt}`;

      const { data, error } = await supabaseAdmin
        .storage.from(STORAGE_BUCKET)
        .createSignedUploadUrl(path, { upsert: true });

      if (error || !data) {
        console.error('[themes] createSignedUploadUrl error:', error);
        return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 });
      }
      return NextResponse.json({ uploadUrl: data.signedUrl, token: data.token, path });
    }

    if (action === 'confirm-upload') {
      const path = body?.path as string | undefined;
      if (!path) {
        return NextResponse.json({ error: 'path é obrigatório no confirm-upload' }, { status: 400 });
      }
      const { error } = await supabaseAdmin
        .from('video_theme_models')
        .update({
          video_storage_path: path,
          is_uploaded: true,
          updated_at: new Date().toISOString(),
        })
        .eq('base_model_id', baseModelId)
        .eq('theme_slug', themeSlug);

      if (error) {
        console.error('[themes] confirm-upload error:', error);
        return NextResponse.json({ error: 'Falha ao confirmar upload' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `action desconhecida: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────
// Alterna is_uploaded (yes/no toggle). Quando o candidato avisar que "não
// vou gravar o vídeo desse tema", o admin desliga o toggle e o worker cai
// no fluxo legacy (gera resposta completa via IA) pra esse tema.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const baseModelId = body?.baseModelId as string | undefined;
    const themeSlug = body?.themeSlug as string | undefined;
    const isUploaded = body?.is_uploaded;

    if (!baseModelId || !themeSlug || typeof isUploaded !== 'boolean') {
      return NextResponse.json(
        { error: 'baseModelId, themeSlug e is_uploaded são obrigatórios' },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from('video_theme_models')
      .update({ is_uploaded: isUploaded, updated_at: new Date().toISOString() })
      .eq('base_model_id', baseModelId)
      .eq('theme_slug', themeSlug);

    if (error) {
      console.error('[themes] PATCH error:', error);
      return NextResponse.json({ error: 'Falha ao alternar status' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
