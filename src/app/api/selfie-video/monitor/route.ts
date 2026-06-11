import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const SELECT_COLS = 'id, name, phone, status, error_message, created_at, updated_at, final_video_path, whatsapp_sent';

interface MonitorRow {
  id: string;
  name: string;
  phone: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  final_video_path: string | null;
  whatsapp_sent: boolean;
  _table: string;
}

async function fetchTable(table: 'video_selfies' | 'v2_video_selfies', now: number) {
  const [{ data: inProgress, error: e1 }, { data: finished, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from(table)
      .select(SELECT_COLS)
      .not('status', 'in', '("completed","failed")')
      .eq('whatsapp_sent', false)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from(table)
      .select(SELECT_COLS)
      .gte('updated_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
      .or('status.eq.completed,status.eq.failed,whatsapp_sent.eq.true')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const error = e1 || e2;
  const seen = new Set<string>();
  const rows: MonitorRow[] = [];
  for (const row of [...(inProgress ?? []), ...(finished ?? [])]) {
    const key = `${table}:${row.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      rows.push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        status: row.status,
        error_message: row.error_message,
        created_at: row.created_at,
        updated_at: row.updated_at,
        final_video_path: row.final_video_path,
        whatsapp_sent: row.whatsapp_sent,
        _table: table,
      });
    }
  }
  return { rows, error };
}

export async function GET() {
  try {
    const now = Date.now();

    const [v1, v2] = await Promise.all([
      fetchTable('video_selfies', now),
      fetchTable('v2_video_selfies', now),
    ]);

    const error = v1.error || v2.error;
    if (error) {
      console.error('Monitor fetch error:', error);
      return NextResponse.json({ error: 'Falha ao buscar dados' }, { status: 500 });
    }

    const allRows = [...v1.rows, ...v2.rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const enriched = await Promise.all(
      allRows.map(async (row) => {
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
