import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5FQ82umahu8tCYtF_eQ57Q_Zn5AiVgc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
