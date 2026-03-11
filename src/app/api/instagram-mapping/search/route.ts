import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const apifyToken = process.env.APIFY_API_TOKEN || '';
const ACTOR_ID = 'datadoping/instagram-followers-scraper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface ApifyFollower {
  full_name: string;
  username: string;
  id: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!apifyToken) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN não configurado' }, { status: 500 });
    }

    const body = await request.json();
    const { username, maxCount = 50 } = body as { username: string; maxCount?: number };

    if (!username) {
      return NextResponse.json({ error: 'username é obrigatório' }, { status: 400 });
    }

    // Extract username from Instagram URLs (e.g. https://www.instagram.com/user/)
    const cleanUsername = username
      .replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//, '')
      .replace(/\/.*$/, '')
      .replace(/^@/, '')
      .trim();

    /* ─── Check DB cache first ─── */
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try exact username match first, then fallback to slug
    let { data: account } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (!account) {
      ({ data: account } = await supabase
        .from('instagram_accounts')
        .select('id')
        .eq('slug', cleanUsername.toLowerCase())
        .maybeSingle());
    }

    if (account) {
      // Fetch all cached followers for this account
      const { data: cachedFollowers } = await supabase
        .from('instagram_followers')
        .select('username, display_name, avatar_url, ai_summary, category, category_label, metadata_json, followed, messaged')
        .eq('account_id', account.id)
        .order('created_at', { ascending: true });

      if (cachedFollowers && cachedFollowers.length > 0) {
        // Separate analyzed (have metadata_json with analysis) from raw
        const analyzedFromDb = cachedFollowers
          .filter((f) => f.metadata_json && f.metadata_json.analysis_raw)
          .map((f) => ({
            username: f.username,
            display_name: f.display_name || f.username,
            avatar_url: f.avatar_url || '',
            analysis: f.metadata_json.analysis_raw,
            category: f.category,
            profile: {
              biography: f.metadata_json.biography || '',
              followers_count: f.metadata_json.followers_count,
              follows_count: f.metadata_json.follows_count,
              posts_count: f.metadata_json.posts_count,
            },
            followed: !!f.followed,
            messaged: !!f.messaged,
          }));

        if (analyzedFromDb.length > 0) {
          return NextResponse.json({
            cached: true,
            account_id: account.id,
            analyzedFollowers: analyzedFromDb,
            total: analyzedFromDb.length,
          });
        }
      }
    }

    /* ─── No cache — call Apify ─── */
    const safeMaxCount = Math.max(50, maxCount);

    const encodedActor = encodeURIComponent(ACTOR_ID);
    const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items?token=${apifyToken}&timeout=300`;

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [cleanUsername],
        max_count: safeMaxCount,
      }),
      signal: AbortSignal.timeout(310000),
    });

    if (!apifyRes.ok) {
      const err = await apifyRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as Record<string, unknown>).message || `Apify retornou ${apifyRes.status}` },
        { status: 502 },
      );
    }

    const data = (await apifyRes.json()) as ApifyFollower[];

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Nenhum seguidor encontrado. Verifique se o perfil é público.', followers: [] });
    }

    // Upsert the target account in instagram_accounts
    const { data: upsertedAccount } = await supabase
      .from('instagram_accounts')
      .upsert(
        { username: cleanUsername, slug: cleanUsername.toLowerCase(), updated_at: new Date().toISOString() },
        { onConflict: 'username' },
      )
      .select('id')
      .single();

    const accountId = upsertedAccount?.id || account?.id || null;

    // Return raw list — frontend will filter private
    const followers = data.map((f) => ({
      username: f.username,
      full_name: f.full_name || '',
      is_private: f.is_private,
      is_verified: f.is_verified,
      profile_pic_url: f.profile_pic_url || '',
      ig_id: f.id,
    }));

    return NextResponse.json({ followers, total: followers.length, account_id: accountId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
