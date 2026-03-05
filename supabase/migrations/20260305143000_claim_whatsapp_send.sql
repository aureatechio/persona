-- Atomic WhatsApp send claim: sets whatsapp_sent=true only if not already sent.
-- Returns true if this caller "won" the claim, false if already sent.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_send(selfie_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected int;
BEGIN
  UPDATE video_selfies
  SET whatsapp_sent = true,
      whatsapp_sent_at = now(),
      updated_at = now()
  WHERE id = selfie_id
    AND (whatsapp_sent IS NULL OR whatsapp_sent = false);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;
