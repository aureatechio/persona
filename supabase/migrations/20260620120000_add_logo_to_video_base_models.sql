-- Logo personalizado por político.
--
-- Permite que cada base_model tenha um logo opcional, exibido como o logo
-- GRANDE na tela de captura de selfie (/selfie-video/{slug}). O logo menor
-- do topo (header) permanece fixo (PL).
--
-- Se NULL/vazio, a tela usa o logo padrão do PL (/logo-pl.png).

ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT;
