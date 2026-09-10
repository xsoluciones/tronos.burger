import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vuuirgfqluyhuootrwkf.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_TqRvND_ulEcfqOERBdj_Dg_RMmcwvV9';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
