-- Limpa todos os caches de name_sync gerados antes da correção de normalização
-- de resolução (setsar=1 + yuv420p). Os caches antigos podem ter SAR incorreto
-- causando tamanhos diferentes na composição mobile. Força regeneração fresca
-- para todos os eleitores usando greeting_video como fonte visual.
--
-- NOTA: os arquivos em storage voice-models/name_sync_cached/ devem ser
-- deletados manualmente via Storage API (Supabase bloqueia DELETE direto
-- em storage.objects). Use o dashboard Storage ou a API REST com service key.

UPDATE video_selfies
SET
  name_sync_cached_path = NULL,
  name_sync_uses_greeting = FALSE
WHERE name_sync_cached_path IS NOT NULL;
