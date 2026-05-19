import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type Source = 'selfie' | 'supia' | 'all';

interface NormalizedVideo {
  id: string;
  source: 'selfie' | 'supia';
  title: string;
  subtitle: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  videoUrl: string | null;
  storagePath: string | null;
}

const VALID_SOURCES = new Set(['selfie', 'supia', 'all']);

async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from('voice-models').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceParam = (searchParams.get('source') ?? 'all').toLowerCase();
    const source: Source = (VALID_SOURCES.has(sourceParam) ? sourceParam : 'all') as Source;
    const status = searchParams.get('status');
    const search = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

    const results: NormalizedVideo[] = [];
    let total = 0;

    if (source === 'selfie' || source === 'all') {
      let query = supabaseAdmin
        .from('video_selfies')
        .select('id, name, phone, status, error_message, created_at, updated_at, final_video_path, lipsync_video_url', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

      const { data, count } = await query;
      total += count ?? 0;

      for (const row of data ?? []) {
        const url = await signedUrl(row.final_video_path);
        results.push({
          id: row.id,
          source: 'selfie',
          title: row.name,
          subtitle: row.phone,
          status: row.status,
          errorMessage: row.error_message,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          videoUrl: url ?? row.lipsync_video_url ?? null,
          storagePath: row.final_video_path ?? null,
        });
      }
    }

    if (source === 'supia' || source === 'all') {
      let query = supabaseAdmin
        .from('supia_videos')
        .select('id, supermarket_name, status, error_message, created_at, updated_at, final_video_path, lipsync_video_url', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (search) query = query.ilike('supermarket_name', `%${search}%`);

      const { data, count } = await query;
      total += count ?? 0;

      for (const row of data ?? []) {
        const url = await signedUrl(row.final_video_path);
        results.push({
          id: row.id,
          source: 'supia',
          title: row.supermarket_name,
          subtitle: 'Supia',
          status: row.status,
          errorMessage: row.error_message,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          videoUrl: url ?? row.lipsync_video_url ?? null,
          storagePath: row.final_video_path ?? null,
        });
      }
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ videos: results.slice(0, limit), total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('admin/videos error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
