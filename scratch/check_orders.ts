import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ptjrtcyahjhcyklxgzqb.supabase.co';
const supabaseAnonKey = 'sb_publishable_tzk16xpXBpELkgFiR84ZpA_APSAZa1J';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, driver_id, customer_name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log('--- RECENT ORDERS ---');
  data.forEach(o => {
    console.log(`ID: ${o.id.slice(0,8)} | Status: ${o.status} | Driver: ${o.driver_id} | Name: ${o.customer_name} | Created: ${o.created_at}`);
  });
}

checkOrders();
