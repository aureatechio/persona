-- Ajuste fino: a candidata fica falando o placeholder até ~4.5s no
-- vídeo do tema (não 4.0s como assumimos antes). Atualiza o default
-- e propaga pros registros existentes que ainda estavam no default
-- antigo, sem mexer em modelos que já foram customizados manualmente.

ALTER TABLE video_base_models
  ALTER COLUMN theme_intro_seconds SET DEFAULT 4.5;

UPDATE video_base_models
   SET theme_intro_seconds = 4.5
 WHERE theme_intro_seconds = 4;
