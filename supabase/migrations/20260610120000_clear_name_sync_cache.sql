-- Limpa todos os caches de name_sync gerados antes da correção de normalização
-- de resolução (setsar=1 + yuv420p). Os caches antigos podem ter SAR incorreto
-- causando tamanhos diferentes na composição mobile. Força regeneração fresca
-- para todos os eleitores usando greeting_video como fonte visual.

-- 1. Limpa referências de cache no banco
UPDATE video_selfies
SET
  name_sync_cached_path = NULL,
  name_sync_uses_greeting = FALSE
WHERE name_sync_cached_path IS NOT NULL;

-- 2. Remove arquivos de cache do Storage
DELETE FROM storage.objects
WHERE bucket_id = 'voice-models'
  AND name LIKE 'name_sync_cached/%';
