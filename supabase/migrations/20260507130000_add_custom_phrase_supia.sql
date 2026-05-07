-- Custom phrase mode: when set, the worker uses this verbatim instead of
-- interpolating supermarket_name into the fixed template.
ALTER TABLE supia_videos
  ADD COLUMN IF NOT EXISTS custom_phrase TEXT;
