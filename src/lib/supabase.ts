import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTY4NTgsImV4cCI6MjA4Mzg5Mjg1OH0.0UOS6R0j7QwO6N7QIgrksA9iXr_82kL2a1QGjdTlsGA';

// Use defaults from @supabase/ssr — do NOT override cookieOptions
// to avoid mismatches between browser client and server proxy.
// The proxy (server-side) and the browser client must use the same
// cookie settings for session persistence to work across reloads.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
