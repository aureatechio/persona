import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = Date.now();

    // In-progress: last 24h
    const { data: inProgress, error: errProgress } = await supabaseAdmin
      .from('video_selfies')
      .select('id, name, phone, status, error_message, created_at, updated_at, final_video_path, whatsapp_sent')
      .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
      .not('status', 'in', '("completed","failed")')
      .eq('whatsapp_sent', false)
      .order('created_at', { ascending: false });

    // Completed/failed: only last 1 hour (keeps screen clean)
    const { data: finished, error: errFinished } = await supabaseAdmin
      .from('video_selfies')
      .select('id, name, phone, status, error_message, created_at, updated_at, final_video_path, whatsapp_sent')
      .gte('updated_at', new Date(now - 60 * 60 * 1000).toISOString())
      .or('status.eq.completed,status.eq.failed,whatsapp_sent.eq.true')
      .order('created_at', { ascending: false });

    const error = errProgress || errFinished;
    const data = [...(inProgress || []), ...(finished || [])];

    if (error) {
      console.error('Monitor fetch error:', error);
      return NextResponse.json({ error: 'Falha ao buscar dados' }, { status: 500 });
    }

    // Generate signed URLs for completed videos
    const enriched = await Promise.all(
      (data || []).map(async (row) => {
        let videoUrl: string | null = null;
        if (row.final_video_path && (row.status === 'completed' || row.whatsapp_sent)) {
          const { data: signed } = await supabaseAdmin.storage
            .from('voice-models')
            .createSignedUrl(row.final_video_path, 3600);
          videoUrl = signed?.signedUrl ?? null;
        }
        return { ...row, videoUrl };
      }),
    );

    return NextResponse.json({ selfies: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('Monitor error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
