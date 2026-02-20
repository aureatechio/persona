/**
 * Import 20K personas from CSV into Supabase
 *
 * Prerequisites:
 *   1. Run add_columns.sql first (original migration)
 *   2. Run add_columns_v2.sql (q_ti_* and q_vi_* columns)
 *
 * Usage:
 *   npx tsx scripts/import-csv.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Load .env.local ──────────────────────────────────────────────────────────

const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('📄 Loaded .env.local');
}

// ── Supabase Config ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local or environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── CSV Path ─────────────────────────────────────────────────────────────────

const CSV_PATH = process.argv[2] || '/Users/arthurcavallini/Downloads/personas_20mil_eleitorado_brasileiro (9) (1).csv';

// ── Cluster → nome_grupo mapping ─────────────────────────────────────────────

const CLUSTER_NAMES: Record<string, string> = {
  P1: 'Base Social', P2: 'Trabalhista', P3: 'Progressista Urbano',
  P4: 'Regulador Técnico', P5: 'Desenvolvimentista', P6: 'Centro-Esquerda Moderada',
  M1: 'Centro Econômico', M2: 'Centro Conservador', M3: 'Institucional',
  M4: 'Gestor Pragmático', M5: 'Volátil Econômico', M6: 'Empreendedor Urbano',
  M7: 'Classe Média Sensível', M8: 'Cético Político',
  C1: 'Liberal de Mercado', C2: 'Conservador Religioso', C3: 'Nacionalista',
  C4: 'Linha Dura Segurança', C5: 'Antissistema', C6: 'Pequeno Empresário',
  C7: 'Direita Digital', C8: 'Conservador Tradicional',
  T1: 'Desengajado', T2: 'Anti-Incumbente',
};

// ── Derive generation from age ───────────────────────────────────────────────

function deriveGeneration(age: number): string {
  if (age <= 27) return 'Gen Z';
  if (age <= 43) return 'Millennial';
  if (age <= 59) return 'Gen X';
  return 'Boomer';
}

// ── Derive political leaning from cluster + scores ───────────────────────────

function derivePoliticalLeaning(clusterId: string, scoreEco: number, scoreCost: number): string {
  const macro = clusterId.charAt(0);
  const avgScore = (scoreEco + scoreCost) / 2;

  if (macro === 'P') {
    if (avgScore < -0.5) return 'Extrema Esquerda';
    if (avgScore < -0.2) return 'Esquerda';
    return 'Centro-Esquerda';
  }
  if (macro === 'M') {
    if (avgScore < -0.15) return 'Centro-Esquerda';
    if (avgScore > 0.15) return 'Centro-Direita';
    return 'Centro';
  }
  if (macro === 'C') {
    if (avgScore > 0.5) return 'Extrema Direita';
    if (avgScore > 0.2) return 'Direita';
    return 'Centro-Direita';
  }
  // Transversal
  if (avgScore < -0.2) return 'Centro-Esquerda';
  if (avgScore > 0.2) return 'Centro-Direita';
  return 'Centro';
}

// ── Parse CSV ────────────────────────────────────────────────────────────────

function parseCSV(filePath: string): Record<string, string>[] {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(',');

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || '').trim();
    }
    rows.push(row);
  }
  return rows;
}

// ── Numeric smallint fields (trust scores are 1-10, democracia is 1-10) ─────

const SMALLINT_FIELDS = new Set([
  'q_confianca_stf', 'q_confianca_congresso', 'q_confianca_imprensa',
  'q_confianca_policia', 'q_confianca_exercito', 'q_confianca_igreja',
  'q_democracia_importante',
]);

// ── CSV column → DB column mapping ───────────────────────────────────────────

function mapRow(csvRow: Record<string, string>): Record<string, any> {
  const age = parseInt(csvRow.idade, 10) || 18;
  const scoreEco = parseFloat(csvRow.score_economico) || 0;
  const scoreCost = parseFloat(csvRow.score_costumes) || 0;
  const clusterId = csvRow.cluster || '';
  const apelido = csvRow.apelido_politico === '-' ? null : csvRow.apelido_politico || null;

  const row: Record<string, any> = {
    // Core identity
    name: csvRow.nome_completo,
    apelido_politico: apelido,
    age,
    gender: csvRow.sexo,
    gender_identity: csvRow.sexo,
    civil_status: csvRow.estado_civil,
    raca_cor: csvRow.raca_cor,
    education_level: csvRow.escolaridade,
    social_class: csvRow.classe_economica,
    region_br: csvRow.regiao,
    state: csvRow.uf,
    city: csvRow.municipio,
    area_type: csvRow.zona,
    macro_religion: csvRow.religiao,
    religiao_subtipo: csvRow.religiao_subtipo === '-' ? null : csvRow.religiao_subtipo || null,

    // Cluster & scores
    cluster_id: clusterId,
    nome_grupo: CLUSTER_NAMES[clusterId] || null,
    score_costumes: scoreCost,
    score_economico: scoreEco,

    // Derived fields
    generation: deriveGeneration(age),
    political_leaning: derivePoliticalLeaning(clusterId, scoreEco, scoreCost),

    // Electoral
    voto_2022: csvRow.voto_2022 || null,
    aprovacao_lula: csvRow.aprovacao_lula || null,
    voto_2026: csvRow.voto_2026 || null,

    // Theme positions
    tema_aborto: csvRow.tema_aborto || null,
    tema_armas: csvRow.tema_armas || null,
    tema_maconha: csvRow.tema_maconha || null,
    tema_privatizacoes: csvRow.tema_privatizacoes || null,
    tema_cotas_raciais: csvRow.tema_cotas_raciais || null,
    tema_casamento_gay: csvRow.tema_casamento_gay || null,

    // Lifestyle
    time_futebol: csvRow.time_futebol || null,
    recebe_beneficio: csvRow.recebe_beneficio || null,
    usa_transporte_publico: csvRow.usa_transporte_publico || null,
  };

  // All q_* columns (direct mapping — same name in CSV and DB)
  const qColumns = Object.keys(csvRow).filter(k => k.startsWith('q_'));
  for (const col of qColumns) {
    const val = csvRow[col];
    if (!val || val === '-') {
      row[col] = null;
    } else if (SMALLINT_FIELDS.has(col)) {
      row[col] = parseInt(val, 10) || null;
    } else {
      row[col] = val;
    }
  }

  // Clear JSON fields (new personas don't have them)
  row.psychology_json = null;
  row.career_json = null;
  row.beliefs_json = null;
  row.demographic_json = null;
  row.lifestyle_json = null;
  row.health_json = null;
  row.history_json = null;

  return row;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Reading CSV...');
  const csvRows = parseCSV(CSV_PATH);
  console.log(`   ${csvRows.length} rows found`);

  // Check if personas table is empty (should be truncated beforehand)
  const { count } = await supabase.from('personas').select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    console.log(`⚠️  Table still has ${count} personas. Attempting delete...`);
    const { error: delError } = await supabase
      .from('personas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError) {
      console.error('❌ Delete failed:', delError.message);
      console.error('   Run: TRUNCATE public.messages, public.chats, public.personas CASCADE;');
      process.exit(1);
    }
  }
  console.log('   ✅ Table is clean, ready for import');

  console.log('📊 Mapping CSV rows to DB schema...');
  const dbRows = csvRows.map(mapRow);

  // Insert in batches of 500
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
    const batch = dbRows.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from('personas')
      .insert(batch);

    if (insertError) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, insertError.message);
      errors++;
      // Try individual inserts for failed batch
      for (const row of batch) {
        const { error: singleError } = await supabase.from('personas').insert(row);
        if (singleError) {
          console.error(`   ❌ Row "${row.name}" failed:`, singleError.message);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    const pct = ((i + batch.length) / dbRows.length * 100).toFixed(1);
    process.stdout.write(`\r   Inserting... ${inserted}/${dbRows.length} (${pct}%)    `);
  }

  console.log(`\n\n✅ Import complete: ${inserted} personas inserted, ${errors} batch errors`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
