import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);

    const accountId = searchParams.get('account_id');
    const status = searchParams.get('status');
    const grupo = searchParams.get('grupo');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '50', 10);

    // Build message_logs query
    let query = supabase
      .from('message_logs')
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false });

    if (accountId) query = query.eq('account_id', accountId);
    if (status) query = query.eq('status', status);
    if (dateFrom) query = query.gte('sent_at', dateFrom);
    if (dateTo) query = query.lte('sent_at', dateTo);
    if (search) query = query.ilike('target_username', `%${search}%`);

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: logs, count } = await query;

    if (!logs) {
      return NextResponse.json({ messages: [], total: 0, page, per_page: perPage });
    }

    // Enrich with follower data
    const usernames = [...new Set(logs.map((l) => l.target_username))];

    const { data: followers } = await supabase
      .from('instagram_followers')
      .select('username, display_name, avatar_url, metadata_json')
      .in('username', usernames);

    const followerMap = new Map<string, { display_name: string; avatar_url: string; grupo: string }>();
    for (const f of followers || []) {
      const meta = f.metadata_json as Record<string, unknown> | null;
      const analysis = meta?.analysis_raw as Record<string, unknown> | null;
      const grupoVal = (analysis?.grupo as string) || 'OUTRO';
      followerMap.set(f.username, {
        display_name: f.display_name || f.username,
        avatar_url: f.avatar_url || '',
        grupo: grupoVal,
      });
    }

    // Filter by grupo if needed (post-filter since it's in metadata)
    let enrichedMessages = logs.map((log) => {
      const followerInfo = followerMap.get(log.target_username);
      return {
        id: log.id,
        target_username: log.target_username,
        display_name: followerInfo?.display_name || log.target_username,
        avatar_url: followerInfo?.avatar_url || '',
        grupo: followerInfo?.grupo || 'OUTRO',
        message_content: log.message_content,
        channel: log.channel,
        status: log.status,
        sent_at: log.sent_at,
        error_message: log.error_message,
      };
    });

    if (grupo) {
      enrichedMessages = enrichedMessages.filter((m) => m.grupo === grupo);
    }

    return NextResponse.json({
      messages: enrichedMessages,
      total: grupo ? enrichedMessages.length : (count || 0),
      page,
      per_page: perPage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
