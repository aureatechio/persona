-- Video Selfie Pipeline Tables

-- 1. Tabela de modelos base (vídeo do Duda + config)
CREATE TABLE IF NOT EXISTS video_base_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Modelo Principal',
  video_storage_path TEXT NOT NULL,
  voice_model_id UUID REFERENCES voice_models(id),
  prompt_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de selfies dos clientes
CREATE TABLE IF NOT EXISTS video_selfies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  selfie_video_path TEXT,
  transcription TEXT,
  generated_text TEXT,
  tts_audio_path TEXT,
  lipsync_job_id TEXT,
  lipsync_video_url TEXT,
  final_video_path TEXT,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'recording',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_video_selfies_status ON video_selfies(status);
CREATE INDEX IF NOT EXISTS idx_video_selfies_phone ON video_selfies(phone);
CREATE INDEX IF NOT EXISTS idx_video_base_models_active ON video_base_models(is_active) WHERE is_active = TRUE;

-- RLS (desabilitado para acesso via service_role)
ALTER TABLE video_base_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_selfies ENABLE ROW LEVEL SECURITY;

-- Policies para service_role ter acesso total
CREATE POLICY "Service role full access on video_base_models"
  ON video_base_models FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on video_selfies"
  ON video_selfies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
