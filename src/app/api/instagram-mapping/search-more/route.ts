import { NextRequest, NextResponse } from 'next/server';

const apifyToken = process.env.APIFY_API_TOKEN || '';
const ACTOR_ID = 'datadoping/instagram-followers-scraper';

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
    const {
      username,
      existingCount = 100,
      batchSize = 10,
      excludeUsernames = [],
    } = body as {
      username: string;
      existingCount?: number;
      batchSize?: number;
      excludeUsernames?: string[];
    };

    if (!username) {
      return NextResponse.json({ error: 'username é obrigatório' }, { status: 400 });
    }

    const cleanUsername = username.replace(/^@/, '').trim();
    const excludeSet = new Set(excludeUsernames.map((u: string) => u.toLowerCase()));

    // Request more from Apify: existing + batch + buffer
    const buffer = 20;
    let requestCount = existingCount + batchSize + buffer;
    const maxRequestCount = existingCount + batchSize + 200; // safety cap

    let newFollowers: Array<{
      username: string;
      full_name: string;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url: string;
      ig_id: string;
    }> = [];

    // Try fetching, increase buffer if not enough new followers found
    while (newFollowers.length < batchSize && requestCount <= maxRequestCount) {
      const encodedActor = encodeURIComponent(ACTOR_ID);
      const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items?token=${apifyToken}&timeout=300`;

      const apifyRes = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: [cleanUsername],
          max_count: requestCount,
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
        return NextResponse.json({ newFollowers: [], total: 0, hasMore: false });
      }

      // Filter out already-known usernames
      newFollowers = data
        .filter((f) => !excludeSet.has(f.username.toLowerCase()))
        .map((f) => ({
          username: f.username,
          full_name: f.full_name || '',
          is_private: f.is_private,
          is_verified: f.is_verified,
          profile_pic_url: f.profile_pic_url || '',
          ig_id: f.id,
        }));

      // If we got enough or Apify returned fewer than requested (no more followers exist)
      if (newFollowers.length >= batchSize || data.length < requestCount) {
        break;
      }

      // Increase request count and retry
      requestCount += 50;
    }

    // Limit to batchSize
    const batch = newFollowers.slice(0, batchSize);

    return NextResponse.json({
      newFollowers: batch,
      total: batch.length,
      hasMore: newFollowers.length > batchSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
