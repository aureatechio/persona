import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const apifyToken = process.env.APIFY_API_TOKEN || '';
const ACTOR_ID = 'clothefobia/instagram-auto-follow';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!apifyToken) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN não configurado' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { targetUsername } = body as { targetUsername: string };

    if (!targetUsername) {
      return NextResponse.json({ error: 'targetUsername é obrigatório' }, { status: 400 });
    }

    // Get active session
    const { data: session } = await supabase
      .from('instagram_sessions')
      .select('id, session_cookies')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'Nenhuma sessão Instagram ativa. Conecte sua conta primeiro.' }, { status: 401 });
    }

    // Fire-and-forget: start actor run without waiting for completion
    const encodedActor = encodeURIComponent(ACTOR_ID);
    const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/runs?token=${apifyToken}`;

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        insta_cookie: session.session_cookies,
        Instagram_UserName_List: [targetUsername],
        Delay: '3',
        Max_Daily_Limit: '50',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!apifyRes.ok) {
      const err = await apifyRes.json().catch(() => ({}));
      const errorData = err as { error?: { type?: string; message?: string }; message?: string };
      const errorType = errorData.error?.type || '';
      const errorMsg = errorData.error?.message || errorData.message || `Apify retornou ${apifyRes.status}`;

      // Actor not rented
      if (errorType === 'actor-is-not-rented' || apifyRes.status === 403) {
        return NextResponse.json({
          error: 'Actor de follow não está assinado no Apify. Acesse o Apify e assine o actor clothefobia/instagram-auto-follow.',
        }, { status: 402 });
      }

      // Session expired
      if (apifyRes.status === 401 || String(errorMsg).toLowerCase().includes('login')) {
        await supabase
          .from('instagram_sessions')
          .update({ status: 'expired' })
          .eq('id', session.id);
        return NextResponse.json({ error: 'Sessão Instagram expirada. Reconecte sua conta.' }, { status: 401 });
      }

      return NextResponse.json({ error: String(errorMsg) }, { status: 502 });
    }

    // Mark follower as followed in DB
    await supabase
      .from('instagram_followers')
      .update({
        followed: true,
        followed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('username', targetUsername);

    return NextResponse.json({ success: true, username: targetUsername });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
