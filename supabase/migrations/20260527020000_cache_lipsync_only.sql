-- Corrige o cache de vídeos: cacheia somente o lipsync do candidato
-- (sem a selfie do eleitor), não o vídeo final composto.
--
-- Motivo: o vídeo final é selfie_do_eleitor + lipsync_do_candidato +
-- closing. Quando reusávamos o final_video_path, o segundo eleitor
-- recebia o vídeo com a selfie do primeiro. Agora cacheamos só o
-- lipsync e o compose roda com a selfie do eleitor atual.

ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS lipsync_cached_path TEXT;

-- Substitui o índice antigo (que apontava para final_video_path) pelo
-- novo (lipsync_cached_path). Mantém a mesma chave de lookup.
DROP INDEX IF EXISTS idx_video_selfies_cache_source;

CREATE INDEX IF NOT EXISTS idx_video_selfies_cache_source
  ON video_selfies (base_model_id, first_name, category)
  WHERE lipsync_cached_path IS NOT NULL
    AND cached_from IS NULL
    AND status = 'completed';
