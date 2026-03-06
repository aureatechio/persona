-- =============================================================
-- FIX 1: claim_next_selfie now sets locked_by + locked_at
-- Without this, items were immediately eligible for claim_stuck_selfie
-- =============================================================
CREATE OR REPLACE FUNCTION public.claim_next_selfie(worker_id uuid DEFAULT NULL)
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

-- =============================================================
-- FIX 2: claim_stuck_selfie with per-status timeout
--   - generating_lipsync: 10 min (Sync Labs jobs take 5-15min)
--   - all other steps:    60 seconds
-- This prevents re-claiming items that are actively being processed
-- =============================================================
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
      AND (
        locked_at IS NULL
        OR (status = 'generating_lipsync' AND locked_at < now() - interval '10 minutes')
        OR (status != 'generating_lipsync' AND locked_at < now() - interval '60 seconds')
      )
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
