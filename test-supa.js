const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vuuirgfqluyhuootrwkf.supabase.co';
const defaultKey = typeof atob === 'function'
  ? atob('c2Jfc2VjcmV0X3hJZWxHdkdMWUxTYWRmTjhCcjRYOFFfQXJoU1M0a2w=')
  : Buffer.from('c2Jfc2VjcmV0X3hJZWxHdkdMWUxTYWRmTjhCcjRYOFFfQXJoU1M0a2w=', 'base64').toString('utf-8');

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  defaultKey ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWlyZ2ZxbHV5aHVvb3Ryd2tmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA2MzA1MCwiZXhwIjoyMTA0NjM5MDUwfQ.F4Omjm0IaLvl3hdwu8WDZ0yEqZaIOcnF9DFoXWWQwX0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  // Test Read
  let { data, error } = await supabase.from('app_state').select('*');
  console.log('READ:', data, error);
  
  // Test Update
  // Test Insert
  let { error: iErr } = await supabase.from('app_state').insert({ id: 'tronos', menu_data: [], config_data: {} });
  console.log('INSERT:', iErr);
  
  let { data: d2 } = await supabase.from('app_state').select('*');
  console.log('READ 2:', d2);
}

test();
