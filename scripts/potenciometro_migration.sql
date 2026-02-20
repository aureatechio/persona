-- ============================================================================
-- Potenciometro Politico - Migration
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Tabela de snapshots para reversibilidade
CREATE TABLE IF NOT EXISTS public.persona_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  label text NOT NULL,
  data jsonb NOT NULL
);

ALTER TABLE public.persona_snapshots ENABLE ROW LEVEL SECURITY;

-- 2. RPC: aplicar delta de score por grupo macro (P, M, C, T)
CREATE OR REPLACE FUNCTION apply_score_delta(
  p_macro_prefix text,
  p_delta_eco double precision,
  p_delta_cost double precision
) RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.personas
  SET
    score_economico = LEAST(1.0, GREATEST(-1.0, score_economico + p_delta_eco)),
    score_costumes  = LEAST(1.0, GREATEST(-1.0, score_costumes + p_delta_cost))
  WHERE cluster_id LIKE p_macro_prefix || '%';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: re-derivar political_leaning com base nos scores atuais
--    Logica identica a scripts/import-csv.ts linhas 77-100
CREATE OR REPLACE FUNCTION rederive_political_leaning() RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.personas SET political_leaning =
    CASE
      -- Progressistas (P)
      WHEN LEFT(cluster_id, 1) = 'P' THEN
        CASE
          WHEN (score_economico + score_costumes) / 2.0 < -0.5 THEN 'Extrema Esquerda'
          WHEN (score_economico + score_costumes) / 2.0 < -0.2 THEN 'Esquerda'
          ELSE 'Centro-Esquerda'
        END
      -- Moderados (M)
      WHEN LEFT(cluster_id, 1) = 'M' THEN
        CASE
          WHEN (score_economico + score_costumes) / 2.0 < -0.15 THEN 'Centro-Esquerda'
          WHEN (score_economico + score_costumes) / 2.0 > 0.15  THEN 'Centro-Direita'
          ELSE 'Centro'
        END
      -- Conservadores (C)
      WHEN LEFT(cluster_id, 1) = 'C' THEN
        CASE
          WHEN (score_economico + score_costumes) / 2.0 > 0.5 THEN 'Extrema Direita'
          WHEN (score_economico + score_costumes) / 2.0 > 0.2 THEN 'Direita'
          ELSE 'Centro-Direita'
        END
      -- Transversais (T)
      ELSE
        CASE
          WHEN (score_economico + score_costumes) / 2.0 < -0.2 THEN 'Centro-Esquerda'
          WHEN (score_economico + score_costumes) / 2.0 > 0.2  THEN 'Centro-Direita'
          ELSE 'Centro'
        END
    END
  WHERE cluster_id IS NOT NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: restaurar scores de um snapshot
CREATE OR REPLACE FUNCTION restore_persona_snapshot(p_snapshot_id uuid) RETURNS integer AS $$
DECLARE
  snapshot_data jsonb;
  persona_row jsonb;
  affected integer := 0;
BEGIN
  SELECT data INTO snapshot_data FROM public.persona_snapshots WHERE id = p_snapshot_id;

  IF snapshot_data IS NULL THEN
    RAISE EXCEPTION 'Snapshot not found: %', p_snapshot_id;
  END IF;

  FOR persona_row IN SELECT * FROM jsonb_array_elements(snapshot_data)
  LOOP
    UPDATE public.personas
    SET
      score_economico = (persona_row->>'score_economico')::double precision,
      score_costumes  = (persona_row->>'score_costumes')::double precision,
      political_leaning = persona_row->>'political_leaning'
    WHERE id = (persona_row->>'id')::uuid;

    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
