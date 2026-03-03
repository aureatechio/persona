-- Migration: campaign_tag_images
-- Tabela que mapeia cada grupo (tag) para uma imagem de campanha personalizada

CREATE TABLE IF NOT EXISTS campaign_tag_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo TEXT UNIQUE NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaign_tag_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON campaign_tag_images
  FOR SELECT USING (true);

CREATE POLICY "Allow service insert" ON campaign_tag_images
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service update" ON campaign_tag_images
  FOR UPDATE USING (true);
