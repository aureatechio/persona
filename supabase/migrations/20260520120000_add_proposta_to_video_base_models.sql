-- Proposta de governo (PDF) por político.
--
-- Permite que cada base_model tenha um PDF de proposta opcional, enviado
-- via WhatsApp logo após o vídeo final. O `proposta_message_template`
-- aceita {name} como placeholder do nome do eleitor.
--
-- Se ambos forem NULL/vazios, o worker pula a etapa silenciosamente.

ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS proposta_pdf_path         TEXT,
  ADD COLUMN IF NOT EXISTS proposta_message_template TEXT;
