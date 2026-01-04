// api/categories.js - Get All Categories and Subcategories
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

  // Get distinct categories with counts
  const { data: products, error } = await supabase
    .from('products')
    .select('category, subcategory')
    .limit(100000);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const categories = {};
  
  for (const p of products) {
    if (!categories[p.category]) {
      categories[p.category] = { count: 0, subcategories: {} };
    }
    categories[p.category].count++;
    
    if (p.subcategory) {
      if (!categories[p.category].subcategories[p.subcategory]) {
        categories[p.category].subcategories[p.subcategory] = 0;
      }
      categories[p.category].subcategories[p.subcategory]++;
    }
  }

  // Convert to array format
  const result = Object.entries(categories).map(([name, data]) => ({
    name,
    count: data.count,
    subcategories: Object.entries(data.subcategories)
      .map(([subName, count]) => ({ name: subName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  })).sort((a, b) => b.count - a.count);

  return res.status(200).json({ categories: result });
}
