// api/search.js - Product Search API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, category, subcategory, priceMin, priceMax, country, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });

  // Text search
  if (q) {
    query = query.textSearch('name', q, { type: 'websearch' });
  }

  // Filters
  if (category) query = query.eq('category', category);
  if (subcategory) query = query.ilike('subcategory', `%${subcategory}%`);
  if (priceMin) query = query.gte('price', parseFloat(priceMin));
  if (priceMax) query = query.lte('price', parseFloat(priceMax));
  if (country) query = query.ilike('country', `%${country}%`);

  // Pagination
  query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    products: data,
    total: count,
    limit: parseInt(limit),
    offset: parseInt(offset),
    hasMore: count > parseInt(offset) + parseInt(limit)
  });
}
