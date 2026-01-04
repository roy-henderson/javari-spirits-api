// api/import.js - Vercel Serverless Function for Data Import
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Embedded data sources (subset for serverless)
const DATA_SOURCES = {
  iowa_catalog: 'https://data.iowa.gov/api/views/gckp-fe7r/rows.csv?accessType=DOWNLOAD',
  openbrewery: 'https://api.openbrewerydb.org/v1/breweries?per_page=200',
  boston_cocktails: 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-05-26/boston_cocktails.csv'
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function truncate(str, len) {
  if (!str) return null;
  return String(str).length > len ? String(str).slice(0, len) : String(str);
}

function parseNumber(str) {
  if (!str) return null;
  const num = parseFloat(String(str).replace(/[$,%]/g, ''));
  return isNaN(num) ? null : num;
}

async function importIowaCatalog() {
  const res = await fetch(DATA_SOURCES.iowa_catalog);
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim()).slice(1);
  const products = [];
  
  for (const line of lines.slice(0, 5000)) { // Limit for serverless
    const fields = parseCSVLine(line);
    if (fields.length < 16) continue;
    const [itemNumber, categoryName, itemDescription, , vendorName, volumeMl, , , , proof, , , , , , retail] = fields;
    if (!itemDescription) continue;
    
    products.push({
      name: truncate(itemDescription, 255),
      category: 'spirits',
      subcategory: truncate(categoryName, 100),
      brand: truncate(vendorName, 100),
      price: parseNumber(retail),
      alcohol_content: parseNumber(proof) ? parseNumber(proof) / 2 : null,
      size: volumeMl ? `${volumeMl}ml` : null,
      source: 'iowa_catalog',
      source_id: `iac_${itemNumber}`
    });
  }
  return products;
}

async function importOpenBrewery() {
  const products = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${DATA_SOURCES.openbrewery}&page=${page}`);
    const breweries = await res.json();
    if (!breweries.length) break;
    
    for (const b of breweries) {
      products.push({
        name: truncate(b.name, 255),
        category: 'beer',
        subcategory: truncate(b.brewery_type || 'Brewery', 100),
        brand: truncate(b.name, 100),
        country: truncate(b.country || 'United States', 100),
        region: truncate(b.state ? `${b.city}, ${b.state}` : b.city, 100),
        source: 'openbrewerydb',
        source_id: `obdb_${b.id}`,
        metadata: { brewery_type: b.brewery_type, city: b.city, state: b.state, is_brewery: true }
      });
    }
  }
  return products;
}

async function importBostonCocktails() {
  const res = await fetch(DATA_SOURCES.boston_cocktails);
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim()).slice(1);
  const cocktails = new Map();
  
  for (const line of lines) {
    const [name, category, rowId, , ingredient, measure] = parseCSVLine(line);
    if (!name) continue;
    if (!cocktails.has(rowId)) cocktails.set(rowId, { name, category, ingredients: [] });
    cocktails.get(rowId).ingredients.push({ ingredient, measure });
  }
  
  const products = [];
  for (const [id, c] of cocktails) {
    products.push({
      name: truncate(c.name, 255),
      category: 'cocktails',
      subcategory: truncate(c.category, 100),
      description: truncate(c.ingredients.map(i => `${i.measure} ${i.ingredient}`).join(', '), 2000),
      source: 'boston_cocktails',
      source_id: `bc_${id}`,
      metadata: { ingredients: c.ingredients }
    });
  }
  return products;
}

async function batchInsert(products) {
  let inserted = 0;
  for (let i = 0; i < products.length; i += 500) {
    const batch = products.slice(i, i + 500);
    const { data, error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'source,source_id', ignoreDuplicates: true })
      .select('id');
    if (!error) inserted += data?.length || 0;
  }
  return inserted;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.IMPORT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const results = { sources: {}, total: 0, errors: [] };

  try {
    // Iowa Catalog
    const iowa = await importIowaCatalog();
    const iowaInserted = await batchInsert(iowa);
    results.sources.iowa_catalog = { parsed: iowa.length, inserted: iowaInserted };
    results.total += iowaInserted;
  } catch (e) {
    results.errors.push({ source: 'iowa_catalog', error: e.message });
  }

  try {
    // Open Brewery
    const brewery = await importOpenBrewery();
    const breweryInserted = await batchInsert(brewery);
    results.sources.openbrewery = { parsed: brewery.length, inserted: breweryInserted };
    results.total += breweryInserted;
  } catch (e) {
    results.errors.push({ source: 'openbrewery', error: e.message });
  }

  try {
    // Boston Cocktails
    const cocktails = await importBostonCocktails();
    const cocktailsInserted = await batchInsert(cocktails);
    results.sources.boston_cocktails = { parsed: cocktails.length, inserted: cocktailsInserted };
    results.total += cocktailsInserted;
  } catch (e) {
    results.errors.push({ source: 'boston_cocktails', error: e.message });
  }

  results.elapsed = `${Math.round((Date.now() - startTime) / 1000)}s`;
  results.timestamp = new Date().toISOString();

  return res.status(200).json(results);
}
