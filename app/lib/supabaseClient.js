import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vuuirgfqluyhuootrwkf.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWlyZ2ZxbHV5aHVvb3Ryd2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjMwNTAsImV4cCI6MjEwNDYzOTA1MH0.2BY9ESIVLLE9x5yzevAEgRnnfEnUMYU9DgPzAY1Pbek';

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWlyZ2ZxbHV5aHVvb3Ryd2tmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA2MzA1MCwiZXhwIjoyMTA0NjM5MDUwfQ.F4Omjm0IaLvl3hdwu8WDZ0yEqZaIOcnF9DFoXWWQwX0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrador para el servidor (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
