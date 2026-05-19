/**
 * List custom voices on ElevenLabs and cross-reference with voice_models in DB.
 * Output: which voices are referenced by an active base_model, which are orphan.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname || __dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY!;

interface ElVoice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  created_at_unix?: number;
}

async function main() {
  // Fetch ElevenLabs voices
  const elRes = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': ELEVENLABS_KEY },
  });
  if (!elRes.ok) throw new Error(`ElevenLabs ${elRes.status}: ${await elRes.text()}`);
  const elData = (await elRes.json()) as { voices: ElVoice[] };

  // Filter to custom-cloned voices only (skip premade library voices)
  const customVoices = elData.voices.filter(
    (v) => v.category === 'cloned' || v.category === 'generated',
  );

  // Fetch all voice_models from DB
  const { data: voiceModels } = await supabase
    .from('voice_models')
    .select('id, name, elevenlabs_voice_id, status, created_at');

  // Fetch active video_base_models that reference voices
  const { data: baseModels } = await supabase
    .from('video_base_models')
    .select('slug, display_name, voice_model_id, is_active');

  const referencedVoiceModelIds = new Set(
    (baseModels || []).filter((b) => b.is_active && b.voice_model_id).map((b) => b.voice_model_id),
  );

  console.log(`\nElevenLabs custom voices: ${customVoices.length} / 10\n`);
  console.log('Voice ID                        | Name                                | DB status   | Referenced by');
  console.log('-'.repeat(120));

  for (const v of customVoices) {
    const dbRow = (voiceModels || []).find((vm) => vm.elevenlabs_voice_id === v.voice_id);
    const refBase = (baseModels || []).find(
      (b) => b.is_active && dbRow && b.voice_model_id === dbRow.id,
    );

    const dbStatus = dbRow ? `id=${dbRow.id.slice(0, 8)}…` : 'NOT IN DB';
    const reference = refBase ? `ACTIVE base: ${refBase.display_name || refBase.slug}` : (dbRow ? '(orphan)' : '(orphan)');

    console.log(
      `${v.voice_id.padEnd(32)} | ${v.name.slice(0, 35).padEnd(35)} | ${dbStatus.padEnd(11)} | ${reference}`,
    );
  }
  console.log();
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
