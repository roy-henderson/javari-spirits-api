// api/affiliate.js - Awin Affiliate Links API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const AWIN_ADVERTISERS = {
  wine: ['wine.com', 'vivino', 'totalwine', 'drizly'],
  beer: ['craftshack', 'totalwine', 'drizly'],
  spirits: ['reservebar', 'caskers', 'flaviar', 'totalwine', 'drizly'],
  cocktails: ['drizly', 'totalwine', 'reservebar']
};

function generateAffiliateLink(product, retailer) {
  const publisherId = process.env.AWIN_PUBLISHER_ID || 'PUBLISHER_ID';
  const searchQuery = encodeURIComponent(product.name);
  return `https://www.awin1.com/cread.php?awinaffid=${publisherId}&ued=https://${retailer}.com/search?q=${searchQuery}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { productId, category, query, limit = 10 } = req.query;

  // Get single product affiliate links
  if (productId) {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    
    if (error) return res.status(404).json({ error: 'Product not found' });

    const retailers = AWIN_ADVERTISERS[product.category] || AWIN_ADVERTISERS.spirits;
    const links = retailers.map(r => ({
      retailer: r,
      url: generateAffiliateLink(product, r)
    }));

    return res.json({ product: product.name, affiliateLinks: links });
  }

  // Search with affiliate links
  let dbQuery = supabase.from('products').select('id, name, category, brand, price').limit(parseInt(limit));
  if (query) dbQuery = dbQuery.textSearch('name', query, { type: 'websearch' });
  if (category) dbQuery = dbQuery.eq('category', category);

  const { data: products, error } = await dbQuery;
  if (error) return res.status(500).json({ error: error.message });

  const enriched = products.map(p => {
    const retailers = AWIN_ADVERTISERS[p.category] || AWIN_ADVERTISERS.spirits;
    return {
      ...p,
      affiliateLinks: retailers.slice(0, 3).map(r => ({
        retailer: r,
        url: generateAffiliateLink(p, r)
      }))
    };
  });

  return res.json({ products: enriched, count: enriched.length });
}
