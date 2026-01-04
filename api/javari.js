// api/javari.js - Javari AI Autonomous Control API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getSystemHealth() {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    components: {},
    issues: [],
    actions: []
  };

  try {
    // Database check
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    health.components.database = {
      status: error ? 'error' : 'healthy',
      productCount: count || 0
    };

    if (count < 100000) {
      health.status = 'needs_attention';
      health.issues.push({
        type: 'low_product_count',
        message: `Only ${count} products in database`,
        expected: 400000
      });
      health.actions.push({
        action: 'trigger_import',
        priority: 'high',
        command: 'POST /api/import'
      });
    }

    // Check data freshness
    const { data: recent } = await supabase
      .from('products')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (recent?.[0]) {
      const lastImport = new Date(recent[0].created_at);
      const hoursSince = (Date.now() - lastImport.getTime()) / (1000 * 60 * 60);
      health.components.freshness = {
        lastImport: lastImport.toISOString(),
        hoursSinceImport: Math.round(hoursSince)
      };

      if (hoursSince > 168) { // 7 days
        health.issues.push({
          type: 'stale_data',
          message: `Last import was ${Math.round(hoursSince / 24)} days ago`
        });
      }
    }

    // Category distribution
    const { data: products } = await supabase
      .from('products')
      .select('category')
      .limit(50000);

    const distribution = {};
    products?.forEach(p => {
      distribution[p.category] = (distribution[p.category] || 0) + 1;
    });
    health.components.categories = distribution;

  } catch (e) {
    health.status = 'error';
    health.error = e.message;
  }

  return health;
}

async function getStats() {
  const { data: products } = await supabase
    .from('products')
    .select('category, source, brand, country')
    .limit(100000);

  const stats = {
    total: products?.length || 0,
    byCategory: {},
    bySource: {},
    topBrands: [],
    topCountries: []
  };

  if (products) {
    const brandCount = {}, countryCount = {};
    
    products.forEach(p => {
      stats.byCategory[p.category] = (stats.byCategory[p.category] || 0) + 1;
      stats.bySource[p.source] = (stats.bySource[p.source] || 0) + 1;
      if (p.brand) brandCount[p.brand] = (brandCount[p.brand] || 0) + 1;
      if (p.country) countryCount[p.country] = (countryCount[p.country] || 0) + 1;
    });

    stats.topBrands = Object.entries(brandCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    stats.topCountries = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }

  return stats;
}

async function triggerGitHubWorkflow(type = 'full') {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { success: false, error: 'No GITHUB_TOKEN' };

  const response = await fetch(
    'https://api.github.com/repos/roy-henderson/javari-spirits-data/actions/workflows/import.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ ref: 'main', inputs: { import_type: type } })
    }
  );

  return response.ok || response.status === 204
    ? { success: true, message: `${type} import triggered` }
    : { success: false, error: `GitHub API: ${response.status}` };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  switch (action) {
    case 'health':
      return res.json(await getSystemHealth());
      
    case 'stats':
      return res.json(await getStats());
      
    case 'trigger':
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST required' });
      }
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== process.env.IMPORT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const type = req.body?.type || 'full';
      return res.json(await triggerGitHubWorkflow(type));
      
    default:
      return res.json({
        name: 'Javari AI Spirits Connector',
        version: '1.0.0',
        endpoints: {
          health: '/api/javari?action=health',
          stats: '/api/javari?action=stats',
          trigger: 'POST /api/javari?action=trigger'
        }
      });
  }
}
