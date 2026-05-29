-- Sync mais curto: pra evitar o duplo corte (nome + agradecimento) e
-- reduzir custo/tempo do lipsync na Sync.so, agora o name_sync é só
-- a saudação com o nome (~1-1.5s) e o video_tema começa em 1.5s.

ALTER TABLE video_base_models
  ALTER COLUMN theme_intro_seconds SET DEFAULT 1.5;

-- Atualiza modelos que ainda estavam num default antigo (4 ou 4.5).
-- Se algum candidato customizou pra outro valor (ex: 2.0, 3.0), fica
-- intocado.
UPDATE video_base_models
   SET theme_intro_seconds = 1.5
 WHERE theme_intro_seconds IN (4, 4.5);
