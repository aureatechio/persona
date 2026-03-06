-- Reduce claim_stuck_selfie timeout from 10 minutes to 30 seconds
-- With a single worker, 30s is safe and prevents items from being stuck too long
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
      AND (locked_at IS NULL OR locked_at < now() - interval '30 seconds')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
