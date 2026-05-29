-- Duração da "intro neutra" dos vídeos do tema (em segundos).
--
-- A candidata grava os 4 primeiros segundos do vídeo do tema falando
-- um nome aleatório (placeholder), e depois muda a posição da câmera
-- pra falar sobre o assunto. No fluxo name_sync, esses 4 segundos
-- iniciais são SUBSTITUÍDOS pelo lipsync com o nome do eleitor — então
-- o compose precisa pular esses segundos do theme_video pra não
-- repetir visualmente a abertura.
--
-- Configurável por candidato pra acomodar gravações com tempos
-- diferentes (5s, 3.5s, etc).

ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS theme_intro_seconds NUMERIC NOT NULL DEFAULT 4;
