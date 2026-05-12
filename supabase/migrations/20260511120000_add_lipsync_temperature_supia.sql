-- Per-job lip-sync model + temperature (Sync Labs parameters).
--
-- model: 'sync-3' (top quality, manages temperature internally), 'lipsync-2-pro'
--        (studio-grade, accepts temperature), 'lipsync-2' (faster/cheaper, accepts temperature).
-- temperature: 0..1, only meaningful for lipsync-2* models. sync-3 ignores it.

ALTER TABLE supia_videos
  ADD COLUMN IF NOT EXISTS lipsync_model TEXT NOT NULL DEFAULT 'lipsync-2-pro';

ALTER TABLE supia_videos
  ADD COLUMN IF NOT EXISTS lipsync_temperature NUMERIC(3, 2);

ALTER TABLE supia_videos
  ADD CONSTRAINT supia_videos_lipsync_model_check
  CHECK (lipsync_model IN ('sync-3', 'lipsync-2-pro', 'lipsync-2'));

ALTER TABLE supia_videos
  ADD CONSTRAINT supia_videos_lipsync_temperature_range
  CHECK (lipsync_temperature IS NULL OR (lipsync_temperature >= 0 AND lipsync_temperature <= 1));
