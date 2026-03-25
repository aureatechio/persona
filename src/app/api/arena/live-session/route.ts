// Arena Live Session API — track real-time analysis sessions

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST: create or update a live session
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, user_id, user_name, user_email, status, phase, processed_count, total_count, platform, region, error, score } = body;

  // Update existing session
  if (id) {
    const update: any = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (phase) update.phase = phase;
    if (processed_count !== undefined) update.processed_count = processed_count;
    if (total_count !== undefined) update.total_count = total_count;
    if (error !== undefined) update.error = error;
    if (score !== undefined) update.score = score;
    if (status === 'complete' || status === 'error') update.completed_at = new Date().toISOString();

    await supabaseAdmin.from('arena_live_sessions').update(update).eq('id', id);
    return Response.json({ id });
  }

  // Create new session
  const { data, error: insertErr } = await supabaseAdmin
    .from('arena_live_sessions')
    .insert({
      user_id: user_id || 'anonymous',
      user_name: user_name || '',
      user_email: user_email || '',
      status: 'processing',
      phase: phase || 'collecting',
      processed_count: 0,
      total_count: 0,
      platform: platform || '',
      region: region || '',
    })
    .select('id')
    .single();

  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });
  return Response.json({ id: data.id });
}

// GET: list active and recent sessions
export async function GET() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Active sessions (processing, updated in last 5 min)
  const { data: active } = await supabaseAdmin
    .from('arena_live_sessions')
    .select('*')
    .eq('status', 'processing')
    .gte('updated_at', fiveMinAgo)
    .order('started_at', { ascending: false });

  // Recent completed/error sessions (last 24h)
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('arena_live_sessions')
    .select('*')
    .in('status', ['complete', 'error'])
    .gte('completed_at', last24h)
    .order('completed_at', { ascending: false })
    .limit(50);

  return Response.json({
    active: active || [],
    recent: recent || [],
  });
}
