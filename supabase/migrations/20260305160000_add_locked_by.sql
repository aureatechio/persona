-- Add a processing lock to prevent multiple workers from picking up the same selfie.
-- locked_by: UUID of the worker instance currently processing this selfie.
-- locked_at: timestamp when the lock was acquired (used for expiry check).

ALTER TABLE video_selfies ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE video_selfies ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Updated claim_next_selfie: now also sets locked_by
CREATE OR REPLACE FUNCTION public.claim_next_selfie(worker_id uuid)
RETURNS SETOF video_selfies
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE video_selfies
  SET status = 'transcribing',
      locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM video_selfies
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- New: claim a stuck/resumable selfie (only if lock expired > 10 min)
CREATE OR REPLACE FUNCTION public.claim_stuck_selfie(worker_id uuid)
RETURNS SETOF video_selfies
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE video_selfies
  SET locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM video_selfies
    WHERE status IN ('transcribing','generating_text','generating_tts','generating_lipsync','composing','sending')
      AND whatsapp_sent IS NOT TRUE
      AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
