// Compare F1 (audio preprocess) against baseline.
// For each case: audio_preprocess → LatentSync (variant B = prod config) → SyncNet → table.
//
// Saves:
//   sync-otimizado/results/f1-audio/scores.md
//   sync-otimizado/results/f1-audio/scores.json
//   sync-otimizado/results/f1-audio/<case>.mp4 (each output for visual review)

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
  { id: 'duda',             video: 'sync-otimizado/samples-control/video_modelo_duda.mp4',          audio: 'sync-otimizado/samples-control/duda_arthur.mp3',     baseline: { sync_d: 8.726, sync_c: 5.611 } },
  { id: 'flavio',           video: 'sync-otimizado/samples-control/flavioBolsonaro-modelo-v2.mp4', audio: 'sync-otimizado/samples-control/flavio-audio-v2.mp3', baseline: { sync_d: 7.673, sync_c: 7.217 } },
  { id: 'principal-flavio', video: 'sync-otimizado/samples-control/1774132135537_Modelo_Principal.mp4', audio: 'sync-otimizado/samples-control/flavio-audio-v2.mp3', baseline: { sync_d: 7.352, sync_c: 7.711 } },
];

// Variant B = production config
const VARIANT = { guidance_scale: 2.0, inference_steps: 30, enable_deepcache: true, normalize_fps: true };

const OUT_DIR = resolve(process.cwd(), 'sync-otimizado/results/f1-audio');
mkdirSync(OUT_DIR, { recursive: true });

async function uploadAndSign(localPath, key, contentType) {
  const bytes = readFileSync(localPath);
  const up = await supa.storage.from('voice-models').upload(key, bytes, { contentType, upsert: true });
  if (up.error) throw new Error(`upload ${localPath}: ${up.error.message}`);
  const { data } = await supa.storage.from('voice-models').createSignedUrl(key, 7200);
  return data.signedUrl;
}

const results = [];

for (const c of cases) {
  console.log(`\n━━━ Case: ${c.id} ━━━`);

  if (!existsSync(c.video) || !existsSync(c.audio)) {
    console.log(`  SKIP: input file missing`);
    results.push({ ...c, skipped: true });
    continue;
  }

  const ts = Date.now();

  // ─── 1. Upload original audio ───
  console.log('  1/4  uploading raw audio...');
  const rawAudioUrl = await uploadAndSign(c.audio, `eval-inputs/f1_${ts}_${c.id}_raw_audio.mp3`, 'audio/mpeg');

  // ─── 2. Audio preprocess ───
  console.log('  2/4  audio_preprocess...');
  const t1 = Date.now();
  const apRes = await fetch(env.MODAL_AUDIO_PREPROCESS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: rawAudioUrl }),
  });
  const apData = await apRes.json();
  if (apData.error) {
    console.log(`  ✗ audio_preprocess error: ${apData.error}`);
    results.push({ ...c, error: `audio_preprocess: ${apData.error}` });
    continue;
  }
  console.log(`       ✓ in ${((Date.now()-t1)/1000).toFixed(1)}s — ${apData.size_mb}MB cleaned WAV`);

  // ─── 3. Upload original video + run LatentSync with cleaned audio ───
  console.log('  3/4  uploading video + running LatentSync...');
  const videoUrl = await uploadAndSign(c.video, `eval-inputs/f1_${ts}_${c.id}_video.mp4`, 'video/mp4');

  const t2 = Date.now();
  const lsRes = await fetch(env.MODAL_LATENTSYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoUrl,
      audio_url: apData.audio_url,
      ...VARIANT,
    }),
  });
  const lsText = await lsRes.text();
  let lsData;
  try { lsData = JSON.parse(lsText); }
  catch { console.log(`  ✗ LatentSync parse error: ${lsText.slice(0, 200)}`); results.push({ ...c, error: 'LatentSync parse error' }); continue; }
  if (lsData.error) {
    console.log(`  ✗ LatentSync error: ${lsData.error}`);
    results.push({ ...c, error: `LatentSync: ${lsData.error.slice(0, 200)}` });
    continue;
  }
  console.log(`       ✓ in ${((Date.now()-t2)/1000).toFixed(1)}s — input_fps=${lsData.input_fps} normalized=${lsData.fps_normalized_to_25}`);

  // Save the output locally
  const outVideo = resolve(OUT_DIR, `${c.id}.mp4`);
  const vidResp = await fetch(lsData.video_url);
  const vidBuf = Buffer.from(await vidResp.arrayBuffer());
  writeFileSync(outVideo, vidBuf);

  // ─── 4. Score with SyncNet ───
  console.log('  4/4  scoring with SyncNet...');
  const t3 = Date.now();
  const snRes = await fetch(env.MODAL_SYNCNET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: lsData.video_url }),
  });
  const snData = await snRes.json();
  if (snData.error) {
    console.log(`  ✗ SyncNet error: ${snData.error}`);
    results.push({ ...c, error: `SyncNet: ${snData.error}` });
    continue;
  }
  console.log(`       ✓ in ${((Date.now()-t3)/1000).toFixed(1)}s — Sync-D=${snData.sync_d?.toFixed(3)} Sync-C=${snData.sync_c?.toFixed(3)}`);

  results.push({
    case: c.id,
    baseline: c.baseline,
    f1: {
      sync_d: snData.sync_d,
      sync_c: snData.sync_c,
      av_offset: snData.av_offset,
      track_count: snData.track_count,
    },
    delta: {
      sync_d: +(snData.sync_d - c.baseline.sync_d).toFixed(3),
      sync_c: +(snData.sync_c - c.baseline.sync_c).toFixed(3),
    },
    output: outVideo,
    audio_preprocess_seconds: apData.elapsed_seconds,
    latentsync_seconds: lsData.elapsed_seconds,
    syncnet_seconds: snData.elapsed_seconds,
  });
}

