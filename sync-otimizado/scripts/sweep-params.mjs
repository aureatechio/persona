// F3: Sweep sistematizado de inference_steps × guidance_scale × deepcache.
// Roda sobre um único caso (principal-flavio, nosso melhor baseline) + audio_preprocess ON.
// Salva outputs + scores em sync-otimizado/results/f3-params/

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

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

// Caso fixo — melhor baseline (Sync-D=6.838 com F1, principal-flavio)
const VIDEO = 'sync-otimizado/samples-control/1774132135537_Modelo_Principal.mp4';
const AUDIO = 'sync-otimizado/samples-control/flavio-audio-v2.mp3';

// Matriz prioritária (5 combinações — não as 18 totais)
// Baseline prod = B (guidance=2.0, steps=30, deepcache=on)
const variants = [
  { id: 'v1-g15-s30-dc1', label: 'g=1.5 steps=30 dc=ON',  guidance_scale: 1.5, inference_steps: 30, enable_deepcache: true  },
  { id: 'v2-g15-s50-dc0', label: 'g=1.5 steps=50 dc=OFF', guidance_scale: 1.5, inference_steps: 50, enable_deepcache: false },
  { id: 'v3-g20-s30-dc1', label: 'g=2.0 steps=30 dc=ON  [baseline prod]',  guidance_scale: 2.0, inference_steps: 30, enable_deepcache: true  },
  { id: 'v4-g20-s40-dc0', label: 'g=2.0 steps=40 dc=OFF', guidance_scale: 2.0, inference_steps: 40, enable_deepcache: false },
  { id: 'v5-g25-s40-dc0', label: 'g=2.5 steps=40 dc=OFF', guidance_scale: 2.5, inference_steps: 40, enable_deepcache: false },
];

const OUT_DIR = resolve(process.cwd(), 'sync-otimizado/results/f3-params');
mkdirSync(OUT_DIR, { recursive: true });

// ─── 1. Preprocess audio (once, reuse across all variants) ───
console.log('Preprocessing audio (shared across all variants)...');
const ts = Date.now();
const audioBytes = readFileSync(AUDIO);
const audioKey = `eval-inputs/f3_${ts}_audio.mp3`;
await supa.storage.from('voice-models').upload(audioKey, audioBytes, { contentType: 'audio/mpeg', upsert: true });
const { data: rawAudioSigned } = await supa.storage.from('voice-models').createSignedUrl(audioKey, 7200);

const apRes = await fetch(env.MODAL_AUDIO_PREPROCESS_URL, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ audio_url: rawAudioSigned.signedUrl }),
});
const apData = await apRes.json();
if (apData.error) { console.error('audio_preprocess failed:', apData.error); process.exit(1); }
console.log(`✓ Clean audio ready: ${apData.size_mb}MB\n`);

// ─── 2. Upload video (once) ───
const videoBytes = readFileSync(VIDEO);
const videoKey = `eval-inputs/f3_${ts}_video.mp4`;
await supa.storage.from('voice-models').upload(videoKey, videoBytes, { contentType: 'video/mp4', upsert: true });
const { data: videoSigned } = await supa.storage.from('voice-models').createSignedUrl(videoKey, 7200);

// ─── 3. Run each variant ───
const results = [];

for (const v of variants) {
  console.log(`━━━ ${v.label} ━━━`);

  // LatentSync
  const t0 = Date.now();
  const lsRes = await fetch(env.MODAL_LATENTSYNC_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoSigned.signedUrl,
      audio_url: apData.audio_url,
      guidance_scale: v.guidance_scale,
      inference_steps: v.inference_steps,
      enable_deepcache: v.enable_deepcache,
      normalize_fps: true,
    }),
  });
  const lsText = await lsRes.text();
  let lsData;
  try { lsData = JSON.parse(lsText); } catch {
    console.log(`  ✗ parse error: ${lsText.slice(0,200)}`);
    results.push({ ...v, error: 'LatentSync parse error' }); continue;
  }
  if (lsData.error) {
    console.log(`  ✗ LatentSync error: ${lsData.error}`);
    results.push({ ...v, error: lsData.error }); continue;
  }
  const lsElapsed = ((Date.now()-t0)/1000).toFixed(1);
  console.log(`  ✓ LatentSync in ${lsElapsed}s`);

  // Save video
  const outPath = resolve(OUT_DIR, `${v.id}.mp4`);
  writeFileSync(outPath, Buffer.from(await (await fetch(lsData.video_url)).arrayBuffer()));

  // SyncNet
  const snData = await (await fetch(env.MODAL_SYNCNET_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: lsData.video_url }),
  })).json();

  if (snData.error) {
    console.log(`  ✗ SyncNet: ${snData.error}`);
    results.push({ ...v, error: snData.error }); continue;
  }
  console.log(`  ✓ Sync-D=${snData.sync_d?.toFixed(3)} Sync-C=${snData.sync_c?.toFixed(3)}`);

  results.push({
    id: v.id, label: v.label,
    guidance_scale: v.guidance_scale,
    inference_steps: v.inference_steps,
    enable_deepcache: v.enable_deepcache,
    sync_d: snData.sync_d,
    sync_c: snData.sync_c,
    av_offset: snData.av_offset,
    latentsync_seconds: lsData.elapsed_seconds,
    output: outPath,
  });
}

// ─── 4. Report ───
// Sort by sync_d ascending (lower = better)
const scored = results.filter(r => !r.error).sort((a, b) => a.sync_d - b.sync_d);

const mdPath = resolve(OUT_DIR, 'scores.md');
let md = `# F3 — Param sweep: guidance × steps × deepcache

Generated: ${new Date().toISOString()}

Case fixo: **principal-flavio** (melhor baseline, Sync-D=6.838 com F1 CRF-18).
Pipeline: audio_preprocess → LatentSync (CRF 12) → SyncNet.
Objetivo: eleger params ideais pra produção.

## Resultados (ordenados por Sync-D ↑ melhor)

| Rank | Variante | Sync-D ↓ | Sync-C ↑ | AV offset | LatentSync time |
|---|---|---|---|---|---|
`;

scored.forEach((r, i) => {
  const baseline = r.id === 'v3-g20-s30-dc1' ? ' ← baseline prod' : '';
  md += `| ${i+1} | ${r.label}${baseline} | **${r.sync_d.toFixed(3)}** | **${r.sync_c.toFixed(3)}** | ${r.av_offset} | ${r.latentsync_seconds}s |\n`;
});

if (results.filter(r => r.error).length > 0) {
  md += `\n### Erros\n`;
  for (const r of results.filter(r => r.error)) md += `- ${r.label}: ${r.error}\n`;
}

md += `\n## Champion\n\n`;
if (scored.length > 0) {
  const best = scored[0];
  md += `**${best.label}** — Sync-D=${best.sync_d.toFixed(3)}, Sync-C=${best.sync_c.toFixed(3)}\n`;
  const prodBaseline = scored.find(r => r.id === 'v3-g20-s30-dc1');
  if (prodBaseline && best.id !== prodBaseline.id) {
    md += `\nΔ vs baseline prod: Sync-D ${(best.sync_d - prodBaseline.sync_d).toFixed(3)}, Sync-C ${(best.sync_c - prodBaseline.sync_c).toFixed(3)}\n`;
  } else {
    md += `\nBaseline prod já é o melhor! Manter configuração atual.\n`;
  }
}

writeFileSync(mdPath, md);
writeFileSync(mdPath.replace('.md', '.json'), JSON.stringify(results, null, 2));
console.log(`\n→ ${mdPath}`);
