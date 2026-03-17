import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { invalidatePromptCache } from '@/lib/arena/prompt-loader';

/**
 * GET /api/arena/prompts?id=arena_system
 * Returns current prompt with metadata.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || 'arena_system';

  try {
    const { data, error } = await supabaseAdmin
      .from('arena_prompts')
      .select('id, content, version, is_active, updated_at')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: `Prompt "${id}" not found` },
        { status: 404 },
      );
    }

    return NextResponse.json({ prompt: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/arena/prompts
 * Updates prompt content + increments version.
 * Body: { id, content, changelog? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content, changelog } = body;

    if (!id || !content) {
      return NextResponse.json(
        { error: 'id e content são obrigatórios' },
        { status: 400 },
      );
    }

    // Get current version
    const { data: current } = await supabaseAdmin
      .from('arena_prompts')
      .select('version')
      .eq('id', id)
      .single();

    const nextVersion = (current?.version || 0) + 1;

    const { data, error } = await supabaseAdmin
      .from('arena_prompts')
      .update({
        content,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, content, version, updated_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Falha ao atualizar prompt' },
        { status: 500 },
      );
    }

    // Invalidate in-memory cache
    invalidatePromptCache(id);

    // Save changelog entry if provided
    if (changelog && Array.isArray(changelog) && changelog.length > 0) {
      await supabaseAdmin.from('arena_prompt_changelog').insert({
        prompt_id: id,
        version: nextVersion,
        changes: changelog,
      });
    }

    return NextResponse.json({ prompt: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
