-- Multi-politician support for selfie video pipeline.
--
-- Adds per-politician config to video_base_models and associates each
-- video_selfies row with a specific base model (so the worker picks the
-- right video/voice/prompt/closing instead of reading a global is_active).
--
-- Safe to run: all new columns are nullable. Backfill happens inline.
-- base_model_id is NOT set to NOT NULL in this migration — that's deferred
-- to a follow-up migration after F2 (worker update) is deployed.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- video_base_models: per-politician metadata
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS slug                      TEXT,
  ADD COLUMN IF NOT EXISTS display_name              TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT NOT NULL DEFAULT 'Olá, {name}! Obrigado pela sua mensagem!',
  ADD COLUMN IF NOT EXISTS thank_you_message         TEXT,
  ADD COLUMN IF NOT EXISTS closing_video_path        TEXT;

-- Unique slug (partial — only for rows that have one set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_base_models_slug_unique
  ON video_base_models(slug)
  WHERE slug IS NOT NULL;

-- Backfill the existing active model (Flávio Bolsonaro v2)
UPDATE video_base_models
SET slug                      = 'flavio',
    display_name              = 'Flávio Bolsonaro',
    whatsapp_message_template = 'Olá, {name}! Estamos juntos nessa luta!',
    thank_you_message         = '{name}, nosso time vai assistir seu depoimento com muito carinho. E vamos te enviar um vídeo no seu WhatsApp em até 10 minutos.',
    -- closing_video_path stays NULL → worker falls back to assets/closing_video.mp4 (current default)
    updated_at                = NOW()
WHERE id = '1f725415-ed65-4047-b6c3-6b2165d91d68';

-- ──────────────────────────────────────────────────────────────────────────
-- video_selfies: associate each selfie with a base model
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS base_model_id UUID REFERENCES video_base_models(id);

-- Backfill: every existing selfie was processed against the (single) active
-- model. Point them all at it so NOT NULL can be enforced later.
UPDATE video_selfies
SET base_model_id = '1f725415-ed65-4047-b6c3-6b2165d91d68'
WHERE base_model_id IS NULL;

-- Index for the monitor route's per-politician filter
CREATE INDEX IF NOT EXISTS idx_video_selfies_base_model
  ON video_selfies(base_model_id);

COMMIT;
