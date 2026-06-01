-- Novo padrão de gravação: candidato grava 1 vídeo saudação único
-- (3s placeholder "Olá pessoal") + 30 vídeos de tema completos.
-- O lipsync substitui o placeholder pelo nome do eleitor, e o compose
-- concatena com o vídeo do tema (sem cortar, já vem pronto).
--
-- Mudanças:
--   1. greeting_video_path em video_base_models: path do vídeo saudação.
--   2. name_sync_uses_greeting em video_selfies: flag que diferencia
--      caches gerados com visual do greeting (reusáveis entre temas) dos
--      caches antigos com visual do theme_video (chaveados por tema).
--   3. theme_intro_seconds default 0: o novo padrão não tem placeholder
--      no theme_video pra cortar.
--   4. Índice de cache do name_sync passa a ser por (base_model, first_name)
--      filtrando WHERE name_sync_uses_greeting = TRUE. Caches antigos
--      ficam no banco (linkados a vídeos reais entregues) mas não
--      aparecem nos lookups novos.

ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS greeting_video_path TEXT;

ALTER TABLE video_base_models
  ALTER COLUMN theme_intro_seconds SET DEFAULT 0;

ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS name_sync_uses_greeting BOOLEAN NOT NULL DEFAULT FALSE;

DROP INDEX IF EXISTS idx_video_selfies_name_sync_cache;

CREATE INDEX IF NOT EXISTS idx_video_selfies_name_sync_cache
  ON video_selfies (base_model_id, first_name)
  WHERE name_sync_cached_path IS NOT NULL
    AND status = 'completed'
    AND name_sync_uses_greeting = TRUE;
