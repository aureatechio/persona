import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { persistAvatarToStorage } from '@/lib/instagram-mapping/persist-avatar';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const apifyToken = process.env.APIFY_API_TOKEN || '';

const ACTOR_ID = 'datadoping/instagram-followers-scraper';

interface ApifyFollower {
  full_name: string;
  username: string;
  id: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
  follower_of: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!apifyToken) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN nao configurado' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { accountId, username, maxCount = 5000 } = body as {
      accountId: string;
      username: string;
      maxCount?: number;
    };

    if (!accountId || !username) {
      return NextResponse.json({ error: 'accountId e username sao obrigatorios' }, { status: 400 });
    }

    const cleanUsername = username.replace(/^@/, '').trim();
    const safeMaxCount = Math.max(50, maxCount);

    // Get existing usernames to track truly new imports
    const { data: existingFollowers } = await supabase
      .from('instagram_followers')
      .select('username')
      .eq('account_id', accountId);

    const existingUsernames = new Set((existingFollowers || []).map((f) => f.username));

    // Call Apify actor - fetch ALL followers (high limit)
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

    const apifyData = (await apifyRes.json()) as ApifyFollower[];

    if (!Array.isArray(apifyData) || apifyData.length === 0) {
      return NextResponse.json({ error: 'Nenhum seguidor encontrado. Verifique se o perfil e publico.', imported: 0 });
    }

    // Filter only NEW followers (not already in DB)
    const newFollowers = apifyData.filter((f) => !existingUsernames.has(f.username));
    const alreadyExisted = apifyData.length - newFollowers.length;

    // Insert only new followers (upsert as safety net)
    const rows = newFollowers.map((f) => ({
      account_id: accountId,
      username: f.username,
      display_name: f.full_name || null,
      avatar_url: f.profile_pic_url || null,
      category: 'outro' as const,
      category_label: 'Outro',
      metadata_json: {
        ig_id: f.id,
        is_private: f.is_private,
        is_verified: f.is_verified,
      },
    }));

    let imported = 0;
    if (rows.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { data, error } = await supabase
          .from('instagram_followers')
          .upsert(batch, { onConflict: 'account_id,username', ignoreDuplicates: true })
          .select('id');

        if (error) {
          console.error('Batch insert error:', error.message);
        } else {
          imported += data?.length || 0;
        }
      }
    }

    // ── Avatar persistence: only for NEW followers ──
    if (newFollowers.length > 0) {
      const cdnUrlMap = new Map<string, string>();
      for (const f of newFollowers) {
        if (f.profile_pic_url) {
          cdnUrlMap.set(f.username, f.profile_pic_url);
        }
      }

      const { data: dbFollowers } = await supabase
        .from('instagram_followers')
        .select('id, username')
        .eq('account_id', accountId)
        .in('username', newFollowers.map((f) => f.username));

      if (dbFollowers && dbFollowers.length > 0) {
        const AVATAR_BATCH = 10;
        const withCdn = dbFollowers.filter((f) => cdnUrlMap.has(f.username));

        for (let i = 0; i < withCdn.length; i += AVATAR_BATCH) {
          const batch = withCdn.slice(i, i + AVATAR_BATCH);
          await Promise.allSettled(
            batch.map(async (follower) => {
              const cdnUrl = cdnUrlMap.get(follower.username);
              if (!cdnUrl) return;
              const permanentUrl = await persistAvatarToStorage(cdnUrl, follower.id);
              if (permanentUrl) {
                await supabase
                  .from('instagram_followers')
                  .update({ avatar_url: permanentUrl, updated_at: new Date().toISOString() })
                  .eq('id', follower.id);
              }
            }),
          );
        }
      }
    }

    // Update follower count on account
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

    // Build response message
    let message = '';
    if (imported > 0 && alreadyExisted > 0) {
      message = `${imported} novos seguidores importados (${alreadyExisted} ja existiam)`;
    } else if (imported > 0) {
      message = `${imported} seguidores importados com sucesso`;
    } else {
      message = `Nenhum novo seguidor encontrado (${alreadyExisted} ja importados)`;
    }

    return NextResponse.json({
      imported,
      total: apifyData.length,
      alreadyExisted,
      message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
