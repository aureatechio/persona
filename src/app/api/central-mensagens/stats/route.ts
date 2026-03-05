import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');

    // 1. Get all accounts with analyzed counts
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('id, username, display_name, avatar_url, follower_count')
      .order('created_at', { ascending: false });

    const accountList = [];
    for (const acc of accounts || []) {
      const { count } = await supabase
        .from('instagram_followers')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', acc.id);

      accountList.push({ ...acc, analyzed_count: count || 0 });
    }

    // 2. Build query filters
    let followersQuery = supabase.from('instagram_followers').select('*', { count: 'exact', head: true });
    let messagesQuery = supabase.from('message_logs').select('*', { count: 'exact', head: true });
    let followedQuery = supabase.from('instagram_followers').select('*', { count: 'exact', head: true }).eq('followed', true);

    if (accountId) {
      followersQuery = followersQuery.eq('account_id', accountId);
      messagesQuery = messagesQuery.eq('account_id', accountId);
      followedQuery = followedQuery.eq('account_id', accountId);
    }

    const [
      { count: totalAnalyzed },
      { count: totalMessaged },
      { count: totalFollowed },
    ] = await Promise.all([followersQuery, messagesQuery, followedQuery]);

    const reachRate = totalAnalyzed ? Math.round(((totalMessaged || 0) / totalAnalyzed) * 100 * 10) / 10 : 0;

    // 3. Messages by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let recentMessagesQuery = supabase
      .from('message_logs')
      .select('sent_at')
      .gte('sent_at', thirtyDaysAgo.toISOString())
      .order('sent_at', { ascending: true });

    if (accountId) {
      recentMessagesQuery = recentMessagesQuery.eq('account_id', accountId);
    }

    const { data: recentMessages } = await recentMessagesQuery;

    const messagesByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      messagesByDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const msg of recentMessages || []) {
      if (msg.sent_at) {
        const day = msg.sent_at.slice(0, 10);
        if (messagesByDay[day] !== undefined) {
          messagesByDay[day]++;
        }
      }
    }

    const messagesByDayArr = Object.entries(messagesByDay).map(([date, count]) => ({ date, count }));

    // 4. Distribution by grupo
    let grupoQuery = supabase
      .from('instagram_followers')
      .select('metadata_json')
      .eq('messaged', true);

    if (accountId) {
      grupoQuery = grupoQuery.eq('account_id', accountId);
    }

    const { data: messagedFollowers } = await grupoQuery;

    const grupoCount: Record<string, number> = {};
    for (const f of messagedFollowers || []) {
      const meta = f.metadata_json as Record<string, unknown> | null;
      const analysis = meta?.analysis_raw as Record<string, unknown> | null;
      const grupo = (analysis?.grupo as string) || 'OUTRO';
      grupoCount[grupo] = (grupoCount[grupo] || 0) + 1;
    }

    const distributionByGrupo = Object.entries(grupoCount)
      .map(([grupo, count]) => ({ grupo, count }))
      .sort((a, b) => b.count - a.count);

    // 5. Messages by status
    let statusQuery = supabase
      .from('message_logs')
      .select('status');

    if (accountId) {
      statusQuery = statusQuery.eq('account_id', accountId);
    }

    const { data: allLogs } = await statusQuery;

    const statusCount: Record<string, number> = {};
    for (const log of allLogs || []) {
      statusCount[log.status] = (statusCount[log.status] || 0) + 1;
    }

    const messagesByStatus = Object.entries(statusCount)
      .map(([status, count]) => ({ status, count }));

    return NextResponse.json({
      total_analyzed: totalAnalyzed || 0,
      total_messaged: totalMessaged || 0,
      total_followed: totalFollowed || 0,
      reach_rate: reachRate,
      messages_by_day: messagesByDayArr,
      distribution_by_grupo: distributionByGrupo,
      messages_by_status: messagesByStatus,
      accounts: accountList,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
