-- Auto-confirm de uploads órfãos.
--
-- O fluxo cria uma row em video_selfies com status='uploading', dá ao
-- eleitor uma signed URL pra fazer PUT direto no Storage, e o frontend
-- chama /api/selfie-video/confirm-upload pra promover pra 'queued'.
--
-- Em conexão móvel ruim (zona AM, por exemplo), o eleitor frequentemente
-- perde a rede DEPOIS do PUT mas ANTES do confirm — a row fica zumbi em
-- 'uploading' pra sempre.
--
-- Esta função roda periodicamente no watchdog do worker:
--   - Se arquivo está no Storage E row está em 'uploading' há > 2 min
--     → promove pra 'queued' (worker vai pegar)
--   - Se SEM arquivo no Storage E em 'uploading' há > 10 min → 'failed'
--     com error_message claro (não vai mais ficar pendurado no monitor)

CREATE OR REPLACE FUNCTION auto_confirm_uploads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  confirmed_count int := 0;
  failed_count int := 0;
BEGIN
  -- 1. Promove uploads com arquivo no Storage
  WITH confirmable AS (
    SELECT vs.id
    FROM video_selfies vs
    INNER JOIN storage.objects so
      ON so.bucket_id = 'voice-models'
     AND so.name = vs.selfie_video_path
    WHERE vs.status = 'uploading'
      AND vs.created_at < now() - interval '2 minutes'
  ),
  upd AS (
    UPDATE video_selfies
       SET status = 'queued',
           updated_at = now()
     WHERE id IN (SELECT id FROM confirmable)
    RETURNING 1
  )
  SELECT count(*) INTO confirmed_count FROM upd;

  -- 2. Marca como failed uploads que nunca chegaram ao Storage
  WITH stale AS (
    SELECT vs.id
    FROM video_selfies vs
    WHERE vs.status = 'uploading'
      AND vs.created_at < now() - interval '10 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM storage.objects so
        WHERE so.bucket_id = 'voice-models'
          AND so.name = vs.selfie_video_path
      )
  ),
  upd2 AS (
    UPDATE video_selfies
       SET status = 'failed',
           error_message = 'upload_timeout: arquivo nao chegou no storage (provavel rede do eleitor)',
           updated_at = now()
     WHERE id IN (SELECT id FROM stale)
    RETURNING 1
  )
  SELECT count(*) INTO failed_count FROM upd2;

  RETURN jsonb_build_object(
    'confirmed', confirmed_count,
    'failed', failed_count
  );
END;
$$;
