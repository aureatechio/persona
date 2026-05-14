-- =============================================================================
-- Hardening: protege o pool quando uma das chaves Sync Labs é revogada ou
-- bloqueada pelo provedor (401/402).
--
-- Hoje, sem essa proteção, o algoritmo least-loaded pode re-escolher a mesma
-- chave ruim no retry (o slot é liberado a cada falha, então load=0 e ela vence
-- o tiebreak por created_at). O job acaba estourando retry_count sem nunca
-- experimentar outra chave.
--
-- Mudanças:
--   1. Coluna `blocked_until TIMESTAMPTZ` em kling_keys.
--   2. `claim_kling_slot` filtra chaves bloqueadas.
--   3. RPC `block_kling_key(p_key_id, p_minutes)` para o worker bloquear uma
--      chave após erro 401/402.
-- =============================================================================

ALTER TABLE kling_keys
  ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN kling_keys.blocked_until IS
  'Quando setado para o futuro, a chave fica fora do pool até essa hora. Definido pelo worker em erros 401/402 (chave revogada/sem cota).';

CREATE OR REPLACE FUNCTION public.claim_kling_slot(p_selfie_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key RECORD;
BEGIN
  -- Crash recovery
  UPDATE video_selfies
  SET kling_key_id = NULL, kling_started_at = NULL
  WHERE id = p_selfie_id
    AND kling_started_at IS NOT NULL;

  -- Least-loaded entre as chaves ATIVAS e NÃO BLOQUEADAS
  FOR v_key IN
    WITH key_load AS (
      SELECT
        k.id,
        k.max_concurrent,
        k.created_at,
        (
          SELECT COUNT(*)
          FROM video_selfies vs
          WHERE vs.kling_key_id = k.id
            AND vs.kling_started_at IS NOT NULL
            AND vs.status = 'generating_lipsync'
            AND vs.kling_started_at > NOW() - INTERVAL '40 minutes'
        ) AS active_count
      FROM kling_keys k
      WHERE k.is_active = TRUE
        AND (k.blocked_until IS NULL OR k.blocked_until < NOW())
    )
    SELECT kl.id, kl.max_concurrent, kl.active_count
    FROM key_load kl
    JOIN kling_keys k ON k.id = kl.id
    ORDER BY kl.active_count ASC, kl.created_at ASC
    FOR UPDATE OF k SKIP LOCKED
  LOOP
    IF v_key.active_count < v_key.max_concurrent THEN
      UPDATE video_selfies
      SET kling_key_id = v_key.id,
          kling_started_at = NOW()
      WHERE id = p_selfie_id;

      RETURN v_key.id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- RPC para o worker bloquear uma chave por N minutos após 401/402.
-- Usa GREATEST para não encurtar um bloqueio já existente.
CREATE OR REPLACE FUNCTION public.block_kling_key(p_key_id UUID, p_minutes INT DEFAULT 15)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_until TIMESTAMPTZ;
BEGIN
  UPDATE kling_keys
  SET blocked_until = GREATEST(
    COALESCE(blocked_until, NOW()),
    NOW() + (p_minutes || ' minutes')::INTERVAL
  )
  WHERE id = p_key_id
  RETURNING blocked_until INTO v_until;

  RETURN v_until;
END;
$$;
