import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/arena/prompts/changelog?id=arena_system
 * Returns recent changelog entries for a prompt.
 */
export async function GET(request: NextRequest) {
  const promptId = request.nextUrl.searchParams.get('id') || 'arena_system';

  try {
    const { data, error } = await supabaseAdmin
      .from('arena_prompt_changelog')
      .select('version, changes, created_at')
      .eq('prompt_id', promptId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ entries: [] });
    }

    return NextResponse.json({ entries: data || [] });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}
