-- Add bg_music_path column to all base_models tables.
-- When NULL, workers skip background music mixing (no more hardcoded global audio).

BEGIN;

-- video_base_models (selfie-worker / v1)
ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS bg_music_path TEXT DEFAULT NULL;

-- v2_base_models
ALTER TABLE v2_base_models
  ADD COLUMN IF NOT EXISTS bg_music_path TEXT DEFAULT NULL;

-- v3_base_models
ALTER TABLE v3_base_models
  ADD COLUMN IF NOT EXISTS bg_music_path TEXT DEFAULT NULL;

-- Set background music only for Maria do Carmo (the one that should have it)
UPDATE video_base_models
SET bg_music_path = 'assets/background_music.mp3'
WHERE slug = 'mariadocarmo';

UPDATE v2_base_models
SET bg_music_path = 'assets/background_music.mp3'
WHERE slug = 'mariadocarmo-new';

-- Flavio and any other politicians: bg_music_path stays NULL (no background music)

COMMIT;
