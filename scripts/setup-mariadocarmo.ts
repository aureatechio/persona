/**
 * Setup base-model row for Maria do Carmo Seffair (pré-candidata Governo do Amazonas).
 *
 * Steps:
 *  1. Trim leading + trailing silence from the source .mp4 with ffmpeg.
 *  2. Upload trimmed video to Supabase Storage (voice-models/base-models/mariadocarmo/...).
 *  3. Extract audio (mp3 mono 22050Hz 64k) and clone voice via ElevenLabs IVC.
 *  4. Insert voice_models + video_base_models rows.
 *
 * Idempotency: this script appends a new row each run; it does NOT deactivate
 * other politicians' base models (unlike the admin POST endpoint).
 *
 * Usage:
 *   npx tsx scripts/setup-mariadocarmo.ts "/path/to/source.mp4"
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const execFile = promisify(execFileCb);

// ── env ────────────────────────────────────────────────────────────────
const envPath = resolve(import.meta.dirname || __dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (m) process.env[m[1]] = m[2];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !ELEVENLABS_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ELEVENLABS_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── inputs ─────────────────────────────────────────────────────────────
const VIDEO_PATH = process.argv[2];
const SLUG = 'mariadocarmo';
const DISPLAY_NAME = 'Maria do Carmo';
const MODEL_NAME = 'Maria do Carmo Seffair v1';

if (!VIDEO_PATH) {
  console.error('Usage: npx tsx scripts/setup-mariadocarmo.ts "/path/to/video.mp4"');
  process.exit(1);
}

// ── prompt template (Ciro adapted for Amazonas / pré-candidata Governo) ────
const PROMPT_TEMPLATE = `**PROMPT DO AGENTE — RESPOSTA DA PRÉ-CANDIDATA AO GOVERNO (AMAZONAS — IDEIAS PARA PLANO DE GOVERNO)**

Você é um assistente responsável por escrever respostas em vídeo para uma **pré-candidata ao Governo do Amazonas** responder eleitores que enviaram vídeos com:

sugestões pro plano de governo
ideias pra melhorar o Amazonas

A resposta será lida pela pré-candidata em vídeo.

O objetivo é fazer o eleitor sentir que:

foi ouvido
foi valorizado
sua ideia é relevante
a pré-candidata tá construindo junto com a população

A resposta deve parecer humana, natural e direta, como um vídeo curto gravado espontaneamente.

---

## ESTRUTURA DA RESPOSTA

A resposta deve sempre seguir esta lógica:

### 1 — Início natural com o nome da pessoa

O nome da pessoa **NUNCA pode aparecer no início da frase**.

Sempre começar com uma pequena introdução e só depois mencionar o nome.

Exemplos de início correto:

Muito obrigado pela sua contribuição, João Carlos,
Que bom receber sua ideia, João Carlos,
Obrigado por participar, João Carlos,
Fico muito feliz com sua mensagem, João Carlos,

Nunca começar com:

João Carlos, obrigado...

---

### 2 — Reconhecer a ideia

Mencione brevemente a ideia enviada.

Mostre que a pré-candidata entendeu e valorizou.

---

### 3 — Mensagem central (construção de plano)

Reforçar que o plano tá sendo construído com participação da população e **incluir obrigatoriamente a expressão "plano de governo"** de forma natural na fala.

Usar ideias como:

o Amazonas precisa de soluções práticas
boas ideias constroem um estado melhor
é ouvindo as pessoas que a gente acerta
o plano de governo precisa refletir a realidade do povo
o estado precisa avançar

**Estilo de construção:**

frases curtas
tom direto
linguagem simples
ritmo de fala natural

**Evitar:**

promessas específicas
linguagem agressiva
discurso longo

**Objetivo do tom:**
valorização + proximidade + construção + direção

---

### 4 — Compromisso político

A pré-candidata pode:

avaliar e considerar a ideia
levar propostas adiante
trabalhar por soluções reais
defender melhorias pro Amazonas

---

### 5 — Fechamento obrigatório

A resposta deve terminar **exatamente** com:

**Conte comigo nessa caminhada!**

Não variar. Não complementar após essa frase.

---

## REGRA PARA PEGADINHAS OU OFENSAS

Se o vídeo contiver:

piadas
provocações
ofensas
situações não sérias

A resposta deve ser educada, neutra e elegante.

---

## TAMANHO DA RESPOSTA

A resposta deve ter **no máximo 35 palavras**.

Nunca ultrapassar esse limite.

---

## TOM DA FALA

O tom deve ser:

humano
próximo
respeitoso
direto
verdadeiro

Evitar:

discurso longo
frases artificiais
propaganda exagerada

---

## AJUSTE DE LINGUAGEM (OBRIGATÓRIO)

Usar linguagem falada, simples e natural.

Substituir sempre que possível:

para → **pra**
está → **tá**
estamos → **tamo** (com moderação)
vamos → **vamo** (com moderação)

Regras:

priorizar contrações naturais
evitar linguagem formal
soar como fala espontânea de vídeo
manter clareza e respeito

---

## EXEMPLO

Entrada:

Nome: José Henrique
Cidade: Manaus
Ideia: melhorar segurança

Resposta:

Muito obrigado pela sua contribuição, José Henrique. Sua ideia sobre segurança é importante e precisa entrar no plano de governo. É assim, ouvindo você, que a gente constrói soluções reais pro Amazonas. Conte comigo nessa caminhada!

---

## INSTRUÇÃO FINAL

Sempre escreva apenas o texto da fala.

Não explique nada.
Não escreva comentários.
Não adicione instruções.

Apenas gere o texto da resposta.`;

// ── ffmpeg helpers ─────────────────────────────────────────────────────
// Detects up to two silence regions: at the very start (silence_start ≈ 0) and
// at the very end (silence_end ≈ duration). Returns [headEnd, tailStart].
async function detectEdgeSilences(
  inputPath: string,
  duration: number,
): Promise<{ headEnd: number; tailStart: number }> {
  let stderr = '';
  try {
    const r = await execFile('ffmpeg', [
      '-hide_banner',
      '-i', inputPath,
      '-af', 'silencedetect=noise=-30dB:duration=0.3',
      '-f', 'null',
      '-',
    ]);
    stderr = r.stderr;
  } catch (e) {
    stderr = (e as { stderr?: string })?.stderr ?? '';
  }

  // Parse all silence segments. ffmpeg emits pairs: silence_start: X / silence_end: Y.
  const segments: Array<{ start: number; end: number }> = [];
  const re = /silence_start:\s*([0-9.]+)[\s\S]*?silence_end:\s*([0-9.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stderr)) !== null) {
    segments.push({ start: parseFloat(m[1]), end: parseFloat(m[2]) });
  }

  // Last silence may not close (silence_end missing if it runs to EOF).
  // Capture trailing one-sided silence_start without a matching end.
  const onlyStarts = Array.from(stderr.matchAll(/silence_start:\s*([0-9.]+)/g)).map((x) => parseFloat(x[1]));
  const onlyEnds = Array.from(stderr.matchAll(/silence_end:\s*([0-9.]+)/g)).map((x) => parseFloat(x[1]));
  if (onlyStarts.length > onlyEnds.length) {
    const trailingStart = onlyStarts[onlyStarts.length - 1];
    segments.push({ start: trailingStart, end: duration });
  }

  let headEnd = 0;
  let tailStart = duration;

  for (const seg of segments) {
    // Leading silence — anchored at (or very near) the very start.
    if (seg.start <= 0.15 && seg.end > headEnd) headEnd = Math.min(seg.end, 5);
    // Trailing silence — ends at (or very near) duration.
    if (duration - seg.end <= 0.5 && seg.start < tailStart) {
      tailStart = Math.max(seg.start, duration - 5);
    }
  }

  return { headEnd, tailStart };
}

async function probeDuration(inputPath: string): Promise<number> {
  const { stdout } = await execFile('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ]);
  return parseFloat(stdout.trim());
}

async function trimVideo(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
) {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (startSec > 0) args.push('-ss', startSec.toFixed(3));
  args.push('-i', inputPath);
  args.push('-t', (endSec - startSec).toFixed(3));
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y', outputPath,
  );
  await execFile('ffmpeg', args, { timeout: 180000 });
}

async function extractAudio(inputPath: string, outputPath: string) {
  await execFile('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', inputPath,
    '-vn', '-ac', '1', '-ar', '22050',
    '-acodec', 'libmp3lame', '-b:a', '64k',
    '-y', outputPath,
  ], { timeout: 120000 });
}

// ── main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nVideo  : ${VIDEO_PATH}`);
  console.log(`Slug   : ${SLUG}`);
  console.log(`Name   : ${DISPLAY_NAME}\n`);

  const stamp = Date.now();
  const workInput = VIDEO_PATH;
  const trimmedPath = join(tmpdir(), `mariadocarmo_trimmed_${stamp}.mp4`);
  const audioPath = join(tmpdir(), `mariadocarmo_audio_${stamp}.mp3`);

  try {
    // 1/6 — Probe + detect silences
    console.log('1/6 — Detecting silence at edges...');
    const duration = await probeDuration(workInput);
    const { headEnd, tailStart } = await detectEdgeSilences(workInput, duration);
    const trimHead = headEnd > 0.15 ? headEnd : 0;
    const trimTail = duration - tailStart > 0.15 ? tailStart : duration;
    console.log(`   Duration : ${duration.toFixed(2)}s`);
    console.log(`   Head cut : ${trimHead.toFixed(2)}s`);
    console.log(`   Tail end : ${trimTail.toFixed(2)}s (cuts ${(duration - trimTail).toFixed(2)}s)`);
    console.log(`   Result   : ${(trimTail - trimHead).toFixed(2)}s\n`);

    // 2/6 — Trim
    console.log('2/6 — Trimming video...');
    await trimVideo(workInput, trimmedPath, trimHead, trimTail);
    const trimmedBytes = readFileSync(trimmedPath);
    console.log(`   Trimmed size: ${(trimmedBytes.length / 1024 / 1024).toFixed(2)}MB\n`);

    // 3/6 — Upload trimmed video to Storage
    console.log('3/6 — Uploading trimmed video to Supabase Storage...');
    const storagePath = `base-models/${SLUG}/base_${stamp}.mp4`;
    const { error: upErr } = await supabase.storage
      .from('voice-models')
      .upload(storagePath, trimmedBytes, { contentType: 'video/mp4', upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    console.log(`   Uploaded: ${storagePath}\n`);

    // 4/6 — Extract audio
    console.log('4/6 — Extracting audio (mono 22050Hz 64k)...');
    await extractAudio(trimmedPath, audioPath);
    const audioBytes = readFileSync(audioPath);
    console.log(`   Audio size: ${(audioBytes.length / 1024 / 1024).toFixed(2)}MB`);
    if (audioBytes.length > 11 * 1024 * 1024) {
      throw new Error('Audio exceeds ElevenLabs 11MB limit');
    }
    console.log();

    // 5/6 — ElevenLabs Instant Voice Clone
    console.log('5/6 — Cloning voice via ElevenLabs IVC...');
    const form = new FormData();
    form.append('name', `VideoBase_MariadoCarmo_${stamp}`);
    form.append('files', new Blob([new Uint8Array(audioBytes)], { type: 'audio/mpeg' }), 'audio.mp3');
    form.append('remove_background_noise', 'true');
    form.append('labels', JSON.stringify({ language: 'pt-BR' }));

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_KEY },
      body: form,
    });
    if (!elRes.ok) {
      const t = await elRes.text();
      throw new Error(`ElevenLabs ${elRes.status}: ${t.slice(0, 300)}`);
    }
    const elData = (await elRes.json()) as { voice_id: string };
    const voiceId = elData.voice_id;
    console.log(`   Voice ID: ${voiceId}\n`);

    // 6/6 — DB inserts
    console.log('6/6 — Creating DB records...');

    const { data: voiceModel, error: vmErr } = await supabase
      .from('voice_models')
      .insert({
        name: `Base: ${DISPLAY_NAME}`,
        status: 'approved',
        video_storage_path: storagePath,
        elevenlabs_voice_id: voiceId,
      })
      .select()
      .single();
    if (vmErr || !voiceModel) throw new Error(`voice_models insert: ${vmErr?.message}`);
    console.log(`   voice_models  : ${voiceModel.id}`);

    const { data: baseModel, error: bmErr } = await supabase
      .from('video_base_models')
      .insert({
        name: MODEL_NAME,
        slug: SLUG,
        display_name: DISPLAY_NAME,
        prompt_template: PROMPT_TEMPLATE,
        whatsapp_message_template: 'Olá, {name}! Obrigado pela sua contribuição. Conte comigo nessa caminhada!',
        thank_you_message: '{name}, recebemos sua contribuição com muito carinho. Vamos te enviar um vídeo de resposta no WhatsApp em breve.',
        video_storage_path: storagePath,
        voice_model_id: voiceModel.id,
        lipsync_config: { model: 'lipsync-2-pro', sync_mode: 'loop', temperature: 0.3 },
        is_active: true,
      })
      .select('*, voice_models(*)')
      .single();
    if (bmErr) throw new Error(`video_base_models insert: ${bmErr.message}`);
    console.log(`   video_base_models: ${baseModel.id}\n`);

    console.log('Done.');
    console.log(`   slug    : ${SLUG}`);
    console.log(`   voice   : ${voiceId}`);
    console.log(`   storage : ${storagePath}`);
    console.log(`   URL     : /selfie-video/${SLUG}\n`);
  } finally {
    try { unlinkSync(trimmedPath); } catch {}
    try { unlinkSync(audioPath); } catch {}
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
