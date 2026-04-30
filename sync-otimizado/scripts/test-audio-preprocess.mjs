// Smoke test: upload an audio, run audio_preprocess, download cleaned audio.
// Usage: node sync-otimizado/scripts/test-audio-preprocess.mjs <local-audio-file>

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
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
if (!file) { console.error('Usage: <audio-file>'); process.exit(1); }

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const bytes = readFileSync(file);
const key = `eval-inputs/preproc-test_${Date.now()}_${basename(file)}`;
console.log('Uploading raw...');
const up = await supa.storage.from('voice-models').upload(key, bytes, { contentType: 'audio/mpeg', upsert: true });
if (up.error) throw up.error;
const { data: signed } = await supa.storage.from('voice-models').createSignedUrl(key, 3600);

console.log('Calling audio_preprocess...');
const t0 = Date.now();
const res = await fetch(env.MODAL_AUDIO_PREPROCESS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ audio_url: signed.signedUrl }),
});
const data = await res.json();
console.log(`HTTP ${res.status} in ${((Date.now() - t0)/1000).toFixed(1)}s`);
console.log(JSON.stringify(data, null, 2));

if (data.audio_url) {
  console.log('\nDownloading processed audio...');
  const r = await fetch(data.audio_url);
  const buf = Buffer.from(await r.arrayBuffer());
  const out = `processed_${basename(file)}.wav`;
  writeFileSync(out, buf);
  console.log(`✓ Saved ${out} (${(buf.length/1024/1024).toFixed(2)}MB)`);
}
