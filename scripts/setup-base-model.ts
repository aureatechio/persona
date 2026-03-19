/**
 * Script to set up a new video base model:
 * 1. Upload video to Supabase Storage
 * 2. Extract audio via ffmpeg
 * 3. Clone voice via ElevenLabs
 * 4. Create DB records (voice_models + video_base_models)
 *
 * Usage: npx tsx scripts/setup-base-model.ts "/path/to/video.mp4" "Model Name"
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFileSync as readFileSyncText } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (no dotenv dependency)
const envPath = resolve(import.meta.dirname || __dirname, '..', '.env.local');
const envContent = readFileSyncText(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (match) process.env[match[1]] = match[2];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VIDEO_PATH = process.argv[2];
const MODEL_NAME = process.argv[3] || 'Ciro Nogueira';

if (!VIDEO_PATH) {
  console.error('Usage: npx tsx scripts/setup-base-model.ts "/path/to/video.mp4" "Model Name"');
  process.exit(1);
}

async function main() {
  console.log(`\n📹 Video: ${VIDEO_PATH}`);
  console.log(`📛 Model: ${MODEL_NAME}\n`);

  // 1. Read video file
  console.log('1/5 — Reading video file...');
  const videoBuffer = readFileSync(VIDEO_PATH);
  console.log(`   Size: ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);

  // 2. Upload video to Supabase Storage
  console.log('2/5 — Uploading video to Supabase Storage...');
  const storagePath = `base-models/${Date.now()}_${MODEL_NAME.replace(/\s+/g, '_')}.mp4`;

  const { error: uploadErr } = await supabase.storage
    .from('voice-models')
    .upload(storagePath, videoBuffer, {
      contentType: 'video/mp4',
      upsert: false,
    });

  if (uploadErr) {
    console.error('Upload failed:', uploadErr.message);
    process.exit(1);
  }
  console.log(`   Uploaded: ${storagePath}`);

  // 3. Extract audio with ffmpeg
  console.log('3/5 — Extracting audio with ffmpeg...');
  const tmpAudio = join(tmpdir(), `audio_${Date.now()}.mp3`);

  try {
    execFileSync('ffmpeg', [
      '-i', VIDEO_PATH,
      '-vn', '-acodec', 'libmp3lame', '-b:a', '128k',
      '-y', tmpAudio,
    ], { timeout: 120000, stdio: 'pipe' });
  } catch (err) {
    console.error('FFmpeg failed:', err);
    process.exit(1);
  }

  const audioBuffer = readFileSync(tmpAudio);
  console.log(`   Audio size: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Check ElevenLabs 11MB limit
  if (audioBuffer.length > 11 * 1024 * 1024) {
    console.error('Audio is over 11MB — ElevenLabs limit exceeded. Try a shorter video.');
    unlinkSync(tmpAudio);
    process.exit(1);
  }

  // 4. Clone voice via ElevenLabs
  console.log('4/5 — Cloning voice via ElevenLabs...');
  const form = new FormData();
  form.append('name', `VideoBase_${MODEL_NAME}_${Date.now()}`);
  form.append('files', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
  form.append('remove_background_noise', 'true');
  form.append('labels', JSON.stringify({ language: 'pt-BR' }));

  const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY },
    body: form,
  });

  if (!elRes.ok) {
    const errText = await elRes.text();
    console.error(`ElevenLabs error (${elRes.status}):`, errText);
    unlinkSync(tmpAudio);
    process.exit(1);
  }

  const elData = await elRes.json();
  const voiceId = elData.voice_id;
  console.log(`   Voice cloned! ID: ${voiceId}`);

  // Cleanup temp audio
  unlinkSync(tmpAudio);

  // 5. Create DB records
  console.log('5/5 — Creating DB records...');

  // 5a. Create voice_models record
  const { data: voiceModel, error: vmErr } = await supabase
    .from('voice_models')
    .insert({
      name: `Base: ${MODEL_NAME}`,
      status: 'approved',
      video_storage_path: storagePath,
      elevenlabs_voice_id: voiceId,
    })
    .select()
    .single();

  if (vmErr || !voiceModel) {
    console.error('voice_models insert failed:', vmErr?.message);
    process.exit(1);
  }
  console.log(`   voice_models created: ${voiceModel.id}`);

  // 5b. Deactivate existing base models
  await supabase
    .from('video_base_models')
    .update({ is_active: false })
    .eq('is_active', true);

  // 5c. Get current prompt template from the page default
  const promptTemplate = `Você é um assistente responsável por escrever respostas em vídeo para um político do estado do Piauí responder eleitores que gravaram vídeos falando por que apoiam ele ou qual é o principal problema da cidade ou do estado.

A resposta será lida pelo político em vídeo. O objetivo é fazer o eleitor sentir que foi ouvido, respeitado, teve sua realidade compreendida e que o político está próximo e atento ao Piauí.

A resposta deve parecer humana, natural e direta, como um vídeo curto gravado espontaneamente.

ESTRUTURA DA RESPOSTA:
1 — Início natural com o nome da pessoa. O nome NUNCA pode aparecer no início da frase. Sempre começar com uma pequena introdução e só depois mencionar o nome. Exemplos: "Meu amigo {nome},", "Muito obrigado pela sua mensagem, {nome},", "Que bom ouvir você, {nome},", "Obrigado por participar, {nome},".
2 — Reconhecer o problema citado. Mencionar brevemente a dor ou problema citado. Mostrar que o político entendeu a realidade local.
3 — Mensagem central sobre o PIAUÍ. Sempre reforçar que juntos é o caminho para resolver os problemas do Piauí. Ideias possíveis: juntos podemos transformar o estado, o Piauí precisa de união, é com trabalho conjunto que avançamos, ninguém resolve sozinho.
4 — Compromisso político realista. O político pode: lutar por melhorias, cobrar autoridades, defender a população, trabalhar por políticas públicas. NUNCA prometer resolver diretamente problemas executivos.
5 — Fechamento obrigatório com convite ou saudação. Exemplos: "Seguimos juntos pelo Piauí.", "Conte comigo nessa caminhada.", "Vamos juntos transformar o Piauí."

REGRA PARA PEGADINHAS OU OFENSAS:
Se o vídeo contiver piadas, provocações, ofensas ou situações não sérias: responder de forma educada, neutra e elegante. Encerrar de forma positiva. Nunca reagir com agressividade ou ironia.

REGRA PARA NOMES DE CIDADES E BAIRROS:
Sempre escreva o nome completo da cidade ou bairro exatamente como se pronuncia em português brasileiro. NUNCA abrevie ou corte nomes. Se o eleitor mencionar uma cidade, repita o nome completo na resposta.

TAMANHO: máximo 35 palavras. Nunca ultrapassar esse limite.
TOM: humano, próximo, respeitoso, simples, verdadeiro. Evitar discurso longo, frases artificiais ou propaganda exagerada.
Sem emojis. Apenas gere o texto da resposta, sem explicações ou comentários.`;

  // 5d. Create video_base_models record
  const { data: baseModel, error: bmErr } = await supabase
    .from('video_base_models')
    .insert({
      name: MODEL_NAME,
      video_storage_path: storagePath,
      voice_model_id: voiceModel.id,
      prompt_template: promptTemplate,
      lipsync_config: { model: 'lipsync-2-pro', sync_mode: 'loop', temperature: 0.3 },
      is_active: true,
    })
    .select('*, voice_models(*)')
    .single();

  if (bmErr) {
    console.error('video_base_models insert failed:', bmErr.message);
    process.exit(1);
  }

  console.log(`   video_base_models created: ${baseModel.id}`);
  console.log(`\n✅ Done! Model "${MODEL_NAME}" is now active.`);
  console.log(`   Voice ID: ${voiceId}`);
  console.log(`   Video: ${storagePath}`);
  console.log(`   Prompt: Piauí (35 palavras)\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
