// Compare F2 (CRF 12 no reencode 25fps) contra F1 (CRF 18).
// Pipeline: audio_preprocess → LatentSync (agora com CRF 12) → SyncNet
// F2 está baked no modal-enhance/latentsync_app.py — qualquer run agora usa CRF 12.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

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

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const cases = [
  { id: 'duda',             video: 'sync-otimizado/samples-control/video_modelo_duda.mp4',              audio: 'sync-otimizado/samples-control/duda_arthur.mp3',     f1: { sync_d: 8.754, sync_c: 5.538 } },
  { id: 'flavio',           video: 'sync-otimizado/samples-control/flavioBolsonaro-modelo-v2.mp4',      audio: 'sync-otimizado/samples-control/flavio-audio-v2.mp3', f1: { sync_d: 7.482, sync_c: 7.453 } },
  { id: 'principal-flavio', video: 'sync-otimizado/samples-control/1774132135537_Modelo_Principal.mp4', audio: 'sync-otimizado/samples-control/flavio-audio-v2.mp3', f1: { sync_d: 6.838, sync_c: 8.147 } },
];

const VARIANT = { guidance_scale: 2.0, inference_steps: 30, enable_deepcache: true, normalize_fps: true };
const OUT_DIR = resolve(process.cwd(), 'sync-otimizado/results/f2-video');
mkdirSync(OUT_DIR, { recursive: true });

async function uploadAndSign(localPath, key, ct) {
  const bytes = readFileSync(localPath);
  const up = await supa.storage.from('voice-models').upload(key, bytes, { contentType: ct, upsert: true });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  const { data } = await supa.storage.from('voice-models').createSignedUrl(key, 7200);
  return data.signedUrl;
}

const results = [];

for (const c of cases) {
  console.log(`\n━━━ Case: ${c.id} ━━━`);
  const ts = Date.now();

  console.log('  1/4  uploading raw audio...');
  const rawAudioUrl = await uploadAndSign(c.audio, `eval-inputs/f2_${ts}_${c.id}_audio.mp3`, 'audio/mpeg');

  console.log('  2/4  audio_preprocess...');
  const apRes = await fetch(env.MODAL_AUDIO_PREPROCESS_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: rawAudioUrl }),
  });
  const apData = await apRes.json();
  if (apData.error) { console.log(`  ✗ audio_preprocess: ${apData.error}`); results.push({ ...c, error: apData.error }); continue; }
  console.log(`       ✓ ${apData.size_mb}MB cleaned audio`);

  console.log('  3/4  LatentSync (CRF 12)...');
  const videoUrl = await uploadAndSign(c.video, `eval-inputs/f2_${ts}_${c.id}_video.mp4`, 'video/mp4');
  const t2 = Date.now();
  const lsRes = await fetch(env.MODAL_LATENTSYNC_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl, audio_url: apData.audio_url, ...VARIANT }),
  });
  const lsData = await lsRes.json();
  if (lsData.error) { console.log(`  ✗ LatentSync: ${lsData.error}`); results.push({ ...c, error: lsData.error }); continue; }
  console.log(`       ✓ in ${((Date.now()-t2)/1000).toFixed(1)}s`);

  const outVideo = resolve(OUT_DIR, `${c.id}.mp4`);
  writeFileSync(outVideo, Buffer.from(await (await fetch(lsData.video_url)).arrayBuffer()));

  console.log('  4/4  SyncNet...');
  const snData = await (await fetch(env.MODAL_SYNCNET_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: lsData.video_url }),
  })).json();
  if (snData.error) { console.log(`  ✗ SyncNet: ${snData.error}`); results.push({ ...c, error: snData.error }); continue; }
  console.log(`       ✓ Sync-D=${snData.sync_d?.toFixed(3)} Sync-C=${snData.sync_c?.toFixed(3)}`);

  results.push({
    case: c.id, f1: c.f1,
    f2: { sync_d: snData.sync_d, sync_c: snData.sync_c, av_offset: snData.av_offset },
    delta: { sync_d: +(snData.sync_d - c.f1.sync_d).toFixed(3), sync_c: +(snData.sync_c - c.f1.sync_c).toFixed(3) },
    output: outVideo, latentsync_seconds: lsData.elapsed_seconds,
  });
}

const mdPath = resolve(OUT_DIR, 'scores.md');
let md = `# F2 — Vídeo CRF 12: comparação contra F1 (CRF 18)

Generated: ${new Date().toISOString()}

**Pipeline F2:** audio_preprocess → LatentSync (CRF 12 no reencode 25fps) → SyncNet.
**F1 base:** mesma pipeline com CRF 18.

Ganho esperado: marginal em SyncNet (CRF afeta qualidade visual do input pré-IA, não sync).

## Resultados

| Caso | Métrica | F1 CRF-18 | F2 CRF-12 | Δ |
|---|---|---|---|---|
`;
for (const r of results) {
  if (r.error) { md += `| ${r.case} | — | — | ERR | ${r.error.slice(0,50)} |\n`; continue; }
  md += `| ${r.case} | Sync-D ↓ | ${r.f1.sync_d.toFixed(3)} | **${r.f2.sync_d.toFixed(3)}** | ${r.delta.sync_d > 0 ? '+' : ''}${r.delta.sync_d} |\n`;
  md += `| ${r.case} | Sync-C ↑ | ${r.f1.sync_c.toFixed(3)} | **${r.f2.sync_c.toFixed(3)}** | ${r.delta.sync_c > 0 ? '+' : ''}${r.delta.sync_c} |\n`;
}
writeFileSync(mdPath, md);
writeFileSync(mdPath.replace('.md', '.json'), JSON.stringify(results, null, 2));
console.log(`\n→ ${mdPath}`);
