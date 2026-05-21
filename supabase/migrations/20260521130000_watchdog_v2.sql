-- =============================================================================
-- Watchdog v2: cobre mais cenários que ficavam órfãos.
--
-- Problemas identificados com o watchdog v1:
--
-- 1. `uploading` não estava na lista. Selfies onde o usuário fechou o navegador
--    durante o upload ficavam pra sempre (vimos 3 itens de 7–41 dias atrás).
--
-- 2. O filtro `whatsapp_sent IS NOT TRUE` excluía linhas que tinham o flag
--    setado por `claim_whatsapp_send` mas onde o POST do UAZAPI estourou
--    timeout (ConnectTimeout/ReadTimeout vazavam como exception não-tratada).
--    Essas linhas ficavam em `sending` para sempre — vimos 6 casos de até
--    65 dias. Agora autocompleto essas: se o flag está true e está parada
--    há >30min, assume que a entrega foi feita e marca como completed.
--
-- 3. Roda em duas passadas com timeouts diferentes:
--    - `uploading`: 10 minutos (upload em geral leva <2min, ser generoso)
--    - intermediários: 30 minutos (mantém comportamento atual)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.watchdog_stuck_selfies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_count integer := 0;
  v_completed_count integer := 0;
  v_upload_failed integer := 0;
BEGIN
  -- 1. Auto-completa: WhatsApp já saiu mas worker perdeu o tracking
  --    (network exception entre o claim e o reset). Risco: marcar
  --    completed uma linha onde o envio realmente não saiu. Mitigação:
  --    só faz isso se whatsapp_sent=true (i.e., o claim atômico marcou,
  --    então a tentativa de envio começou e UAZAPI provavelmente
  --    completou o lado dela).
  WITH done AS (
    UPDATE video_selfies
    SET status = 'completed',
        error_message = COALESCE(error_message, '') ||
                        ' [watchdog: auto-completed (whatsapp_sent=true, stuck >30min)]',
        locked_by = NULL,
        locked_at = NULL,
        updated_at = now()
    WHERE status = 'sending'
      AND whatsapp_sent = TRUE
      AND locked_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*)::int INTO v_completed_count FROM done;

  -- 2. Auto-falha: travado em algum passo intermediário do pipeline
  --    sem ter chegado a marcar whatsapp_sent. Mantém comportamento do v1.
  WITH failed AS (
    UPDATE video_selfies
    SET status = 'failed',
        error_message = COALESCE(error_message, '') ||
                        ' [watchdog: stuck >30min in ' || status || ']',
        locked_by = NULL,
        locked_at = NULL,
        kling_key_id = NULL,
        kling_started_at = NULL,
        updated_at = now()
    WHERE status IN (
        'transcribing','generating_text','generating_tts',
        'generating_lipsync','composing','sending'
      )
      AND whatsapp_sent IS NOT TRUE
      AND locked_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*)::int INTO v_failed_count FROM failed;

  -- 3. Auto-falha: uploads abandonados pelo usuário (browser fechou,
  --    sinal caiu, etc.). Timeout menor pois upload em si é rápido.
  WITH abandoned AS (
    UPDATE video_selfies
    SET status = 'failed',
        error_message = 'watchdog: upload abandonado (>10min sem confirm)',
        updated_at = now()
    WHERE status = 'uploading'
      AND updated_at < now() - interval '10 minutes'
    RETURNING id
  )
  SELECT count(*)::int INTO v_upload_failed FROM abandoned;

  RETURN v_failed_count + v_completed_count + v_upload_failed;
END;
$$;

COMMENT ON FUNCTION public.watchdog_stuck_selfies() IS
  'v2: auto-completa whatsapp_sent órfãos, auto-falha pipeline travado, auto-falha uploads abandonados.';
