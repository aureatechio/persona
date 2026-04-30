// Compare F4 (face refinement via CodeFormer) against F1 outputs.
// Takes F1 videos (already with audio preprocess + LatentSync) and applies CodeFormer.
// Saves refined videos + SyncNet scores to sync-otimizado/results/f4-face/

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

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

// Input: F1 outputs — audio_preprocess + LatentSync B
const cases = [
  { id: 'duda',             f1File: 'sync-otimizado/results/f1-audio/duda.mp4',             f1: { sync_d: 8.754, sync_c: 5.538 } },
  { id: 'flavio',           f1File: 'sync-otimizado/results/f1-audio/flavio.mp4',           f1: { sync_d: 7.482, sync_c: 7.453 } },
  { id: 'principal-flavio', f1File: 'sync-otimizado/results/f1-audio/principal-flavio.mp4', f1: { sync_d: 6.838, sync_c: 8.147 } },
];

const FIDELITY = 0.7;

const OUT_DIR = resolve(process.cwd(), 'sync-otimizado/results/f4-face');
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

  if (!existsSync(c.f1File)) {
    console.log(`  SKIP: F1 file not found: ${c.f1File}`);
    results.push({ ...c, skipped: true });
    continue;
  }

  const ts = Date.now();

  // ─── 1. Upload F1 video to Supabase ───
  console.log('  1/3  uploading F1 output...');
  const f1Url = await uploadAndSign(c.f1File, `eval-inputs/f4_${ts}_${c.id}_f1.mp4`, 'video/mp4');

  // ─── 2. Run CodeFormer face refinement ───
  console.log(`  2/3  face_refine (fidelity=${FIDELITY})...`);
  const t1 = Date.now();
  const frRes = await fetch(env.MODAL_FACE_REFINE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: f1Url, fidelity_weight: FIDELITY }),
  });
  const frText = await frRes.text();
  let frData;
  try { frData = JSON.parse(frText); } catch {
    console.log(`  ✗ face_refine parse error: ${frText.slice(0, 200)}`);
    results.push({ ...c, error: 'face_refine parse error' });
    continue;
  }
  if (frData.error) {
    console.log(`  ✗ face_refine error: ${frData.error}`);
    console.log(`    stderr_head: ${frData.stderr_head ?? frData.stderr ?? ''}`);
    console.log(`    stderr_tail: ${frData.stderr_tail ?? ''}`);
    results.push({ ...c, error: frData.error });
    continue;
  }
  console.log(`       ✓ in ${((Date.now()-t1)/1000).toFixed(1)}s — ${frData.size_mb}MB`);

  // Save locally
  const outVideo = resolve(OUT_DIR, `${c.id}.mp4`);
  const vidResp = await fetch(frData.video_url);
  const vidBuf = Buffer.from(await vidResp.arrayBuffer());
  writeFileSync(outVideo, vidBuf);

  // ─── 3. Score with SyncNet ───
  console.log('  3/3  scoring with SyncNet...');
  const t2 = Date.now();
  const snRes = await fetch(env.MODAL_SYNCNET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: frData.video_url }),
  });
  const snData = await snRes.json();
  if (snData.error) {
    console.log(`  ✗ SyncNet error: ${snData.error}`);
    results.push({ ...c, error: `SyncNet: ${snData.error}` });
    continue;
  }
  console.log(`       ✓ in ${((Date.now()-t2)/1000).toFixed(1)}s — Sync-D=${snData.sync_d?.toFixed(3)} Sync-C=${snData.sync_c?.toFixed(3)}`);

  results.push({
    case: c.id,
    f1: c.f1,
    f4: {
      sync_d: snData.sync_d,
      sync_c: snData.sync_c,
      av_offset: snData.av_offset,
      track_count: snData.track_count,
    },
    delta: {
      sync_d: +(snData.sync_d - c.f1.sync_d).toFixed(3),
      sync_c: +(snData.sync_c - c.f1.sync_c).toFixed(3),
    },
    output: outVideo,
    face_refine_seconds: frData.elapsed_seconds,
    syncnet_seconds: snData.elapsed_seconds,
  });
}

// ─── Markdown report ───
const mdPath = resolve(OUT_DIR, 'scores.md');
let md = `# F4 — Face refinement (CodeFormer): comparação contra F1

Generated: ${new Date().toISOString()}

**Pipeline F4:** audio_preprocess → LatentSync B → **CodeFormer face restoration** (fidelity_weight=${FIDELITY}).
**Comparação base:** F1 outputs (audio_preprocess + LatentSync B, sem face refine).

**Nota:** F4 é fundamentalmente uma melhoria VISUAL — o SyncNet mede sync de boca,
não textura/nitidez. Espera-se que Sync-D/C fiquem estáveis (ou piorem levemente),
enquanto a melhoria real aparece na avaliação visual dos .mp4.

## Resultados SyncNet

| Caso | Métrica | F1 (base) | F4 (+ CodeFormer) | Δ |
|---|---|---|---|---|
`;

for (const r of results) {
  if (r.skipped || r.error) {
    md += `| ${r.case} | — | — | ${r.error || 'skipped'} | — |\n`;
    continue;
  }
  md += `| ${r.case} | Sync-D ↓ | ${r.f1.sync_d.toFixed(3)} | **${r.f4.sync_d.toFixed(3)}** | ${r.delta.sync_d > 0 ? '+' : ''}${r.delta.sync_d} |\n`;
  md += `| ${r.case} | Sync-C ↑ | ${r.f1.sync_c.toFixed(3)} | **${r.f4.sync_c.toFixed(3)}** | ${r.delta.sync_c > 0 ? '+' : ''}${r.delta.sync_c} |\n`;
}

md += `\n## Outputs pra avaliação visual

| Caso | F1 (base) | F4 (+ CodeFormer) |
|---|---|---|
`;
for (const c of cases) {
  const r = results.find(x => x.case === c.id);
  const f4Path = r?.output ? `results/f4-face/${c.id}.mp4` : 'ERR';
  md += `| ${c.id} | results/f1-audio/${c.id}.mp4 | ${f4Path} |\n`;
}

md += `\n## Detalhes

`;
for (const r of results) {
  if (r.skipped || r.error) continue;
  md += `### ${r.case}\n`;
  md += `- CodeFormer: ${r.face_refine_seconds}s\n`;
  md += `- SyncNet: ${r.syncnet_seconds}s\n`;
  md += `- Tracks: ${r.f4.track_count}, AV offset: ${r.f4.av_offset}\n\n`;
}

writeFileSync(mdPath, md);
writeFileSync(mdPath.replace('.md', '.json'), JSON.stringify(results, null, 2));
console.log(`\n→ ${mdPath}`);
console.log(`→ ${mdPath.replace('.md', '.json')}`);
