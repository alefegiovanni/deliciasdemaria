import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ptjrtcyahjhcyklxgzqb.supabase.co',
  'sb_publishable_tzk16xpXBpELkgFiR84ZpA_APSAZa1J'
);

async function checkSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'delicias_maria')
    .single();

  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }

  console.log('Settings:', JSON.stringify(data, null, 2));
}

checkSettings();
