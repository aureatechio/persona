import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface StatusCount {
  status: string;
  count: number;
}

interface DailyCount {
  date: string;
  count: number;
}

interface SourceMetrics {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  last7d: number;
  last24h: number;
  byStatus: StatusCount[];
  byDay: DailyCount[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL = new Set(['completed', 'failed']);

function emptyMetrics(): SourceMetrics {
  return {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    last7d: 0,
    last24h: 0,
    byStatus: [],
    byDay: [],
  };
}

async function fetchMetrics(table: 'video_selfies' | 'supia_videos'): Promise<SourceMetrics> {
  const now = Date.now();
  const since7d = new Date(now - SEVEN_DAYS_MS).toISOString();
  const since24h = new Date(now - ONE_DAY_MS).toISOString();

  const [{ count: total }, { count: completed }, { count: failed }, { count: last7d }, { count: last24h }] =
    await Promise.all([
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true }),
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).gte('created_at', since7d),
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    ]);

  // Status breakdown (last 30 days for relevance)
  const since30d = new Date(now - 30 * ONE_DAY_MS).toISOString();
  const { data: statusRows } = await supabaseAdmin
    .from(table)
    .select('status, created_at')
    .gte('created_at', since30d)
    .limit(5000);

  const statusMap = new Map<string, number>();
  const dayMap = new Map<string, number>();

  for (const row of statusRows ?? []) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  const inProgress = Array.from(statusMap.entries())
    .filter(([s]) => !TERMINAL.has(s))
    .reduce((acc, [, n]) => acc + n, 0);

  const byStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const byDay: DailyCount[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now - i * ONE_DAY_MS).toISOString().slice(0, 10);
    byDay.push({ date: day, count: dayMap.get(day) ?? 0 });
  }

  return {
    total: total ?? 0,
    completed: completed ?? 0,
    failed: failed ?? 0,
    inProgress,
    last7d: last7d ?? 0,
    last24h: last24h ?? 0,
    byStatus,
    byDay,
  };
}

export async function GET() {
  try {
    const [selfie, supia, { count: usersCount }, baseModel] = await Promise.all([
      fetchMetrics('video_selfies').catch((err) => {
        console.error('selfie metrics error:', err);
        return emptyMetrics();
      }),
      fetchMetrics('supia_videos').catch((err) => {
        console.error('supia metrics error:', err);
        return emptyMetrics();
      }),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('video_base_models')
        .select('id, name, video_storage_path, created_at, voice_models(name, elevenlabs_voice_id)')
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    const totalGenerated = selfie.completed + supia.completed;
    const totalAttempts = selfie.total + supia.total;
    const successRate = totalAttempts > 0 ? Math.round((totalGenerated / totalAttempts) * 100) : 0;

    return NextResponse.json({
      selfie,
      supia,
      summary: {
        totalGenerated,
        totalAttempts,
        successRate,
        totalFailed: selfie.failed + supia.failed,
        totalInProgress: selfie.inProgress + supia.inProgress,
        last7d: selfie.last7d + supia.last7d,
        last24h: selfie.last24h + supia.last24h,
        usersCount: usersCount ?? 0,
      },
      activeBaseModel: baseModel.data ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('admin/dashboard error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
