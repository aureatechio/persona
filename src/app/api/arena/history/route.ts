// Arena History API — GET list, POST save/update, GET single (?id=xxx)

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';

// Helper: get authenticated user from cookies (PWA) or Bearer token (mobile)
async function getUser(req: NextRequest) {
  // Try Bearer token first (mobile app)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) return user;
  }

  // Fallback to cookie auth (PWA)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET: list analyses or get single by id
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  // Single analysis
  if (id) {
    const { data, error } = await supabaseAdmin
      .from('arena_analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 404 });
    return Response.json(data);
  }

  // List (lightweight — only headline, score, date, platform)
  const { data, error } = await supabaseAdmin
    .from('arena_analyses')
    .select('id, created_at, question, content_meta, analise_data')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Extract lightweight info
  const list = (data || []).map((row: any) => {
    const platforms = Array.isArray(row.content_meta?.mediaType)
      ? row.content_meta.mediaType.join(', ')
      : row.content_meta?.mediaType || '';
    return {
      id: row.id,
      created_at: row.created_at,
      headline: row.analise_data?.headline || 'Análise',
      question: row.question || '',
      score: row.analise_data?.score || 0,
      platform: platforms,
    };
  });

  return Response.json(list);
}

// POST: save or update analysis
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const { id, question, content_meta, analise_data, arena_data, chat_messages, media_preview } = body;

  // Update existing
  if (id) {
    const updateData: any = {};
    if (chat_messages !== undefined) updateData.chat_messages = chat_messages;
    if (analise_data !== undefined) updateData.analise_data = analise_data;
    if (arena_data !== undefined) updateData.arena_data = arena_data;

    const { error } = await supabaseAdmin
      .from('arena_analyses')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ id, updated: true });
  }

  // Insert new
  const { data, error } = await supabaseAdmin
    .from('arena_analyses')
    .insert({
      user_id: user.id,
      question: question || '',
      content_meta: content_meta || {},
      analise_data: analise_data || {},
      arena_data: arena_data || {},
      chat_messages: chat_messages || [],
      media_preview: media_preview || null,
    })
    .select('id')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id, created: true });
}
