import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/arena/prompts/original
 * Returns the frozen original prompt (arena_system_original).
 * This row is never modified — it's the factory default.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('arena_prompts')
      .select('content')
      .eq('id', 'arena_system_original')
      .single();

    if (error || !data?.content) {
      return NextResponse.json(
        { error: 'Prompt original não encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json({ content: data.content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
