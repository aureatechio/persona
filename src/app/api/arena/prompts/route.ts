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
      .select('id, content, version, is_active, updated_at, metadata')
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
 * Body: { id, content, changelog?, metadata?, instruction? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content, changelog, metadata, instruction } = body;

    if (!id || !content) {
      return NextResponse.json(
        { error: 'id e content são obrigatórios' },
        { status: 400 },
      );
    }

    // Get current version + content (for backup)
    const { data: current } = await supabaseAdmin
      .from('arena_prompts')
      .select('version, content')
      .eq('id', id)
      .single();

    const nextVersion = (current?.version || 0) + 1;

    const updatePayload: Record<string, unknown> = {
      content,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    };
    if (metadata !== undefined) {
      updatePayload.metadata = metadata;
    }

    const { data, error } = await supabaseAdmin
      .from('arena_prompts')
      .update(updatePayload)
      .eq('id', id)
      .select('id, content, version, updated_at, metadata')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Falha ao atualizar prompt' },
        { status: 500 },
      );
    }

    // Invalidate in-memory cache
    invalidatePromptCache(id);

    // Save changelog entry with previous_content as backup + instruction
    await supabaseAdmin.from('arena_prompt_changelog').insert({
      prompt_id: id,
      version: nextVersion,
      changes: changelog && Array.isArray(changelog) && changelog.length > 0
        ? changelog
        : ['Atualização direta'],
      previous_content: current?.content || null,
      instruction: instruction || null,
    });

    return NextResponse.json({ prompt: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
