import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * V2 Status: Returns the current processing status of a v2 selfie.
 * Used by the frontend to poll and show progress.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('v2_video_selfies')
    .select('id, status, error_message, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[v2/status] error:', error);
    return NextResponse.json({ error: 'Falha ao consultar status' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }

  return NextResponse.json(data);
}
