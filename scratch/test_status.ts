import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ptjrtcyahjhcyklxgzqb.supabase.co';
const supabaseAnonKey = 'sb_publishable_tzk16xpXBpELkgFiR84ZpA_APSAZa1J';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdate() {
  const { data: orders } = await supabase.from('orders').select('id').limit(1);
  if (!orders || orders.length === 0) return;
  
  const id = orders[0].id;
  console.log('Testing update for order:', id);
  
  const { error } = await supabase
    .from('orders')
    .update({ status: 'dispatched' })
    .eq('id', id);

  if (error) {
    console.error('DATABASE REJECTED "dispatched":', error.message);
  } else {
    console.log('DATABASE ACCEPTED "dispatched"');
    // Revert back
    await supabase.from('orders').update({ status: 'ready' }).eq('id', id);
  }
}

testUpdate();
