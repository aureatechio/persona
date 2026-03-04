import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // Get account_id before deleting for count update
    const { data: follower } = await supabase
      .from('instagram_followers')
      .select('account_id')
      .eq('id', id)
      .single();

    const accountId = follower?.account_id;

    const { error } = await supabase
      .from('instagram_followers')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update follower count
    if (accountId) {
      const { count } = await supabase
        .from('instagram_followers')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId);

      if (count !== null) {
        await supabase
          .from('instagram_accounts')
          .update({ follower_count: count, updated_at: new Date().toISOString() })
          .eq('id', accountId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { account_id, username, display_name, avatar_url, ai_summary, category, category_label, metadata_json } = body as {
      account_id: string;
      username: string;
      display_name?: string;
      avatar_url?: string;
      ai_summary?: string;
      category?: string;
      category_label?: string;
      metadata_json?: Record<string, unknown>;
    };

    if (!account_id || !username) {
      return NextResponse.json({ error: 'account_id e username são obrigatórios' }, { status: 400 });
    }

    const row = {
      account_id,
      username,
      display_name: display_name || null,
      avatar_url: avatar_url || null,
      ai_summary: ai_summary || null,
      category: category || 'outro',
      category_label: category_label || null,
      metadata_json: metadata_json || {},
      updated_at: new Date().toISOString(),
    };

    // Upsert: insert or update if (account_id, username) already exists
    const { data, error } = await supabase
      .from('instagram_followers')
      .upsert(row, { onConflict: 'account_id,username' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update follower count
    const { count } = await supabase
      .from('instagram_followers')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', account_id);

    if (count !== null) {
      await supabase
        .from('instagram_accounts')
        .update({ follower_count: count, updated_at: new Date().toISOString() })
        .eq('id', account_id);
    }

    return NextResponse.json({ follower: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
