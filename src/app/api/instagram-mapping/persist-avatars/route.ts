import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { persistAvatarToStorage } from '@/lib/instagram-mapping/persist-avatar';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const apifyToken = process.env.APIFY_API_TOKEN || '';

const ACTOR_ID = 'datadoping/instagram-followers-scraper';

interface ApifyFollower {
  username: string;
  profile_pic_url: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!apifyToken) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN nao configurado' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { accountId } = body as { accountId: string };

    if (!accountId) {
      return NextResponse.json({ error: 'accountId e obrigatorio' }, { status: 400 });
    }

    // Get account username for Apify re-scrape
    const { data: account, error: accErr } = await supabase
      .from('instagram_accounts')
      .select('username')
      .eq('id', accountId)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: 'Conta nao encontrada' }, { status: 404 });
    }

    // Get followers that need avatar fixing (not yet on Supabase Storage)
    const { data: followers, error: fErr } = await supabase
      .from('instagram_followers')
      .select('id, username, avatar_url')
      .eq('account_id', accountId);

    if (fErr) {
      return NextResponse.json({ error: fErr.message }, { status: 500 });
    }

    const supabaseHost = new URL(supabaseUrl).host;
    const needsFix = (followers || []).filter((f) => {
      if (!f.avatar_url) return true;
      return !f.avatar_url.includes(supabaseHost);
    });

    if (needsFix.length === 0) {
      return NextResponse.json({
        message: 'Todos os avatares ja estao persistidos',
        fixed: 0,
        total: followers?.length || 0,
      });
    }

    // Re-scrape via Apify to get fresh CDN URLs
    const encodedActor = encodeURIComponent(ACTOR_ID);
    const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`;

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [account.username],
        max_count: Math.max(200, (followers?.length || 0) + 50),
      }),
      signal: AbortSignal.timeout(130_000),
    });

    if (!apifyRes.ok) {
      return NextResponse.json(
        { error: `Apify retornou ${apifyRes.status}` },
        { status: 502 },
      );
    }

    const apifyData = (await apifyRes.json()) as ApifyFollower[];

    const freshCdnMap = new Map<string, string>();
    for (const f of apifyData) {
      if (f.profile_pic_url) {
        freshCdnMap.set(f.username, f.profile_pic_url);
      }
    }

    // Download and persist in parallel batches
    let fixed = 0;
    let skipped = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < needsFix.length; i += BATCH_SIZE) {
      const batch = needsFix.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (follower) => {
          const cdnUrl = freshCdnMap.get(follower.username);
          if (!cdnUrl) {
            skipped++;
            return;
          }
          const permanentUrl = await persistAvatarToStorage(cdnUrl, follower.id);
          if (permanentUrl) {
            await supabase
              .from('instagram_followers')
              .update({ avatar_url: permanentUrl, updated_at: new Date().toISOString() })
              .eq('id', follower.id);
            fixed++;
          } else {
            skipped++;
          }
        }),
      );
    }

    return NextResponse.json({
      message: `${fixed} avatares persistidos com sucesso`,
      fixed,
      skipped,
      total: needsFix.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
