/**
 * Execute SQL migration against Supabase via direct DB connection.
 * Uses the Supabase pooler with service_role JWT authentication.
 *
 * Usage: npx tsx scripts/run-sql.ts scripts/add_columns_v2.sql
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';

const { Client } = pg;

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
}

// ── Config ───────────────────────────────────────────────────────────────────

const PROJECT_REF = 'sobfplitrzgggzqsycew';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: npx tsx scripts/run-sql.ts <sql-file>');
  process.exit(1);
}

const sqlPath = resolve(sqlFile);
if (!existsSync(sqlPath)) {
  console.error(`❌ SQL file not found: ${sqlPath}`);
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf-8');

// ── Try multiple connection methods ──────────────────────────────────────────

async function tryConnect(): Promise<pg.Client> {
  // Method 1: Supabase pooler with JWT auth (session mode)
  const configs = [
    {
      label: 'Supavisor session mode (5432)',
      host: `aws-0-sa-east-1.pooler.supabase.com`,
      port: 5432,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    },
    {
      label: 'Supavisor transaction mode (6543)',
      host: `aws-0-sa-east-1.pooler.supabase.com`,
      port: 6543,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    },
    {
      label: 'Direct connection',
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
    },
  ];

  for (const config of configs) {
    console.log(`🔌 Trying ${config.label}...`);
    const client = new Client(config);
    try {
      await client.connect();
      console.log(`   ✅ Connected via ${config.label}`);
      return client;
    } catch (err: any) {
      console.log(`   ❌ Failed: ${err.message}`);
      try { await client.end(); } catch {}
    }
  }

  throw new Error('Could not connect to database via any method');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📄 SQL file: ${sqlPath}`);
  console.log(`   ${sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--')).length} SQL statements\n`);

  const client = await tryConnect();

  try {
    console.log('\n🚀 Executing SQL...');
    await client.query(sql);
    console.log('✅ SQL executed successfully!');
  } catch (err: any) {
    console.error('❌ SQL execution failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
