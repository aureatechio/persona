import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const apifyToken = process.env.APIFY_API_TOKEN || '';
const COOKIES_ACTOR = 'shareze001/instagram-cookies';

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('instagram_sessions')
      .select('id, ig_username, status, last_verified_at, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    let ig_username: string;
    let cookies: Record<string, unknown>[];

    // Mode 1: Login with username + password (via Apify actor)
    if (body.password) {
      if (!apifyToken) {
        return NextResponse.json({ error: 'APIFY_API_TOKEN não configurado' }, { status: 500 });
      }

      ig_username = String(body.ig_username || body.username || '').replace(/^@/, '').trim();
      const password = String(body.password);

      if (!ig_username || !password) {
        return NextResponse.json({ error: 'Username e senha são obrigatórios' }, { status: 400 });
      }

      // Call Apify actor to login and get cookies
      const encodedActor = encodeURIComponent(COOKIES_ACTOR);
      const apifyUrl = `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items?token=${apifyToken}&timeout=60`;

      const apifyRes = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: ig_username,
          password: password,
        }),
        signal: AbortSignal.timeout(70000),
      });

      if (!apifyRes.ok) {
        const err = await apifyRes.json().catch(() => ({}));
        const errorData = err as { error?: { type?: string; message?: string }; message?: string };
        const errorType = errorData.error?.type || '';
        const errorMsg = errorData.error?.message || errorData.message || `Apify retornou ${apifyRes.status}`;

        if (errorType === 'actor-is-not-rented') {
          return NextResponse.json({
            error: 'Actor de login não está disponível. Use o modo manual (colar cookies).',
          }, { status: 402 });
        }

        return NextResponse.json({ error: `Falha no login: ${errorMsg}` }, { status: 502 });
      }

      // Parse actor result
      const resultData = await apifyRes.json().catch(() => []);
      const results = Array.isArray(resultData) ? resultData : [];

      if (results.length === 0) {
        return NextResponse.json({
          error: 'Login falhou. Verifique username e senha. Se tem 2FA ativado, use o modo manual.',
        }, { status: 401 });
      }

      // The actor returns cookies in the dataset
      const firstResult = results[0] as { cookies?: Record<string, unknown>[]; error?: string; status?: string };

      if (firstResult.error || firstResult.status === 'error') {
        return NextResponse.json({
          error: `Login falhou: ${firstResult.error || 'Credenciais inválidas ou 2FA ativado'}`,
        }, { status: 401 });
      }

      // Extract cookies - actor may return them directly or nested
      const extractedCookies = firstResult.cookies || (Array.isArray(results[0]) ? results[0] : null);

      if (!extractedCookies || !Array.isArray(extractedCookies)) {
        // Maybe the actor returns cookies as the dataset items directly
        const possibleCookies = results.filter((r: Record<string, unknown>) => r.name && r.value);
        if (possibleCookies.length > 0) {
          cookies = possibleCookies as Record<string, unknown>[];
        } else {
          return NextResponse.json({
            error: 'Login falhou. Não foi possível extrair cookies. Tente o modo manual.',
          }, { status: 502 });
        }
      } else {
        cookies = extractedCookies;
      }
    }
    // Mode 2: Manual cookies paste (existing flow)
    else {
      ig_username = String(body.ig_username || '').replace(/^@/, '').trim();
      const session_cookies = body.session_cookies;

      if (!ig_username || !session_cookies) {
        return NextResponse.json({ error: 'ig_username e session_cookies são obrigatórios' }, { status: 400 });
      }

      cookies = typeof session_cookies === 'string' ? JSON.parse(session_cookies) : session_cookies;
    }

    // Validate cookies have sessionid
    const hasSessionId = Array.isArray(cookies)
      ? cookies.some((c: Record<string, unknown>) => c.name === 'sessionid')
      : false;

    if (!hasSessionId) {
      return NextResponse.json({ error: 'Cookies inválidos: sessionid não encontrado. Verifique suas credenciais.' }, { status: 400 });
    }

    // Deactivate any existing active sessions
    await supabase
      .from('instagram_sessions')
      .update({ status: 'expired' })
      .eq('status', 'active');

    // Insert new session
    const { data, error } = await supabase
      .from('instagram_sessions')
      .insert({
        ig_username,
        session_cookies: cookies,
        status: 'active',
        last_verified_at: new Date().toISOString(),
      })
      .select('id, ig_username, status, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('instagram_sessions')
      .update({ status: 'expired' })
      .eq('status', 'active');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
