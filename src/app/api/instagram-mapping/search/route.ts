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
      return NextResponse.json({ error: 'APIFY_API_TOKEN nao configurado' }, { status: 500 });
    }

    const body = await request.json();
    const { username, maxCount = 50 } = body as { username: string; maxCount?: number };

    if (!username) {
      return NextResponse.json({ error: 'username e obrigatorio' }, { status: 400 });
    }

    const cleanUsername = username.replace(/^@/, '').trim();
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
      return NextResponse.json({ error: 'Nenhum seguidor encontrado. Verifique se o perfil e publico.', followers: [] });
    }

    // Return raw list — frontend will filter private
    const followers = data.map((f) => ({
      username: f.username,
      full_name: f.full_name || '',
      is_private: f.is_private,
      is_verified: f.is_verified,
      profile_pic_url: f.profile_pic_url || '',
      ig_id: f.id,
    }));

    return NextResponse.json({ followers, total: followers.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
