import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envContent = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  let val = t.slice(eq + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  env[t.slice(0, eq).trim()] = val;
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('personas').select('id', { count: 'exact', head: true }).then(r => {
  console.log('Count:', r.count, '| Error:', r.error?.message || 'none');
  process.exit(0);
});
