-- Atomic claim function: picks the oldest queued selfie and sets it to 'transcribing'
-- Returns the claimed row or empty set if nothing to claim.
CREATE OR REPLACE FUNCTION public.claim_next_selfie()
RETURNS SETOF video_selfies
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE video_selfies
  SET status = 'transcribing',
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
