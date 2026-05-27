-- Cache de vídeos prontos.
--
-- Quando um eleitor envia um depoimento, o worker classifica a transcrição
-- em uma categoria (1 palavra, ex: "educacao") e procura no banco se já
-- existe um vídeo finalizado para a tupla (base_model_id, first_name,
-- category). Se existir, reusa o final_video_path em vez de gerar de novo,
-- cortando custo de GPT + TTS + Lip-sync + Compose.
--
-- O primeiro vídeo gerado para cada tupla vira o "template" definitivo —
-- todos os próximos eleitores com o mesmo primeiro nome e mesma categoria
-- (para aquele político) recebem esse mesmo vídeo.

ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS cached_from UUID REFERENCES video_selfies(id);

-- Índice parcial só nas rows que podem servir de fonte de cache:
--  - têm vídeo final pronto
--  - foram completadas com sucesso
--  - são originais (não são elas mesmas reuso de outra)
CREATE INDEX IF NOT EXISTS idx_video_selfies_cache_source
  ON video_selfies (base_model_id, first_name, category)
  WHERE final_video_path IS NOT NULL
    AND cached_from IS NULL
    AND status = 'completed';
