-- Add slug column for shareable URLs
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill existing records: slug = lowercase username
UPDATE instagram_accounts SET slug = lower(username) WHERE slug IS NULL;

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_accounts_slug ON instagram_accounts(slug);