// ─── Markdown report ───
const mdPath = resolve(OUT_DIR, 'scores.md');
let md = `# F1 — Audio preprocess: comparação contra baseline

Generated: ${new Date().toISOString()}

**Pipeline F1:** ffmpeg \`afftdn (denoise) → highpass 80Hz → lowpass 8kHz → loudnorm EBU R128 -16 LUFS → mono 44.1kHz\` → LatentSync (variant B, prod).
**Baseline:** mesma config B sem audio preprocess.

## Resultados

| Caso | Métrica | Baseline | F1 (audio preproc) | Δ |
|---|---|---|---|---|
`;

for (const r of results) {
  if (r.skipped || r.error) {
    md += `| ${r.case} | — | — | ${r.error || 'skipped'} | — |\n`;
    continue;
  }
  const dArrow = r.delta.sync_d < 0 ? '↓' : (r.delta.sync_d > 0 ? '↑' : '=');
  const cArrow = r.delta.sync_c > 0 ? '↑' : (r.delta.sync_c < 0 ? '↓' : '=');
  md += `| ${r.case} | Sync-D ↓ | ${r.baseline.sync_d.toFixed(3)} | **${r.f1.sync_d.toFixed(3)}** | ${r.delta.sync_d > 0 ? '+' : ''}${r.delta.sync_d} ${dArrow} |\n`;
  md += `| ${r.case} | Sync-C ↑ | ${r.baseline.sync_c.toFixed(3)} | **${r.f1.sync_c.toFixed(3)}** | ${r.delta.sync_c > 0 ? '+' : ''}${r.delta.sync_c} ${cArrow} |\n`;
}

md += `\n## Detalhes

`;
for (const r of results) {
  if (r.skipped || r.error) continue;
  md += `### ${r.case}\n`;
  md += `- Output: \`${r.output.replace(process.cwd() + '\\\\', '')}\`\n`;
  md += `- Tempos: audio_preprocess ${r.audio_preprocess_seconds}s + LatentSync ${r.latentsync_seconds}s + SyncNet ${r.syncnet_seconds}s\n`;
  md += `- Tracks SyncNet: ${r.f1.track_count}, AV offset: ${r.f1.av_offset}\n\n`;
}

md += `\n## Conclusão

`;
const wins = results.filter(r => !r.error && !r.skipped && (r.delta.sync_d < 0 || r.delta.sync_c > 0)).length;
const total = results.filter(r => !r.error && !r.skipped).length;
md += `${wins}/${total} casos melhoraram em pelo menos uma métrica.\n`;

writeFileSync(mdPath, md);
writeFileSync(mdPath.replace('.md', '.json'), JSON.stringify(results, null, 2));
console.log(`\n→ ${mdPath}`);
console.log(`→ ${mdPath.replace('.md', '.json')}`);
