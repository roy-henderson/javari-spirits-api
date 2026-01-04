// api/awin.js - Awin Integration API
import { AwinIntegration, AwinDashboard } from '../lib/awin-integration.js';

const awin = new AwinIntegration({
  apiToken: process.env.AWIN_API_TOKEN,
  publisherId: process.env.AWIN_PUBLISHER_ID
});
const dashboard = new AwinDashboard(awin);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'advertisers':
        const advertisers = await awin.getAlcoholAdvertisers();
        return res.json({ advertisers });
      
      case 'dashboard':
        const overview = await dashboard.getOverview();
        return res.json(overview);
      
      case 'sync':
        // Would need Supabase client
        return res.json({ message: 'Use import API for sync' });
      
      default:
        return res.json({
          endpoints: [
            '/api/awin?action=advertisers',
            '/api/awin?action=dashboard'
          ]
        });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
