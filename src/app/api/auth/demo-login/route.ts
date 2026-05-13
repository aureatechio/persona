import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://sobfplitrzgggzqsycew.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTY4NTgsImV4cCI6MjA4Mzg5Mjg1OH0.0UOS6R0j7QwO6N7QIgrksA9iXr_82kL2a1QGjdTlsGA';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxNjg1OCwiZXhwIjoyMDgzODkyODU4fQ.MLZa1crIU7Uid70GFsRPPkoWZ1TgzDDSej99eYD3ctg';

const DEMO_LOGIN_KEY =
  process.env.DEMO_LOGIN_KEY ||
  'demo-am-2026';

const DEMO_USER = {
  email: 'demo-am@aureatech.io',
  password: 'DemoAM_PL2026_xK7nQ9pR3sL5vM8b',
  name: 'Demo AM',
  user_type: 'normal' as const,
  ideology: 'direita' as const,
  state: 'AM',
};

async function ensureDemoUser(): Promise<{ userId: string | null; error?: string }> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) {
    return { userId: null, error: listError.message };
  }

  let userId: string | null = null;
  const existing = listed.users.find((u) => u.email === DEMO_USER.email);

  if (existing) {
    userId = existing.id;
    // Garante senha sincronizada (caso tenha sido trocada via dashboard)
    await admin.auth.admin.updateUserById(userId, {
      password: DEMO_USER.password,
      email_confirm: true,
    });
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      email_confirm: true,
      user_metadata: { name: DEMO_USER.name },
    });
    if (createError || !created.user) {
      return { userId: null, error: createError?.message || 'Failed to create demo user' };
    }
    userId = created.user.id;
  }

  const { error: upsertError } = await admin.from('users').upsert({
    id: userId,
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    user_type: DEMO_USER.user_type,
    ideology: DEMO_USER.ideology,
    state: DEMO_USER.state,
  });
  if (upsertError) {
    return { userId, error: `Profile upsert: ${upsertError.message}` };
  }

  return { userId };
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (key !== DEMO_LOGIN_KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }

  const ensured = await ensureDemoUser();
  if (ensured.error) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  const redirectTo = request.nextUrl.searchParams.get('next') || '/arena';
  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_USER.email,
    password: DEMO_USER.password,
  });

  if (signInError) {
    return NextResponse.json(
      { error: `Sign in failed: ${signInError.message}` },
      { status: 500 },
    );
  }

  return response;
}
