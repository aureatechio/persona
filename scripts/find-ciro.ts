/**
 * Ad-hoc: gera signed URL (1h) do vídeo-base do Ciro Nogueira.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname || __dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (match) process.env[match[1]] = match[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PATH = 'base-models/1773882939_Ciro_Nogueira_v4_22s.mp4';

async function main() {
  const { data, error } = await supabase.storage
    .from('voice-models')
    .createSignedUrl(PATH, 60 * 60); // 1 hora

  if (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
  console.log('\nSigned URL (válida por 1h):\n');
  console.log(data!.signedUrl);
  console.log('\nPath no bucket:', PATH);
}

main().catch(err => { console.error(err); process.exit(1); });
