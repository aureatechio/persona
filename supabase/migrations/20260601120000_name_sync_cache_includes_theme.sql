-- Cache do name_sync agora chaveado por (base_model_id, first_name, theme_slug).
--
-- Antes: o lipsync do nome usava o vídeo base do candidato (genérico),
-- então um "joão" servia pra qualquer tema. Agora o lipsync usa o vídeo
-- do tema escolhido como input visual (continuidade visual perfeita
-- entre name_sync e theme_video), então o cache precisa ser por trio.

DROP INDEX IF EXISTS idx_video_selfies_name_sync_cache;

CREATE INDEX IF NOT EXISTS idx_video_selfies_name_sync_cache
  ON video_selfies (base_model_id, first_name, theme_slug)
  WHERE name_sync_cached_path IS NOT NULL
    AND status = 'completed';
