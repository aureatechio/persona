// Sweep de guidance_scale baixo: 1.0, 1.2, 1.3 × steps=50, dc=OFF
// Baseline de comparação: v2 (g=1.5/s=50/dc=OFF) — visual campeã anterior
// Outputs em sync-otimizado/results/guidance-sweep/

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n').filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const idx = l.indexOf('='); const k = l.slice(0,idx).trim(); let v = l.slice(idx+1).trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); return [k,v]; }),
);
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const VIDEO = 'sync-otimizado/samples-control/1774132135537_Modelo_Principal.mp4';
const AUDIO = 'sync-otimizado/samples-control/flavio-audio-v2.mp3';

const variants = [
  { id: 'g10-s50-dc0', label: 'g=1.0 steps=50 dc=OFF', guidance_scale: 1.0, inference_steps: 50, enable_deepcache: false },
  { id: 'g12-s50-dc0', label: 'g=1.2 steps=50 dc=OFF', guidance_scale: 1.2, inference_steps: 50, enable_deepcache: false },
  { id: 'g13-s50-dc0', label: 'g=1.3 steps=50 dc=OFF', guidance_scale: 1.3, inference_steps: 50, enable_deepcache: false },
];

const OUT_DIR = resolve(process.cwd(), 'sync-otimizado/results/guidance-sweep');
mkdirSync(OUT_DIR, { recursive: true });

// ─── Preprocess audio (once) ───
console.log('Preprocessing audio...');
const ts = Date.now();
const audioBytes = readFileSync(AUDIO);
const audioKey = `eval-inputs/gsweep_${ts}_audio.mp3`;
await supa.storage.from('voice-models').upload(audioKey, audioBytes, { contentType: 'audio/mpeg', upsert: true });
const { data: rawAudioSigned } = await supa.storage.from('voice-models').createSignedUrl(audioKey, 7200);
const apData = await (await fetch(env.MODAL_AUDIO_PREPROCESS_URL, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ audio_url: rawAudioSigned.signedUrl }),
})).json();
if (apData.error) { console.error('audio_preprocess failed:', apData.error); process.exit(1); }
console.log(`✓ Clean audio: ${apData.size_mb}MB\n`);

// ─── Upload video (once) ───
const videoBytes = readFileSync(VIDEO);
const videoKey = `eval-inputs/gsweep_${ts}_video.mp4`;
await supa.storage.from('voice-models').upload(videoKey, videoBytes, { contentType: 'video/mp4', upsert: true });
const { data: videoSigned } = await supa.storage.from('voice-models').createSignedUrl(videoKey, 7200);

const results = [];

for (const v of variants) {
  console.log(`━━━ ${v.label} ━━━`);
  const t0 = Date.now();

  const lsRes = await fetch(env.MODAL_LATENTSYNC_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url:        videoSigned.signedUrl,
      audio_url:        apData.audio_url,
      guidance_scale:   v.guidance_scale,
      inference_steps:  v.inference_steps,
      enable_deepcache: v.enable_deepcache,
      normalize_fps:    true,
    }),
  });
  const lsData = await lsRes.json();
  if (lsData.error) {
    console.log(`  ✗ LatentSync error: ${lsData.error}`);
    results.push({ ...v, error: lsData.error }); continue;
  }
  console.log(`  ✓ LatentSync in ${((Date.now()-t0)/1000).toFixed(1)}s`);

  // Save video locally
  writeFileSync(resolve(OUT_DIR, `${v.id}.mp4`), Buffer.from(await (await fetch(lsData.video_url)).arrayBuffer()));

  // SyncNet score
  const snData = await (await fetch(env.MODAL_SYNCNET_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: lsData.video_url }),
  })).json();
  console.log(`  ✓ Sync-D=${snData.sync_d?.toFixed(3)} Sync-C=${snData.sync_c?.toFixed(3)}`);

  results.push({
    id: v.id, label: v.label,
    guidance_scale: v.guidance_scale, inference_steps: v.inference_steps,
    sync_d: snData.sync_d, sync_c: snData.sync_c, av_offset: snData.av_offset,
    latentsync_seconds: lsData.elapsed_seconds,
  });
}

// ─── Report ───
const mdPath = resolve(OUT_DIR, 'scores.md');
const sorted = results.filter(r => !r.error).sort((a,b) => a.sync_d - b.sync_d);

let md = `# Sweep guidance baixo: 1.0 / 1.2 / 1.3

Generated: ${new Date().toISOString()}
Case: principal-flavio | steps=50, dc=OFF (mesmas condições da v2 visual campeã)
Baseline visual: v2 (g=1.5/s=50/dc=OFF) — Sync-D=6.933, Sync-C=7.741

## Resultados SyncNet

| Rank | Guidance | Sync-D ↓ | Sync-C ↑ | Tempo |
|---|---|---|---|---|
`;

// Add v2 baseline for reference
md += `| ref | g=1.5 (v2 baseline) | 6.933 | 7.741 | ~1782s |\n`;
sorted.forEach((r, i) => {
  md += `| ${i+1} | ${r.label} | **${r.sync_d?.toFixed(3)}** | **${r.sync_c?.toFixed(3)}** | ${r.latentsync_seconds}s |\n`;
});

md += `\n## Outputs pra avaliação visual\n\n`;
md += `Compare especialmente a boca em frames onde ela está bem aberta.\n\n`;
for (const r of sorted) md += `- \`results/guidance-sweep/${r.id}.mp4\` — ${r.label}\n`;
md += `- \`results/f3-params/v2-g15-s50-dc0.mp4\` — baseline g=1.5 (referência)\n`;

writeFileSync(mdPath, md);
writeFileSync(mdPath.replace('.md', '.json'), JSON.stringify(results, null, 2));
console.log(`\n→ ${mdPath}`);
