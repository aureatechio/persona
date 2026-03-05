import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const apifyToken = process.env.APIFY_API_TOKEN || '';
const FOLLOW_ACTOR = 'clothefobia/instagram-auto-follow';
const DM_ACTOR = 'am_production/instagram-direct-messages-dms-automation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface BulkTarget {
  username: string;
  message?: string;
}

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
    const { action, targets } = body as {
      action: 'follow' | 'send-dm';
      targets: BulkTarget[];
    };

    if (!action || !targets || targets.length === 0) {
      return NextResponse.json({ error: 'action e targets são obrigatórios' }, { status: 400 });
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

    const results: Array<{ username: string; success: boolean; error?: string }> = [];

    if (action === 'follow') {
      // Fire-and-forget: start follow actor without waiting
      const encodedActor = encodeURIComponent(FOLLOW_ACTOR);
      const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/runs?token=${apifyToken}`;

      const usernames = targets.map((t) => t.username);

      try {
        const apifyRes = await fetch(apifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            insta_cookie: session.session_cookies,
            Instagram_UserName_List: usernames,
            Delay: '5',
            Max_Daily_Limit: '50',
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!apifyRes.ok) {
          const err = await apifyRes.json().catch(() => ({}));
          const errorData = err as { error?: { type?: string; message?: string }; message?: string };
          const errorType = errorData.error?.type || '';
          const errorMsg = errorData.error?.message || errorData.message || `Apify retornou ${apifyRes.status}`;

          if (errorType === 'actor-is-not-rented') {
            return NextResponse.json({
              error: 'Actor não está assinado no Apify. Assine antes de usar.',
            }, { status: 402 });
          }

          for (const u of usernames) {
            results.push({ username: u, success: false, error: String(errorMsg) });
          }
        } else {
          // Mark all as followed
          for (const u of usernames) {
            await supabase
              .from('instagram_followers')
              .update({
                followed: true,
                followed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('username', u);

            results.push({ username: u, success: true });
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro';
        for (const u of usernames) {
          results.push({ username: u, success: false, error: errorMsg });
        }
      }
    } else if (action === 'send-dm') {
      // DM actor (am_production) — fire all runs in parallel
      const rawCookies = session.session_cookies as Record<string, unknown>[];
      const cleanCookies = normalizeCookies(rawCookies);
      const encodedActor = encodeURIComponent(DM_ACTOR);
      const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/runs?token=${apifyToken}`;

      const dmPromises = targets.map(async (target) => {
        if (!target.message) {
          return { username: target.username, success: false, error: 'Mensagem vazia' };
        }

        try {
          const apifyRes = await fetch(apifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              INSTAGRAM_COOKIES: cleanCookies,
              influencers: [target.username],
              messages: [target.message],
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (apifyRes.ok) {
            await supabase
              .from('instagram_followers')
              .update({
                messaged: true,
                messaged_at: new Date().toISOString(),
                last_message: target.message,
                updated_at: new Date().toISOString(),
              })
              .eq('username', target.username);

            // Log to message_logs for the monitoring dashboard
            const { data: follower } = await supabase
              .from('instagram_followers')
              .select('id, account_id')
              .eq('username', target.username)
              .limit(1)
              .maybeSingle();

            if (follower) {
              await supabase.from('message_logs').insert({
                follower_id: follower.id,
                account_id: follower.account_id,
                target_username: target.username,
                channel: 'instagram_dm',
                message_content: target.message,
                status: 'sent',
                sent_at: new Date().toISOString(),
              });
            }

            return { username: target.username, success: true };
          } else {
            const err = await apifyRes.json().catch(() => ({}));
            const errorData = err as { error?: { type?: string; message?: string }; message?: string };
            return {
              username: target.username,
              success: false,
              error: errorData.error?.message || errorData.message as string || `Status ${apifyRes.status}`,
            };
          }
        } catch (err) {
          return {
            username: target.username,
            success: false,
            error: err instanceof Error ? err.message : 'Erro',
          };
        }
      });

      results.push(...await Promise.all(dmPromises));
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      results,
      summary: { total: results.length, success: successCount, failed: failCount },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
