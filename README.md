# Javari Spirits API

Production-ready REST API for the Javari Spirits product database.

## Endpoints

### Search Products
```
GET /api/search?q=bourbon&category=spirits&priceMax=50&limit=20
```

Parameters:
- `q` - Search query (full-text search)
- `category` - wine, beer, spirits, cocktails
- `subcategory` - Filter by subcategory
- `priceMin`, `priceMax` - Price range
- `country` - Filter by country
- `limit`, `offset` - Pagination

### Get Product
```
GET /api/products/:id
```

Returns product details and similar products.

### Categories
```
GET /api/categories
```

Returns all categories with subcategories and counts.

### Recommendations
```
GET /api/recommendations?category=wine&style=cabernet&priceMax=30
```

### Health Check
```
GET /api/health
```

Returns database stats and health status.

### Trigger Import (Protected)
```
POST /api/import
Headers: x-api-key: YOUR_API_KEY
```

Triggers data import from external sources.

## Deployment

### Vercel (Recommended)
```bash
npm install
vercel --prod
```

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `IMPORT_API_KEY`

### Vercel Cron
Import runs automatically every Sunday at 8 AM UTC (3 AM ET).

## Database Schema

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  brand VARCHAR(100),
  description TEXT,
  price DECIMAL(10,2),
  alcohol_content DECIMAL(5,2),
  country VARCHAR(100),
  region VARCHAR(100),
  style VARCHAR(100),
  size VARCHAR(50),
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(source, source_id)
);
```

## Rate Limits

- Search: 100 requests/minute
- Import: 1 request/hour (protected)

---

**CR AudioViz AI, LLC**
