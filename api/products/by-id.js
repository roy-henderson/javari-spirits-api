// api/products/[id].js - Get Product by ID
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Get similar products
  const { data: similar } = await supabase
    .from('products')
    .select('id, name, category, subcategory, price, brand')
    .eq('category', data.category)
    .neq('id', id)
    .limit(5);

  return res.status(200).json({
    product: data,
    similar: similar || []
  });
}
