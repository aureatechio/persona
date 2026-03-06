-- Add retry_count column for reliable retry tracking (replaces [RETRY] tag counting)
ALTER TABLE video_selfies ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
