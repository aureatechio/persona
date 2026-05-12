import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('supia_videos')
    .select('id, supermarket_name, status, error_message, final_video_path, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('supia/status error:', error);
    return NextResponse.json({ error: 'Falha ao consultar' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  }

  let videoUrl: string | null = null;
  if (data.status === 'completed' && data.final_video_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from('voice-models')
      .createSignedUrl(data.final_video_path, 3600);
    videoUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    id: data.id,
    supermarketName: data.supermarket_name,
    status: data.status,
    error: data.error_message,
    videoUrl,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
