-- Watchdog: automatically fail selfies stuck for >30 minutes.
-- Called by the worker on each poll cycle to prevent infinite retry loops.
CREATE OR REPLACE FUNCTION public.watchdog_stuck_selfies()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH stuck AS (
    UPDATE video_selfies
    SET status = 'failed',
        error_message = 'Watchdog: stuck for >30 minutes (locked_at: ' || locked_at::text || ')',
        locked_by = NULL,
        locked_at = NULL,
        updated_at = now()
    WHERE status IN ('transcribing','generating_text','generating_tts','generating_lipsync','composing','sending')
      AND whatsapp_sent IS NOT TRUE
      AND locked_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*)::integer FROM stuck;
$$;
