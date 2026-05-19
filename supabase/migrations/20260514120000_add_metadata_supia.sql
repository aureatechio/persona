-- Generic passthrough bag for external integrations (n8n → Creatomate flow).
-- Callers can attach arbitrary key/value data (logo_url, banner_url, theme,
-- whatever Creatomate needs) and the worker echoes the entire object back in
-- the webhook callback. The pipeline never reads from it.
ALTER TABLE supia_videos
  ADD COLUMN IF NOT EXISTS metadata JSONB;
