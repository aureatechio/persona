/**
 * Clona uma voz Maria do Carmo de ALTA QUALIDADE no ElevenLabs (IVC) usando
 * os 27 clipes de mensagens (~13 min) da pasta WeTransfer.
 *
 * Estratégia:
 *  1. Extrai áudio limpo de cada mp4 (mono 44.1kHz, mp3 128k — sem processamento
 *     agressivo; IVC prefere áudio cru limpo + remove_background_noise).
 *  2. Seleciona até 25 amostras (limite de samples por voz no IVC).
 *  3. Cria UMA nova voz "Maria do Carmo" enviando todas as amostras de uma vez.
 *  4. Reaponta o voice_models existente (49857140… já referenciado pelo base
 *     model `mariadocarmo`) para o novo voice_id — assim o pipeline/worker passa
 *     a usar a voz nova sem mexer no video_base_models.
 *  5. Deleta a voz antiga (PGDtCFioIE97RFXC74Vf) para liberar o slot.
 *
 * Conta ElevenLabs: a CHAVE LOCAL (.env.local) — é onde a voz atual da MC vive
 * e a que tanto o worker (produção) quanto a página de teste enxergam.
 *
 * Uso: npx tsx scripts/clone-mariadocarmo-hq.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, mkdirSync, rmSync, statSync } from 'fs';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const execFile = promisify(execFileCb);

// ─── env ───
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

// ─── constantes ───
const SOURCE_DIR = '/Users/arthurcavallini/Downloads/wetransfer_00_mc-mensagens-01-mp4_2026-05-29_1800';
const VOICE_MODEL_ID = '49857140-9988-4200-8104-478162d5a3a3'; // referenciado pelo base model mariadocarmo
const OLD_VOICE_ID = 'PGDtCFioIE97RFXC74Vf';
const MAX_SAMPLES = 25; // limite de samples por voz no IVC do ElevenLabs

async function main() {
  const work = join(tmpdir(), `mc_hq_${Date.now()}`);
  mkdirSync(work, { recursive: true });

  try {
    // 1. Listar vídeos
    const videos = readdirSync(SOURCE_DIR)
      .filter((f) => f.toLowerCase().endsWith('.mp4'))
      .sort();
    if (videos.length === 0) throw new Error(`Nenhum .mp4 em ${SOURCE_DIR}`);
    console.log(`Encontrados ${videos.length} vídeos.\n`);

    // 2. Extrair áudio de cada um
    console.log('1/5 — Extraindo áudio (mono 44.1kHz mp3 128k)...');
    const audioPaths: string[] = [];
    for (let i = 0; i < videos.length; i++) {
      const inPath = join(SOURCE_DIR, videos[i]);
      const outPath = join(work, `sample_${String(i + 1).padStart(2, '0')}.mp3`);
      await execFile('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        '-i', inPath,
        '-vn', '-ac', '1', '-ar', '44100',
        '-acodec', 'libmp3lame', '-b:a', '128k',
        '-y', outPath,
      ], { timeout: 120000 });
      audioPaths.push(outPath);
      process.stdout.write(`   [${i + 1}/${videos.length}] ${videos[i]}\r`);
    }
    console.log(`\n   ${audioPaths.length} áudios extraídos.\n`);

    // 3. Selecionar até MAX_SAMPLES (todas têm qualidade equivalente; pega as
    //    primeiras MAX_SAMPLES por nome de arquivo)
    const selected = audioPaths.slice(0, MAX_SAMPLES);
    const totalMB = selected.reduce((s, p) => s + statSync(p).size, 0) / 1024 / 1024;
    console.log(`2/5 — Selecionadas ${selected.length} amostras (${totalMB.toFixed(2)}MB total).\n`);

    // 4. Criar a voz no ElevenLabs (IVC) com todas as amostras
    console.log('3/5 — Criando voz "Maria do Carmo" no ElevenLabs (IVC)...');
    const form = new FormData();
    form.append('name', 'Maria do Carmo');
    form.append(
      'description',
      'Voz clonada da Maria do Carmo a partir de 25 clipes de mensagens em estúdio (~12 min). PT-BR.',
    );
    for (let i = 0; i < selected.length; i++) {
      const bytes = readFileSync(selected[i]);
      form.append(
        'files',
        new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }),
        `sample_${String(i + 1).padStart(2, '0')}.mp3`,
      );
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
    console.log(`   ✓ Nova voz criada: ${newVoiceId}\n`);

    // 5. Reapontar voice_models → nova voz
    console.log('4/5 — Atualizando voice_models para a nova voz...');
    const { error: vmErr } = await supabase
      .from('voice_models')
      .update({
        elevenlabs_voice_id: newVoiceId,
        name: 'Base: Maria do Carmo (HQ 25 clipes)',
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', VOICE_MODEL_ID);
    if (vmErr) throw new Error(`update voice_models: ${vmErr.message}`);
    console.log(`   ✓ ${OLD_VOICE_ID} → ${newVoiceId}\n`);

    // 6. Deletar a voz antiga (libera slot)
    console.log('5/5 — Deletando voz antiga (libera slot)...');
    const delRes = await fetch(`https://api.elevenlabs.io/v1/voices/${OLD_VOICE_ID}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': ELEVENLABS_KEY },
    });
    if (delRes.ok) console.log(`   ✓ Voz antiga ${OLD_VOICE_ID} deletada.\n`);
    else console.log(`   (non-fatal) delete falhou: HTTP ${delRes.status}\n`);

    console.log('PRONTO. Base model "mariadocarmo" já usa a nova voz.');
    console.log(`Novo voice_id: ${newVoiceId}`);
  } finally {
    try { rmSync(work, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
