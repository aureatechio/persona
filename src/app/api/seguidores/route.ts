import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '30', 10);
    const search = searchParams.get('search') || '';
    const grupo = searchParams.get('grupo') || '';
    const accountId = searchParams.get('account_id') || '';
    const messaged = searchParams.get('messaged'); // 'true' | 'false' | null
    const sortBy = searchParams.get('sort') || 'created_at';
    const sortDir = searchParams.get('dir') === 'asc' ? true : false;

    // Build query
    let query = supabase
      .from('instagram_followers')
      .select('*, instagram_accounts!inner(username, display_name)', { count: 'exact' });

    if (accountId) query = query.eq('account_id', accountId);
    if (grupo) query = query.ilike('category', grupo);
    if (messaged === 'true') query = query.eq('messaged', true);
    if (messaged === 'false') query = query.or('messaged.is.null,messaged.eq.false');
    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,ai_summary.ilike.%${search}%`);
    }

    // Sorting
    const validSorts = ['created_at', 'username', 'display_name', 'category', 'messaged_at'];
    const col = validSorts.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(col, { ascending: sortDir, nullsFirst: false });

    // Pagination
    const from = (page - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch accounts for the selector
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('id, username, display_name, avatar_url, follower_count')
      .order('created_at', { ascending: false });

    // Stats
    const { count: totalFollowers } = await supabase
      .from('instagram_followers')
      .select('*', { count: 'exact', head: true });

    const { count: totalMessaged } = await supabase
      .from('instagram_followers')
      .select('*', { count: 'exact', head: true })
      .eq('messaged', true);

    return NextResponse.json({
      followers: data || [],
      total: count || 0,
      accounts: accounts || [],
      stats: {
        total: totalFollowers || 0,
        messaged: totalMessaged || 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
