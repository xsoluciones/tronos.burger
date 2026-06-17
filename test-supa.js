const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
