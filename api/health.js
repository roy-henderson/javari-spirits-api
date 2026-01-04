// api/health.js - Health Check and Stats API
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

  const stats = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: { connected: false },
    products: { total: 0, byCategory: {}, bySource: {} }
  };

  try {
    // Total count
    const { count: total, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    stats.database.connected = true;
    stats.products.total = total;

    // By category
    const { data: categories } = await supabase
      .from('products')
      .select('category')
      .limit(50000);

    const categoryCount = {};
    categories?.forEach(p => {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    });
    stats.products.byCategory = categoryCount;

    // By source (sample)
    const { data: sources } = await supabase
      .from('products')
      .select('source')
      .limit(50000);

    const sourceCount = {};
    sources?.forEach(p => {
      sourceCount[p.source] = (sourceCount[p.source] || 0) + 1;
    });
    stats.products.bySource = sourceCount;

    // Health checks
    stats.issues = [];
    
    if (total < 1000) {
      stats.issues.push({
        type: 'low_product_count',
        message: `Only ${total} products in database`,
        action: 'trigger_import'
      });
      stats.status = 'needs_attention';
    }

  } catch (error) {
    stats.status = 'error';
    stats.error = error.message;
  }

  return res.status(200).json(stats);
}
