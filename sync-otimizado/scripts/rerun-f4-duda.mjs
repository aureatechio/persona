// Rerun F4 apenas para o caso duda com a image corrigida do CodeFormer.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n').filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const idx = l.indexOf('='); const k = l.slice(0,idx).trim(); let v = l.slice(idx+1).trim(); if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); return [k,v]; }),
);
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const f1File = 'sync-otimizado/results/f1-audio/duda.mp4';
const ts = Date.now();

console.log('Uploading duda F1 output...');
const bytes = readFileSync(f1File);
const up = await supa.storage.from('voice-models').upload(`eval-inputs/f4_${ts}_duda_f1.mp4`, bytes, { contentType: 'video/mp4', upsert: true });
if (up.error) throw up.error;
const { data: signed } = await supa.storage.from('voice-models').createSignedUrl(`eval-inputs/f4_${ts}_duda_f1.mp4`, 7200);

console.log('Running CodeFormer (fidelity=0.7)...');
const t1 = Date.now();
const frRes = await fetch(env.MODAL_FACE_REFINE_URL, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ video_url: signed.signedUrl, fidelity_weight: 0.7 }),
});
const frData = await frRes.json();
console.log(`HTTP ${frRes.status} in ${((Date.now()-t1)/1000).toFixed(1)}s`);
if (frData.error) {
  console.log('ERROR:', frData.error);
  console.log('HEAD:', frData.stderr_head);
  console.log('TAIL:', frData.stderr_tail);
  process.exit(1);
}
console.log(`✓ ${frData.size_mb}MB in ${frData.elapsed_seconds}s`);

const vidBuf = Buffer.from(await (await fetch(frData.video_url)).arrayBuffer());
writeFileSync('sync-otimizado/results/f4-face/duda.mp4', vidBuf);

console.log('Scoring with SyncNet...');
const snRes = await fetch(env.MODAL_SYNCNET_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_url: frData.video_url }) });
const snData = await snRes.json();
console.log(`Sync-D=${snData.sync_d?.toFixed(3)} Sync-C=${snData.sync_c?.toFixed(3)} (F1 baseline: D=8.754 C=5.538)`);
console.log(`Delta: D=${(snData.sync_d-8.754).toFixed(3)} C=${(snData.sync_c-5.538).toFixed(3)}`);
writeFileSync('sync-otimizado/results/f4-face/duda_scores.json', JSON.stringify({ f1: {sync_d:8.754,sync_c:5.538}, f4: snData }, null, 2));
