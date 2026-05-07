-- Supia (supermarket video) pipeline tables
--
-- Pipeline: TTS (ElevenLabs Thais) → Lip-sync (Sync Labs over fixed AURORA base.mp4) → final mp4
-- No transcription, no GPT, no compose, no WhatsApp. User input is just the supermarket name.

CREATE TABLE IF NOT EXISTS supia_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  tts_audio_path TEXT,
  lipsync_job_id TEXT,
  lipsync_video_url TEXT,
  final_video_path TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supia_videos_status ON supia_videos(status);
CREATE INDEX IF NOT EXISTS idx_supia_videos_created_at ON supia_videos(created_at DESC);

ALTER TABLE supia_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on supia_videos"
  ON supia_videos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Atomic claim: picks the oldest queued supia video and locks it to the calling worker.
CREATE OR REPLACE FUNCTION public.claim_next_supia(worker_id UUID)
RETURNS SETOF supia_videos
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE supia_videos
  SET status = 'generating_tts',
      locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM supia_videos
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- Crash recovery: reclaim items locked by a dead worker (lock older than 5 minutes
-- and status not terminal).
CREATE OR REPLACE FUNCTION public.claim_stuck_supia(worker_id UUID)
RETURNS SETOF supia_videos
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE supia_videos
  SET locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM supia_videos
    WHERE status NOT IN ('completed','failed','queued')
      AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- Watchdog: auto-fail items stuck in non-terminal status for >30 min.
CREATE OR REPLACE FUNCTION public.watchdog_stuck_supia()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE supia_videos
  SET status = 'failed',
      error_message = COALESCE(error_message, 'Watchdog: stuck >30min'),
      updated_at = now()
  WHERE status NOT IN ('completed','failed')
    AND updated_at < now() - interval '30 minutes';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
