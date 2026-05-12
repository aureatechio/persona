import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100);

  const { data, error } = await supabaseAdmin
    .from('supia_videos')
    .select('id, supermarket_name, status, final_video_path, created_at')
    .eq('status', 'completed')
    .not('final_video_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('supia/list error:', error);
    return NextResponse.json({ error: 'Falha ao buscar galeria' }, { status: 500 });
  }

  const items = await Promise.all(
    (data || []).map(async (row) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('voice-models')
        .createSignedUrl(row.final_video_path as string, 3600);
      return {
        id: row.id,
        supermarketName: row.supermarket_name,
        videoUrl: signed?.signedUrl ?? null,
        createdAt: row.created_at,
      };
    }),
  );

  return NextResponse.json({ items: items.filter((i) => i.videoUrl) });
}
