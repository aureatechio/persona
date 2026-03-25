// Arena Monitor Stats API — aggregated usage data

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Total users
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true });

    // Total analyses
    const { count: totalAnalyses } = await supabaseAdmin
      .from('arena_analyses')
      .select('id', { count: 'exact', head: true });

    // Last 24h
    const { count: count24h } = await supabaseAdmin
      .from('arena_analyses')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', last24h);

    // Last 7 days
    const { count: count7d } = await supabaseAdmin
      .from('arena_analyses')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', last7d);

    // Recent analyses with user info
    const { data: recent } = await supabaseAdmin
      .from('arena_analyses')
      .select('id, created_at, question, content_meta, analise_data, user_id')
      .order('created_at', { ascending: false })
      .limit(30);

    // Get user info for recent analyses
    const userIds = [...new Set((recent || []).map((r: any) => r.user_id))];
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name, email, state')
      .in('id', userIds);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const recentAnalyses = (recent || []).map((r: any) => {
      const user = userMap.get(r.user_id) || {};
      const platforms = Array.isArray(r.content_meta?.mediaType)
        ? r.content_meta.mediaType.join(', ')
        : r.content_meta?.mediaType || '';
      return {
        id: r.id,
        created_at: r.created_at,
        user_name: (user as any).name || 'Desconhecido',
        user_email: (user as any).email || '',
        user_state: (user as any).state || '',
        headline: r.analise_data?.headline || '',
        score: r.analise_data?.score || 0,
        platform: platforms,
        question: r.question || '',
      };
    });

    // Top users by analysis count
    const userCounts: Record<string, number> = {};
    (recent || []).forEach((r: any) => {
      userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1;
    });

    // Get all analyses for proper count
    const { data: allAnalyses } = await supabaseAdmin
      .from('arena_analyses')
      .select('user_id');

    const fullCounts: Record<string, number> = {};
    (allAnalyses || []).forEach((r: any) => {
      fullCounts[r.user_id] = (fullCounts[r.user_id] || 0) + 1;
    });

    const topUsers = Object.entries(fullCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => {
        const user = userMap.get(userId) || {};
        return {
          name: (user as any).name || 'Desconhecido',
          email: (user as any).email || '',
          count,
        };
      });

    return Response.json({
      totalUsers: totalUsers || 0,
      totalAnalyses: totalAnalyses || 0,
      last24h: count24h || 0,
      last7d: count7d || 0,
      recentAnalyses,
      topUsers,
    });
  } catch (err: any) {
    console.error('[Monitor Stats] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
