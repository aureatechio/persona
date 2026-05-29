/**
 * Reclona a voz Maria do Carmo usando o áudio dos 27 vídeos COMPLETOS.
 *
 * O clone anterior usou 25 das 27 amostras (limite de samples por voz no IVC).
 * Aqui concatenamos os 27 clipes em 9 arquivos (3 clipes cada) — assim todo o
 * áudio gravado entra na clonagem, sem ultrapassar o limite de samples.
 *
 * Passos:
 *  1. Extrai áudio de cada mp4 (mono 44.1kHz mp3 128k).
 *  2. Concatena em grupos de 3 -> 9 arquivos combinados.
 *  3. Cria a nova voz "Maria do Carmo" no ElevenLabs (IVC, conta da chave local).
 *  4. Reaponta o voice_models 49857140 (usado pelo base model mariadocarmo).
 *  5. Deleta a voz HQ anterior (rGgeGCglFc8g3PlpX7I5) para liberar o slot.
 *
 * Uso: npx tsx scripts/clone-mariadocarmo-all27.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync, statSync } from 'fs';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const execFile = promisify(execFileCb);

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

const SOURCE_DIR = '/Users/arthurcavallini/Downloads/wetransfer_00_mc-mensagens-01-mp4_2026-05-29_1800';
const VOICE_MODEL_ID = '49857140-9988-4200-8104-478162d5a3a3';
const OLD_VOICE_ID = 'rGgeGCglFc8g3PlpX7I5'; // voz HQ anterior (25 clipes)
const GROUP_SIZE = 3;

async function main() {
  const work = join(tmpdir(), `mc_all27_${Date.now()}`);
  mkdirSync(work, { recursive: true });

  try {
    const videos = readdirSync(SOURCE_DIR)
      .filter((f) => f.toLowerCase().endsWith('.mp4'))
      .sort();
    if (videos.length === 0) throw new Error(`Nenhum .mp4 em ${SOURCE_DIR}`);
    console.log(`Encontrados ${videos.length} vídeos.\n`);

    // 1. Extrair áudio de cada vídeo
    console.log('1/5 — Extraindo áudio dos 27 vídeos...');
    const clips: string[] = [];
    for (let i = 0; i < videos.length; i++) {
      const outPath = join(work, `clip_${String(i + 1).padStart(2, '0')}.mp3`);
      await execFile('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        '-i', join(SOURCE_DIR, videos[i]),
        '-vn', '-ac', '1', '-ar', '44100',
        '-acodec', 'libmp3lame', '-b:a', '128k',
        '-y', outPath,
      ], { timeout: 120000 });
      clips.push(outPath);
    }
    console.log(`   ${clips.length} clipes extraídos.\n`);

    // 2. Concatenar em grupos de GROUP_SIZE
    console.log(`2/5 — Concatenando em grupos de ${GROUP_SIZE}...`);
    const combined: string[] = [];
    for (let g = 0; g < clips.length; g += GROUP_SIZE) {
      const group = clips.slice(g, g + GROUP_SIZE);
      const listPath = join(work, `list_${g}.txt`);
      writeFileSync(listPath, group.map((p) => `file '${p}'`).join('\n'));
      const outPath = join(work, `sample_${String(combined.length + 1).padStart(2, '0')}.mp3`);
      await execFile('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', listPath,
        '-ac', '1', '-ar', '44100', '-acodec', 'libmp3lame', '-b:a', '128k',
        '-y', outPath,
      ], { timeout: 120000 });
      combined.push(outPath);
    }
    const totalMB = combined.reduce((s, p) => s + statSync(p).size, 0) / 1024 / 1024;
    console.log(`   ${combined.length} arquivos combinados (${totalMB.toFixed(2)}MB, todos os 27 vídeos incluídos).\n`);

    // 3. Criar a voz
    console.log('3/5 — Criando voz "Maria do Carmo" (IVC) com os 27 vídeos...');
    const form = new FormData();
    form.append('name', 'Maria do Carmo');
    form.append('description', 'Voz clonada da Maria do Carmo — 27 clipes de mensagens em estúdio (~13 min), 100% do material. PT-BR.');
    for (let i = 0; i < combined.length; i++) {
      const bytes = readFileSync(combined[i]);
      form.append('files', new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }), `sample_${String(i + 1).padStart(2, '0')}.mp3`);
    }
    form.append('remove_background_noise', 'true');
    form.append('labels', JSON.stringify({ language: 'pt-BR', accent: 'brazilian' }));

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_KEY },
      body: form,
    });
    if (!elRes.ok) {
      const t = await elRes.text();
      throw new Error(`ElevenLabs ${elRes.status}: ${t.slice(0, 500)}`);
    }
    const { voice_id: newVoiceId } = (await elRes.json()) as { voice_id: string };
    console.log(`   ✓ Nova voz: ${newVoiceId}\n`);

    // 4. Reapontar voice_models
    console.log('4/5 — Atualizando voice_models...');
    const { error: vmErr } = await supabase
      .from('voice_models')
      .update({
        elevenlabs_voice_id: newVoiceId,
        name: 'Base: Maria do Carmo (HQ 27 clipes)',
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', VOICE_MODEL_ID);
    if (vmErr) throw new Error(`update voice_models: ${vmErr.message}`);
    console.log(`   ✓ ${OLD_VOICE_ID} → ${newVoiceId}\n`);

    // 5. Deletar a voz anterior
    console.log('5/5 — Deletando voz HQ anterior (25 clipes)...');
    const delRes = await fetch(`https://api.elevenlabs.io/v1/voices/${OLD_VOICE_ID}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': ELEVENLABS_KEY },
    });
    console.log(delRes.ok ? `   ✓ ${OLD_VOICE_ID} deletada.\n` : `   (non-fatal) delete falhou: HTTP ${delRes.status}\n`);

    console.log('PRONTO. Voz da Maria do Carmo agora usa os 27 vídeos completos.');
    console.log(`Novo voice_id: ${newVoiceId}`);
  } finally {
    try { rmSync(work, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
