-- External integrations (n8n chatbot etc.): allow callers to attach an opaque
-- user_id for correlation and a webhook_url that the worker posts to when the
-- pipeline reaches a terminal status (completed or failed).
ALTER TABLE supia_videos
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_delivered_at TIMESTAMPTZ;
