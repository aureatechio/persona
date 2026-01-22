import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTY4NTgsImV4cCI6MjA4Mzg5Mjg1OH0.0UOS6R0j7QwO6N7QIgrksA9iXr_82kL2a1QGjdTlsGA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
