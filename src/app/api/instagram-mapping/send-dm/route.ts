import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const apifyToken = process.env.APIFY_API_TOKEN || '';
const ACTOR_ID = 'am_production/instagram-direct-messages-dms-automation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Normalize EditThisCookie format to Playwright-compatible cookies
function normalizeCookies(cookies: Record<string, unknown>[]) {
  return cookies.map((c) => {
    const sameSite = String(c.sameSite || '').toLowerCase();
    let normalizedSameSite = 'None';
    if (sameSite === 'strict') normalizedSameSite = 'Strict';
    else if (sameSite === 'lax') normalizedSameSite = 'Lax';

    return {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? false,
      sameSite: normalizedSameSite,
      ...(c.expirationDate ? { expires: c.expirationDate } : {}),
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!apifyToken) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN não configurado' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { targetUsername, message } = body as { targetUsername: string; message: string };

    if (!targetUsername || !message) {
      return NextResponse.json({ error: 'targetUsername e message são obrigatórios' }, { status: 400 });
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

    // Normalize cookies for Playwright (am_production actor uses Playwright)
    const rawCookies = session.session_cookies as Record<string, unknown>[];
    const cleanCookies = normalizeCookies(rawCookies);

    // Fire-and-forget: start actor run without waiting for completion
    const encodedActor = encodeURIComponent(ACTOR_ID);
    const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/runs?token=${apifyToken}`;

    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        INSTAGRAM_COOKIES: cleanCookies,
        influencers: [targetUsername],
        messages: [message],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!apifyRes.ok) {
      const err = await apifyRes.json().catch(() => ({}));
      const errorData = err as { error?: { type?: string; message?: string }; message?: string };
      const errorType = errorData.error?.type || '';
      const errorMsg = errorData.error?.message || errorData.message || `Apify retornou ${apifyRes.status}`;

      if (errorType === 'actor-is-not-rented' || apifyRes.status === 403) {
        return NextResponse.json({
          error: 'Actor de DM não está assinado no Apify. Acesse o Apify e assine o actor am_production/instagram-direct-messages-dms-automation.',
        }, { status: 402 });
      }

      if (apifyRes.status === 401 || String(errorMsg).toLowerCase().includes('login')) {
        await supabase
          .from('instagram_sessions')
          .update({ status: 'expired' })
          .eq('id', session.id);
        return NextResponse.json({ error: 'Sessão Instagram expirada. Reconecte sua conta.' }, { status: 401 });
      }

      return NextResponse.json({ error: String(errorMsg) }, { status: 502 });
    }

    // Actor started successfully — mark as messaged immediately
    await supabase
      .from('instagram_followers')
      .update({
        messaged: true,
        messaged_at: new Date().toISOString(),
        last_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('username', targetUsername);

    // Log to message_logs for the monitoring dashboard
    const { data: follower } = await supabase
      .from('instagram_followers')
      .select('id, account_id')
      .eq('username', targetUsername)
      .limit(1)
      .maybeSingle();

    if (follower) {
      await supabase.from('message_logs').insert({
        follower_id: follower.id,
        account_id: follower.account_id,
        target_username: targetUsername,
        channel: 'instagram_dm',
        message_content: message,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, username: targetUsername });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
