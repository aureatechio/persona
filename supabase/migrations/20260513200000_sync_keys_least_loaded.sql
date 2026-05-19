-- =============================================================================
-- Sync Labs key pool: troca o algoritmo de claim de "fill-first" para
-- "least-loaded" (distribui de verdade entre as chaves ativas).
--
-- A função `claim_kling_slot` mantém o nome legado por compatibilidade com o
-- worker Python e os RPCs já chamados. A tabela `kling_keys` também segue com
-- o nome antigo — hoje guarda credenciais Sync Labs (api.sync.so), não Kling.
--
-- Antes:
--   ORDER BY created_at ASC → a primeira chave criada enche até o limite
--   antes de o claim cair na segunda. Resultado: distribuição desbalanceada.
--
-- Depois:
--   ORDER BY active_count ASC, created_at ASC → o claim sempre vai para a
--   chave com menos slots ativos no momento; empate desempata pela ordem
--   de criação (estável). Resultado: distribuição balanceada.
--
-- O lock `FOR UPDATE OF k SKIP LOCKED` continua serializando claims
-- concorrentes da MESMA chave — workers que disputam o mesmo "vencedor"
-- pulam para o próximo candidato em vez de bloquear.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_kling_slot(p_selfie_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key RECORD;
BEGIN
  -- Crash recovery: libera slot anterior deste selfie (caso o worker tenha
  -- caído sem chamar release_kling_slot)
  UPDATE video_selfies
  SET kling_key_id = NULL, kling_started_at = NULL
  WHERE id = p_selfie_id
    AND kling_started_at IS NOT NULL;

  -- Itera as chaves ativas ordenadas por carga atual (menor → maior).
  -- active_count é calculado uma vez por chave dentro do snapshot do SELECT
  -- e reaproveitado no IF abaixo. Se entre o cálculo e o claim a chave
  -- encheu (race), o IF descarta e o loop tenta a próxima.
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

  -- Todas as chaves no limite
  RETURN NULL;
END;
$$;
