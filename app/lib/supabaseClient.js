import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vuuirgfqluyhuootrwkf.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWlyZ2ZxbHV5aHVvb3Ryd2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjMwNTAsImV4cCI6MjEwNDYzOTA1MH0.2BY9ESIVLLE9x5yzevAEgRnnfEnUMYU9DgPzAY1Pbek';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
