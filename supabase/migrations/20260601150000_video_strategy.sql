-- Estratégia de geração de vídeo por candidato.
--
-- 'name_sync' (default, barato): lipsync de 3s só do nome + concat com
--   o vídeo do tema gravado pelo candidato. ~$0.10/vídeo. Pode ter um
--   "corte" perceptível na transição em alguns vídeos.
--
-- 'full_video' (premium, caro): GPT gera resposta completa, TTS longo
--   e lipsync de até 30s SOBRE o vídeo do tema (puppet). Compose junta
--   selfie do eleitor + lipsync_completo + closing. ~$1-2/vídeo.
--   Visualmente linear, sem corte.

ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS video_strategy TEXT NOT NULL DEFAULT 'name_sync';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'video_base_models_video_strategy_check'
  ) THEN
    ALTER TABLE video_base_models
      ADD CONSTRAINT video_base_models_video_strategy_check
      CHECK (video_strategy IN ('name_sync', 'full_video'));
  END IF;
END $$;

-- Capturamos a strategy decidida no momento do processamento na row
-- da selfie, garantindo que retries usem o mesmo caminho mesmo se o
-- admin trocar a config do candidato no meio. Nullable porque rows
-- antigas (pré-migration) não passaram pelo step 2 com strategy.
ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS video_strategy TEXT;
