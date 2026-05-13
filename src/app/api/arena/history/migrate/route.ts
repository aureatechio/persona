// Temporary migration endpoint — creates arena_analyses table
// DELETE THIS FILE after running once

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // Check if table exists by trying to query it
    const { error: checkError } = await supabaseAdmin
      .from('arena_analyses')
      .select('id')
      .limit(1);

    if (!checkError) {
      return Response.json({ status: 'Table already exists' });
    }

    // Table doesn't exist — we can't create via supabase-js directly
    // Return SQL for manual execution in Supabase Dashboard
    return Response.json({
      status: 'Table does not exist',
      message: 'Run this SQL in Supabase Dashboard > SQL Editor:',
      sql: `
CREATE TABLE IF NOT EXISTS arena_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  question TEXT NOT NULL DEFAULT '',
  content_meta JSONB DEFAULT '{}',
  analise_data JSONB NOT NULL DEFAULT '{}',
  arena_data JSONB DEFAULT '{}',
  chat_messages JSONB DEFAULT '[]',
  media_preview TEXT
);

CREATE INDEX IF NOT EXISTS idx_arena_analyses_user_id ON arena_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_analyses_created_at ON arena_analyses(created_at DESC);

ALTER TABLE arena_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own analyses" ON arena_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON arena_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses" ON arena_analyses
  FOR UPDATE USING (auth.uid() = user_id);
      `.trim(),
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
