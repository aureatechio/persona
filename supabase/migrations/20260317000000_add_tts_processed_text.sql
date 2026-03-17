-- Salvar o texto processado enviado ao ElevenLabs para auditoria
ALTER TABLE video_selfies ADD COLUMN IF NOT EXISTS tts_processed_text TEXT;
