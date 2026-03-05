-- ============================================================
-- Kling AI Key Pool: distribui jobs entre 3 chaves (max 3/chave)
-- ============================================================

-- 1. Tabela de chaves Kling
CREATE TABLE IF NOT EXISTS kling_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  access_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  max_concurrent INT NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kling_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on kling_keys"
  ON kling_keys FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Inserir as 3 chaves
INSERT INTO kling_keys (label, access_key, secret_key, max_concurrent) VALUES
  ('key_1', 'A4YfYL33gK9RHnLNKhPtE3LPDkDFb3CN', 'QMhHJYFMdDRbKGKaRpCrhPJf83FBGTGt', 3),
  ('key_2', 'AP8aDdACYJfJkbfFrYECYGND4bd4MfNJ', 'PpAJKY3JPeNQaAa4BL3Ly9J3KEp8M8Me', 3),
  ('key_3', 'ALDJMK3pPJn9mprQyhNAeMAKTNbQEFet', 'DPCH3Rpr3ndyCaEYKmeEkArJFBFBRFPR', 3);

-- 3. Novas colunas em video_selfies
ALTER TABLE video_selfies ADD COLUMN IF NOT EXISTS kling_key_id UUID REFERENCES kling_keys(id);
ALTER TABLE video_selfies ADD COLUMN IF NOT EXISTS kling_started_at TIMESTAMPTZ;

-- Index para contagem rápida de slots ativos por chave
CREATE INDEX IF NOT EXISTS idx_video_selfies_kling_active
  ON video_selfies (kling_key_id, status)
  WHERE kling_started_at IS NOT NULL AND status = 'generating_lipsync';

-- ============================================================
-- 4. RPC: claim_kling_slot
--    Atribui a chave menos ocupada (least-loaded).
--    FOR UPDATE SKIP LOCKED na kling_keys serializa por chave.
--    Retorna kling_key_id ou NULL se todas cheias.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_kling_slot(p_selfie_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key RECORD;
  v_active_count INT;
BEGIN
  -- PASSO 1: Limpar slot anterior deste selfie (crash recovery)
  -- Evita slot fantasma se o worker crashou e outro retomou
  UPDATE video_selfies
  SET kling_key_id = NULL, kling_started_at = NULL
  WHERE id = p_selfie_id
    AND kling_started_at IS NOT NULL;

  -- PASSO 2: Iterar chaves ativas com lock exclusivo
  FOR v_key IN
    SELECT id, max_concurrent
    FROM kling_keys
    WHERE is_active = TRUE
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Contagem SEGURA: dentro do lock, ninguém mais avalia esta chave
    SELECT COUNT(*) INTO v_active_count
    FROM video_selfies
    WHERE kling_key_id = v_key.id
      AND kling_started_at IS NOT NULL
      AND status = 'generating_lipsync'
      AND kling_started_at > NOW() - INTERVAL '40 minutes';

    IF v_active_count < v_key.max_concurrent THEN
      -- Reservar slot
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

-- ============================================================
-- 5. RPC: release_kling_slot
--    Libera o slot (chamado no finally do worker)
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_kling_slot(p_selfie_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE video_selfies
  SET kling_started_at = NULL
  WHERE id = p_selfie_id;
END;
$$;

-- ============================================================
-- 6. RPC: get_kling_key
--    Retorna credenciais de uma chave (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kling_key(p_key_id UUID)
RETURNS TABLE(access_key TEXT, secret_key TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT k.access_key, k.secret_key
  FROM kling_keys k
  WHERE k.id = p_key_id AND k.is_active = TRUE;
END;
$$;
