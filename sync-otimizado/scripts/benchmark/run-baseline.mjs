// Score all baseline outputs (current production state) with SyncNet.
// Writes sync-otimizado/results/baseline/scores.md with the table.

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

const baseline = [
  { case: 'duda',             variant: 'A', config: 'g=1.5 steps=50 dc=off', file: 'latentsync_A_25fps.mp4' },
  { case: 'duda',             variant: 'B', config: 'g=2.0 steps=30 dc=on',  file: 'latentsync_B_25fps.mp4' },
  { case: 'duda',             variant: 'C', config: 'g=2.5 steps=40 dc=off', file: 'latentsync_C_25fps.mp4' },
  { case: 'flavio',           variant: 'A', config: 'g=1.5 steps=50 dc=off', file: 'latentsync_A_25fps_flavio.mp4' },
  { case: 'flavio',           variant: 'B', config: 'g=2.0 steps=30 dc=on',  file: 'latentsync_B_25fps_flavio.mp4' },
  { case: 'principal-flavio', variant: 'B', config: 'g=2.0 steps=30 dc=on',  file: 'latentsync_B_25fps_principal_flavio.mp4' },
];

const results = [];

for (const item of baseline) {
  if (!existsSync(item.file)) {
    console.log(`SKIP ${item.case}-${item.variant}: ${item.file} not found`);
    results.push({ ...item, skipped: true });
    continue;
  }

  const bytes = readFileSync(item.file);
  const key = `eval-inputs/baseline_${Date.now()}_${item.file}`;
  console.log(`[${item.case}-${item.variant}] uploading...`);
  const up = await supa.storage.from('voice-models').upload(key, bytes, { contentType: 'video/mp4', upsert: true });
  if (up.error) {
    console.error(`  upload error: ${up.error.message}`);
    results.push({ ...item, error: up.error.message });
    continue;
  }
  const { data: signed } = await supa.storage.from('voice-models').createSignedUrl(key, 3600);

  console.log(`[${item.case}-${item.variant}] scoring...`);
  const t0 = Date.now();
  const res = await fetch(env.MODAL_SYNCNET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: signed.signedUrl }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const data = await res.json();

  if (data.error) {
    console.log(`  ✗ error: ${data.error}`);
    results.push({ ...item, error: data.error, elapsed });
  } else {
    console.log(`  ✓ Sync-D=${data.sync_d?.toFixed(3)} Sync-C=${data.sync_c?.toFixed(3)} offset=${data.av_offset} (${elapsed}s, ${data.track_count} tracks)`);
    results.push({ ...item, ...data, scoringElapsed: elapsed });
  }
}

// ─── Generate markdown ───
const outPath = resolve(process.cwd(), 'sync-otimizado/results/baseline/scores.md');
mkdirSync(dirname(outPath), { recursive: true });

let md = `# Baseline scores (SyncNet)

Generated: ${new Date().toISOString()}

**Métrica:**
- **Sync-D** (LSE-D): distância áudio↔boca. **MENOR = melhor**. Range típico 5-15.
- **Sync-C** (LSE-C): confiança no sync. **MAIOR = melhor**. Range típico 1-9.
- **AV offset**: deslocamento ótimo em frames (@25fps). Idealmente 0.
- **Tracks**: número de faces detectadas (best track é o de maior confidence).

Pipeline atual: \`modal-enhance/latentsync_app.py\` com \`normalize_fps=true\`. A configuração de produção é a variante **B** (guidance=2.0, steps=30, deepcache=on).

## Resultados

| Caso | Variante | Config | Sync-D ↓ | Sync-C ↑ | AV offset | Tracks |
|---|---|---|---|---|---|---|
`;

for (const r of results) {
  if (r.skipped) {
    md += `| ${r.case} | ${r.variant} | ${r.config} | — | — | — | (file not found) |\n`;
  } else if (r.error) {
    md += `| ${r.case} | ${r.variant} | ${r.config} | ERR | ERR | — | ${r.error.slice(0, 50)} |\n`;
  } else {
    md += `| ${r.case} | ${r.variant} | ${r.config} | **${r.sync_d?.toFixed(3)}** | **${r.sync_c?.toFixed(3)}** | ${r.av_offset} | ${r.track_count} |\n`;
  }
}

md += `\n## Detalhamento por caso

`;

const grouped = {};
for (const r of results) {
  if (!grouped[r.case]) grouped[r.case] = [];
  grouped[r.case].push(r);
}

for (const [caseName, items] of Object.entries(grouped)) {
  md += `### ${caseName}\n\n`;
  for (const r of items) {
    if (r.skipped || r.error) continue;
    md += `- **${r.variant}** (${r.config})\n`;
    md += `  - Best track: \#${r.best_track} of ${r.track_count}\n`;
    md += `  - All Sync-D: ${r.all_dists?.map(d => d.toFixed(3)).join(', ')}\n`;
    md += `  - All Sync-C: ${r.all_confs?.map(c => c.toFixed(3)).join(', ')}\n`;
  }
  md += `\n`;
}

writeFileSync(outPath, md);
console.log(`\n→ ${outPath}`);

// Also write JSON for later programmatic comparison
const jsonPath = outPath.replace('.md', '.json');
writeFileSync(jsonPath, JSON.stringify(results, null, 2));
console.log(`→ ${jsonPath}`);
