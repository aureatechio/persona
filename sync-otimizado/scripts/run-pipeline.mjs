// Cliente do pipeline orquestrador.
// Faz upload dos inputs locais pro Supabase e chama MODAL_PIPELINE_URL.
//
// Usage:
//   node sync-otimizado/scripts/run-pipeline.mjs \
//     --video=samples/video_modelo_duda.mp4 \
//     --audio=samples/duda_arthur.mp3 \
//     [--no-audio-preprocess] \
//     [--no-face-refine] \
//     [--fidelity=0.7] \
//     [--steps=30] \
//     [--guidance=2.0] \
//     [--out=output.mp4]

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

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

// ─── Parse CLI args ───
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : true];
    }),
);

const videoPath = args.video;
const audioPath = args.audio;
if (!videoPath || !audioPath) {
  console.error('Usage: run-pipeline.mjs --video=<file> --audio=<file> [options]');
  console.error('Options: --no-audio-preprocess  --no-face-refine  --fidelity=0.7  --steps=30  --guidance=2.0  --out=output.mp4');
  process.exit(1);
}
if (!existsSync(videoPath)) { console.error(`Video not found: ${videoPath}`); process.exit(1); }
if (!existsSync(audioPath)) { console.error(`Audio not found: ${audioPath}`); process.exit(1); }

const audioPreprocess = args['no-audio-preprocess'] !== true;
const faceRefine       = args['no-face-refine'] !== true;
const fidelity         = parseFloat(args.fidelity ?? '0.7');
const steps            = parseInt(args.steps ?? '30');
const guidance         = parseFloat(args.guidance ?? '2.0');
const outPath          = args.out ?? `pipeline_output_${Date.now()}.mp4`;

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Upload inputs ───
const ts = Date.now();
console.log(`Uploading inputs...`);

const videoBytes = readFileSync(videoPath);
const audioBytes = readFileSync(audioPath);
const videoKey = `eval-inputs/pipeline_${ts}_video.mp4`;
const audioKey = `eval-inputs/pipeline_${ts}_audio`;

const [vidUp, audUp] = await Promise.all([
  supa.storage.from('voice-models').upload(videoKey, videoBytes, { contentType: 'video/mp4', upsert: true }),
  supa.storage.from('voice-models').upload(audioKey, audioBytes, { contentType: 'audio/mpeg', upsert: true }),
]);
if (vidUp.error) throw new Error(`video upload: ${vidUp.error.message}`);
if (audUp.error) throw new Error(`audio upload: ${audUp.error.message}`);

const [{ data: videoSigned }, { data: audioSigned }] = await Promise.all([
  supa.storage.from('voice-models').createSignedUrl(videoKey, 7200),
  supa.storage.from('voice-models').createSignedUrl(audioKey, 7200),
]);

console.log(`✓ Inputs uploaded`);
console.log(`Config: audio_preprocess=${audioPreprocess}, face_refine=${faceRefine}, guidance=${guidance}, steps=${steps}, fidelity=${fidelity}\n`);

// ─── Call pipeline ───
const t0 = Date.now();
const res = await fetch(env.MODAL_PIPELINE_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    video_url:       videoSigned.signedUrl,
    audio_url:       audioSigned.signedUrl,
    audio_preprocess: audioPreprocess,
    face_refine:      faceRefine,
    latentsync: { guidance_scale: guidance, inference_steps: steps, enable_deepcache: true, normalize_fps: true },
    face_refine_config: { fidelity_weight: fidelity },
  }),
});
const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
const data = await res.json();

console.log(`HTTP ${res.status} in ${elapsed} min`);

if (data.error) {
  console.error(`✗ Error at step "${data.failed_step}": ${data.error}`);
  process.exit(1);
}

// ─── Download output ───
const vidResp = await fetch(data.video_url);
const buf = Buffer.from(await vidResp.arrayBuffer());
writeFileSync(outPath, buf);

console.log(`✓ Saved: ${outPath} (${(buf.length / 1024 / 1024).toFixed(2)}MB)`);
console.log(`\nSteps run: ${data.steps_run.join(' → ')}`);
console.log(`Total: ${data.elapsed_seconds}s`);
console.log('\nStep breakdown:');
for (const [step, info] of Object.entries(data.steps ?? {})) {
  console.log(`  ${step}: ${info.elapsed_seconds}s`);
}
