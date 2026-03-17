-- Arena Prompts: AI prompts stored in Supabase for hot-reload without redeploy
CREATE TABLE IF NOT EXISTS arena_prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookup for active prompts
CREATE INDEX IF NOT EXISTS idx_arena_prompts_active ON arena_prompts (id) WHERE is_active = true;

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_arena_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_arena_prompts_updated_at
  BEFORE UPDATE ON arena_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_arena_prompts_updated_at();
