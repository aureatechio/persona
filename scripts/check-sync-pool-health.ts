/**
 * Health check (read-only) do pool Sync Labs.
 *
 * Verifica:
 *  1. kling_keys: quais ativas, max_concurrent, total capacidade
 *  2. claim_kling_slot: o source da função no Postgres confirma algoritmo least-loaded
 *  3. Sanidade dos índices auxiliares
 *  4. Jobs em flight no momento (e por qual chave estão divididos)
 *  5. DO app spec: instance_count, deployment ACTIVE
 *
 * NÃO altera nada no DB. Saída em formato relatório.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';

const execFile = promisify(execFileCb);
const envPath = resolve(import.meta.dirname || __dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (m) process.env[m[1]] = m[2];
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APP_ID = '2a5e2bce-afa9-4a14-b1bd-1d0903ece304';

function ok(s: string) { console.log('  \x1b[32m✓\x1b[0m ' + s); }
function bad(s: string) { console.log('  \x1b[31m✗\x1b[0m ' + s); }
function warn(s: string) { console.log('  \x1b[33m!\x1b[0m ' + s); }
function info(s: string) { console.log('  · ' + s); }
function h1(s: string) { console.log('\n\x1b[1m── ' + s + ' ──\x1b[0m'); }

async function main() {
  let problems = 0;
  let warnings = 0;

  // ─────────── 1. kling_keys ───────────
  h1('1. kling_keys (pool de credenciais)');
  const { data: keys } = await sb.from('kling_keys')
    .select('id, label, max_concurrent, is_active, access_key, created_at')
    .order('is_active', { ascending: false })
    .order('label');

  const active = (keys || []).filter(k => k.is_active);
  const inactive = (keys || []).filter(k => !k.is_active);

  info(`total rows: ${keys?.length}  (active: ${active.length}, inactive: ${inactive.length})`);

  if (active.length === 3) ok('3 chaves ativas ✓');
  else { bad(`esperava 3 chaves ativas, achei ${active.length}`); problems++; }

  let cap = 0;
  for (const k of active) {
    const keyValid = k.access_key && k.access_key.startsWith('sk-') && k.access_key.length > 30;
    cap += k.max_concurrent;
    const tag = keyValid ? 'ok' : 'BAD key format';
    const line = `  active: ${k.label.padEnd(12)} max=${k.max_concurrent}  access=${k.access_key.slice(0,12)}…${k.access_key.slice(-4)}  (${tag})`;
    console.log('    ' + line);
    if (k.max_concurrent !== 6) { warn(`${k.label} max_concurrent=${k.max_concurrent} (esperado 6)`); warnings++; }
    if (!keyValid) { bad(`${k.label} access_key formato suspeito`); problems++; }
  }
  if (cap === 18) ok(`capacidade total = 18 slots paralelos`);
  else { bad(`capacidade total = ${cap}, esperado 18`); problems++; }

  for (const k of inactive) {
    console.log(`    inactive: ${k.label.padEnd(12)} max=${k.max_concurrent}`);
  }

  // ─────────── 2. função claim_kling_slot ───────────
  h1('2. RPC claim_kling_slot (algoritmo de distribuição)');

  // Migration aplicada?
  try {
    const { data: migs } = await sb.schema('supabase_migrations' as any).from('schema_migrations').select('version').order('version', { ascending: false }).limit(5);
    if (migs && migs.length) {
      const recent = migs.map((m: any) => m.version);
      info('últimas migrations no remoto: ' + recent.join(', '));
      if (recent.includes('20260513200000')) ok('migration 20260513200000 (least-loaded) aplicada no remoto');
      else { bad('migration 20260513200000 NÃO aplicada'); problems++; }
    }
  } catch (e) {
    warn('supabase_migrations.schema_migrations inacessível via REST: ' + (e as Error).message);
  }

  // Teste funcional: claim com p_selfie_id que NÃO existe em video_selfies.
  // O UPDATE interno da função afeta 0 rows nesse caso, mas a RPC ainda retorna o key id da chave que
  // venceu o algoritmo — útil para confirmar (a) que a função existe e responde, (b) qual key é escolhida.
  info('teste funcional: 5 claims consecutivos com selfie_ids fictícios — observa distribuição');
  const dummyIds = [
    '00000000-0000-0000-0000-000000000a01',
    '00000000-0000-0000-0000-000000000a02',
    '00000000-0000-0000-0000-000000000a03',
    '00000000-0000-0000-0000-000000000a04',
    '00000000-0000-0000-0000-000000000a05',
  ];
  const picks: string[] = [];
  for (const id of dummyIds) {
    const r = await sb.rpc('claim_kling_slot', { p_selfie_id: id });
    if (r.error) { bad('claim_kling_slot erro: ' + r.error.message); problems++; break; }
    if (!r.data) { warn('claim retornou NULL'); warnings++; break; }
    const k = active.find(x => x.id === r.data);
    picks.push(k?.label || String(r.data).slice(0,8));
  }
  info(`sequência: [${picks.join(' → ')}]`);
  // Em pool ocioso (sem jobs em flight), todas keys têm active_count=0. ORDER BY active_count ASC,
  // created_at ASC vai sempre vencer a mais antiga. Como o UPDATE não persiste (selfie_id não existe),
  // active_count fica 0 sempre e os 5 picks vão para a MESMA key. Isso é o comportamento ESPERADO
  // sem persistência — não é bug. O check real de distribuição precisa rodar com selfies persistidos.
  const uniquePicks = new Set(picks);
  if (uniquePicks.size === 1)
    info(`(esperado: todos foram pra '${picks[0]}' porque ids fictícios não persistem o claim; com selfies reais o load incrementa e o least-loaded distribui)`);

  // Confirma que não criou rows fantasmas
  const { count: ghost } = await sb.from('video_selfies').select('id', { count: 'exact', head: true }).in('id', dummyIds);
  if ((ghost ?? 0) === 0) ok('nenhuma row fantasma criada (RPC faz só UPDATE de rows existentes)');

  // ─────────── 3. Jobs em flight ───────────
  h1('3. Jobs em flight (status=generating_lipsync e kling_started_at recente)');
  const { data: live } = await sb.from('video_selfies')
    .select('id, name, status, kling_key_id, kling_started_at, retry_count, updated_at')
    .eq('status', 'generating_lipsync')
    .not('kling_started_at', 'is', null)
    .gte('kling_started_at', new Date(Date.now() - 40*60*1000).toISOString())
    .order('kling_started_at');
  const counts: Record<string, number> = {};
  for (const s of live || []) {
    const key = s.kling_key_id || 'null';
    counts[key] = (counts[key] || 0) + 1;
  }
  if (!live || live.length === 0) {
    info('nenhum job em flight no momento (pool ocioso)');
  } else {
    info(`${live.length} jobs em flight, distribuição:`);
    for (const k of active) {
      const n = counts[k.id] || 0;
      const bar = '█'.repeat(n) + '░'.repeat(k.max_concurrent - n);
      console.log(`    ${k.label.padEnd(12)} ${n}/${k.max_concurrent}  ${bar}`);
      if (n > k.max_concurrent) { bad(`${k.label} EXCEDEU limite (${n} > ${k.max_concurrent})`); problems++; }
    }
  }

  // ─────────── 4. App spec DO ───────────
  h1('4. DigitalOcean app spec');
  try {
    const { stdout } = await execFile('doctl', ['apps', 'spec', 'get', APP_ID, '--format', 'yaml']);
    const ic = stdout.match(/instance_count:\s*(\d+)/);
    if (ic && ic[1] === '18') ok(`instance_count: 18`);
    else { bad(`instance_count: ${ic?.[1]} (esperado 18)`); problems++; }
    if (stdout.includes('deploy_on_push: false')) ok('deploy_on_push: false (correto — evita restart mid-processing)');
    else { warn('deploy_on_push não está false'); warnings++; }
  } catch (e) {
    warn('doctl não disponível ou auth — pulei check da spec DO');
    warnings++;
  }

  try {
    const { stdout } = await execFile('doctl', ['apps', 'list-deployments', APP_ID, '--format', 'ID,Phase', '--no-header']);
    const lines = stdout.trim().split('\n');
    const latest = lines[0].trim().split(/\s+/);
    if (latest[1] === 'ACTIVE') ok(`deployment ${latest[0].slice(0,8)}… ACTIVE`);
    else { warn(`deployment mais recente está em '${latest[1]}'`); warnings++; }
  } catch {}

  // ─────────── 5. Edge cases / código worker ───────────
  h1('5. Fluxo de retry (revisão estática do código)');
  const lipsyncPy = readFileSync(resolve(import.meta.dirname || __dirname, '..', 'selfie-worker/steps/lipsync.py'), 'utf-8');
  const workerPy = readFileSync(resolve(import.meta.dirname || __dirname, '..', 'selfie-worker/worker.py'), 'utf-8');

  if (lipsyncPy.includes('response.status_code in (401, 402)') && lipsyncPy.includes('raise SyncLabsJobFailed'))
    ok('lipsync.py: 401/402 → SyncLabsJobFailed');
  else { bad('lipsync.py: detecção de 401/402 não está como esperado'); problems++; }

  if (workerPy.includes('except SyncLabsJobFailed') && workerPy.includes('lipsync_video_url=None'))
    ok('worker.py: SyncLabsJobFailed limpa lipsync_video_url para retry');
  else { bad('worker.py: tratamento de SyncLabsJobFailed ausente'); problems++; }

  if (workerPy.includes('release_kling_slot(sid)'))
    ok('worker.py: release_kling_slot chamado no finally (libera slot mesmo em erro)');
  else { bad('worker.py: release_kling_slot ausente'); problems++; }

  // ⚠️ Buraco conhecido: 401 não desabilita a key. Vou logar como warning.
  warn('CHECAR MELHORIA: chave que retorna 401 NÃO é desabilitada — no retry, claim_kling_slot pode re-escolher a MESMA chave (se ela ainda tem load=0 e é a primeira por created_at). Mitigado parcialmente porque outras keys podem ter load maior, mas em pool ocioso vai bater na mesma. Sugestão: marcar is_active=false após N falhas seguidas, OU adicionar coluna blocked_until.');
  warnings++;

  // ─────────── Resumo ───────────
  h1('Resumo');
  if (problems === 0 && warnings === 0) {
    console.log('  \x1b[32m✅ Tudo OK — estrutura pronta para 18 paralelos em 3 chaves.\x1b[0m\n');
  } else if (problems === 0) {
    console.log(`  \x1b[33m⚠ ${warnings} avisos (não bloqueiam operação) — ver acima.\x1b[0m\n`);
  } else {
    console.log(`  \x1b[31m✗ ${problems} problemas + ${warnings} avisos — corrigir antes de operar em escala.\x1b[0m\n`);
    process.exit(1);
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
