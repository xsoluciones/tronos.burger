import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vuuirgfqluyhuootrwkf.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWlyZ2ZxbHV5aHVvb3Ryd2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjMwNTAsImV4cCI6MjEwNDYzOTA1MH0.2BY9ESIVLLE9x5yzevAEgRnnfEnUMYU9DgPzAY1Pbek';

// Claves maestras con máxima prioridad:
// Prioridad 1: Nuevo secreto maestro sb_secret_...
// Prioridad 2: Clave maestra JWT service_role
const defaultSecret = typeof atob === 'function'
  ? atob('c2Jfc2VjcmV0X3hJZWxHdkdMWUxTYWRmTjhCcjRYOFFfQXJoU1M0a2w=')
  : Buffer.from('c2Jfc2VjcmV0X3hJZWxHdkdMWUxTYWRmTjhCcjRYOFFfQXJoU1M0a2w=', 'base64').toString('utf-8');

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  defaultSecret;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWlyZ2ZxbHV5aHVvb3Ryd2tmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA2MzA1MCwiZXhwIjoyMTA0NjM5MDUwfQ.F4Omjm0IaLvl3hdwu8WDZ0yEqZaIOcnF9DFoXWWQwX0';

const primaryAdminKey = supabaseSecretKey || supabaseServiceRoleKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrador para el servidor con privilegios completos (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, primaryAdminKey);

