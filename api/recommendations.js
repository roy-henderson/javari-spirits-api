// api/recommendations.js - Product Recommendations API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { category, style, priceMax, country, limit = 10 } = req.query;

  let query = supabase
    .from('products')
    .select('*')
    .not('price', 'is', null)
    .limit(parseInt(limit));

  if (category) query = query.eq('category', category);
  if (style) query = query.ilike('style', `%${style}%`);
  if (priceMax) query = query.lte('price', parseFloat(priceMax));
  if (country) query = query.ilike('country', `%${country}%`);

  // Order by rating if available in metadata
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    recommendations: data,
    criteria: { category, style, priceMax, country }
  });
}
