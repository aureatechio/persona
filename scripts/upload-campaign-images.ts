/**
 * Upload campaign tag images to Supabase Storage + insert into campaign_tag_images table.
 *
 * Usage:  npx tsx scripts/upload-campaign-images.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://sobfplitrzgggzqsycew.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET = 'campaign-images';

const PHOTO_DIR = '/Users/arthurcavallini/Downloads/fotosTags';

// Mapping: local filename -> grupo tag
const FILE_TO_TAG: { file: string; grupo: string }[] = [
  // Batch 1 (12.27.36) - already uploaded previously, files replaced
  { file: 'WhatsApp Image 2026-03-03 at 12.27.36.jpeg', grupo: 'ESPORTE' },
  { file: 'WhatsApp Image 2026-03-03 at 12.27.36 (1).jpeg', grupo: 'FE' },
  { file: 'WhatsApp Image 2026-03-03 at 12.27.36 (2).jpeg', grupo: 'EMPREENDEDOR' },
  { file: 'WhatsApp Image 2026-03-03 at 12.27.36 (3).jpeg', grupo: 'FAMILIA' },
  // Batch 2 (13.12.23 / 13.12.24) - 11 new photos
  { file: 'WhatsApp Image 2026-03-03 at 13.12.23.jpeg', grupo: 'EDUCACAO' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.23 (1).jpeg', grupo: 'MODA' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.23 (2).jpeg', grupo: 'POLITICA' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.23 (3).jpeg', grupo: 'VIAGEM' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.23 (4).jpeg', grupo: 'ARTE' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.23 (5).jpeg', grupo: 'MUSICA' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.23 (6).jpeg', grupo: 'SAUDE' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.24.jpeg', grupo: 'TECH' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.24 (1).jpeg', grupo: 'PET' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.24 (2).jpeg', grupo: 'GASTRONOMIA' },
  { file: 'WhatsApp Image 2026-03-03 at 13.12.24 (3).jpeg', grupo: 'AGRO' },
  // Batch 3 (13.20.28) - 5 remaining tags
  { file: 'WhatsApp Image 2026-03-03 at 13.20.28.jpeg', grupo: 'FITNESS' },
  { file: 'WhatsApp Image 2026-03-03 at 13.20.28 (1).jpeg', grupo: 'INFLUENCER' },
  { file: 'WhatsApp Image 2026-03-03 at 13.20.28 (2).jpeg', grupo: 'JURIDICO' },
  { file: 'WhatsApp Image 2026-03-03 at 13.20.28 (3).jpeg', grupo: 'COMUNIDADE' },
  { file: 'WhatsApp Image 2026-03-03 at 13.20.28 (4).jpeg', grupo: 'LIFESTYLE' },
];

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error('Error creating bucket:', error.message);
      process.exit(1);
    }
    console.log(`Bucket "${BUCKET}" created (public).`);
  } else {
    console.log(`Bucket "${BUCKET}" already exists.`);
  }
}

async function uploadAndInsert() {
  for (const { file, grupo } of FILE_TO_TAG) {
    const filePath = path.join(PHOTO_DIR, file);
    const storagePath = `${grupo.toLowerCase()}.jpg`;

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    const buffer = fs.readFileSync(filePath);

    // Upload to storage (upsert)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error(`Upload error for ${grupo}:`, uploadError.message);
      continue;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;
    console.log(`Uploaded ${grupo}: ${imageUrl}`);

    // Upsert into table
    const { error: dbError } = await supabase
      .from('campaign_tag_images')
      .upsert(
        { grupo, image_url: imageUrl },
        { onConflict: 'grupo' },
      );

    if (dbError) {
      console.error(`DB error for ${grupo}:`, dbError.message);
    } else {
      console.log(`DB record upserted for ${grupo}`);
    }
  }
}

async function main() {
  console.log('=== Campaign Image Upload ===\n');
  await ensureBucket();
  await uploadAndInsert();
  console.log('\nDone!');
}

main();
