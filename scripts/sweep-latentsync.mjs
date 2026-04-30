// Runs 3 parameter variants through LatentSync Modal endpoint, downloads each.
// Output files: latentsync_A_25fps.mp4, latentsync_B_25fps.mp4, latentsync_C_25fps.mp4
// Uses local samples uploaded to Supabase storage as signed URLs.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
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

// ─── Upload local samples to Supabase and get signed URLs ───
const VIDEO_PATH = resolve(process.cwd(), 'samples/flavioBolsonaro-modelo-v2.mp4');
const AUDIO_PATH = resolve(process.cwd(), 'samples/flavio-audio-v2.mp3');
const OUTPUT_TAG = 'flavio';
const TS = Date.now();
const VIDEO_KEY = `test-inputs/sweep_${TS}_video.mp4`;
const AUDIO_KEY = `test-inputs/sweep_${TS}_audio.mp3`;

console.log(`Uploading inputs...`);
const videoBytes = readFileSync(VIDEO_PATH);
const audioBytes = readFileSync(AUDIO_PATH);

const [vidUp, audUp] = await Promise.all([
  supa.storage.from('voice-models').upload(VIDEO_KEY, videoBytes, { contentType: 'video/mp4', upsert: true }),
  supa.storage.from('voice-models').upload(AUDIO_KEY, audioBytes, { contentType: 'audio/mpeg', upsert: true }),
]);
if (vidUp.error) throw new Error(`video upload: ${vidUp.error.message}`);
if (audUp.error) throw new Error(`audio upload: ${audUp.error.message}`);

const [{ data: videoSigned }, { data: audioSigned }] = await Promise.all([
  supa.storage.from('voice-models').createSignedUrl(VIDEO_KEY, 7200),
  supa.storage.from('voice-models').createSignedUrl(AUDIO_KEY, 7200),
]);

console.log(`✓ Inputs uploaded: ${VIDEO_KEY}, ${AUDIO_KEY}\n`);

const variants = [
  { name: 'A_25fps', label: 'A (paper default + 25fps)', guidance_scale: 1.5, inference_steps: 50, enable_deepcache: false, normalize_fps: true },
  { name: 'B_25fps', label: 'B (balanced + 25fps)',      guidance_scale: 2.0, inference_steps: 30, enable_deepcache: true,  normalize_fps: true },
  { name: 'C_25fps', label: 'C (high refine + 25fps)',   guidance_scale: 2.5, inference_steps: 40, enable_deepcache: false, normalize_fps: true },
];

const results = [];
for (const v of variants) {
  console.log(`━━━ Running variant ${v.label} (guidance=${v.guidance_scale}, steps=${v.inference_steps}, deepcache=${v.enable_deepcache}) ━━━`);
  const t0 = Date.now();
  const res = await fetch(env.MODAL_LATENTSYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoSigned.signedUrl,
      audio_url: audioSigned.signedUrl,
      guidance_scale: v.guidance_scale,
      inference_steps: v.inference_steps,
      enable_deepcache: v.enable_deepcache,
      normalize_fps: v.normalize_fps,
    }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  HTTP ${res.status} in ${elapsed}s`);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data.error) {
      console.log(`  ✗ ERROR: ${data.error.slice(0, 300)}`);
      results.push({ ...v, ok: false, error: data.error });
      continue;
    }
    const vidResp = await fetch(data.video_url);
    const buf = Buffer.from(await vidResp.arrayBuffer());
    const outPath = `latentsync_${v.name}_${OUTPUT_TAG}.mp4`;
    writeFileSync(outPath, buf);
    console.log(`  ✓ Saved: ${outPath} (${(buf.length / 1024 / 1024).toFixed(2)}MB, elapsed=${data.elapsed_seconds}s)`);
    console.log(`    input_fps=${data.input_fps} fps_normalized_to_25=${data.fps_normalized_to_25}`);
    results.push({ ...v, ok: true, path: outPath, elapsed: data.elapsed_seconds, mb: +(buf.length / 1024 / 1024).toFixed(2), inputFps: data.input_fps, normalized: data.fps_normalized_to_25 });
  } catch (err) {
    console.log(`  ✗ parse error: ${text.slice(0, 200)}`);
    results.push({ ...v, ok: false, error: text.slice(0, 200) });
  }
}

console.log('\n━━━ Summary ━━━');
for (const r of results) {
  if (r.ok) console.log(`✓ ${r.label}: ${r.path} (${r.mb}MB, ${r.elapsed}s, input_fps=${r.inputFps}, normalized=${r.normalized})`);
  else console.log(`✗ ${r.label}: ${r.error?.slice(0, 150)}`);
}
