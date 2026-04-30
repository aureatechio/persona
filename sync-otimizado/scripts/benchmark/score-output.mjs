// Score a single video with SyncNet.
// Usage:
//   node sync-otimizado/scripts/benchmark/score-output.mjs <local-video-file>
//
// Uploads to Supabase, gets signed URL, sends to MODAL_SYNCNET_URL, prints scores.

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      const k = l.slice(0, idx).trim();
      let v = l.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [k, v];
    }),
);

const file = process.argv[2];
if (!file) {
  console.error('Usage: node score-output.mjs <local-video-file>');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const bytes = readFileSync(file);
const key = `eval-inputs/${Date.now()}_${basename(file)}`;
const up = await supa.storage.from('voice-models').upload(key, bytes, { contentType: 'video/mp4', upsert: true });
if (up.error) throw new Error(`upload: ${up.error.message}`);
const { data: signed } = await supa.storage.from('voice-models').createSignedUrl(key, 3600);

console.log(`Scoring ${basename(file)}...`);
const t0 = Date.now();
const res = await fetch(env.MODAL_SYNCNET_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ video_url: signed.signedUrl }),
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const data = await res.json();
console.log(`HTTP ${res.status} in ${elapsed}s`);
console.log(JSON.stringify(data, null, 2));
