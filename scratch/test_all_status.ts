import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ptjrtcyahjhcyklxgzqb.supabase.co';
const supabaseAnonKey = 'sb_publishable_tzk16xpXBpELkgFiR84ZpA_APSAZa1J';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdate() {
  const { data: orders } = await supabase.from('orders').select('id').limit(1);
  if (!orders || orders.length === 0) return;
  
  const id = orders[0].id;
  
  const statuses = ['dispatched', 'out_for_delivery', 'shipped', 'ready'];
  
  for (const s of statuses) {
    const { error } = await supabase.from('orders').update({ status: s }).eq('id', id);
    if (error) {
      console.log(`STATUS "${s}": REJECTED (${error.message})`);
    } else {
      console.log(`STATUS "${s}": ACCEPTED`);
    }
  }
}

testUpdate();
