import * as cheerio from 'cheerio';
import { Store, Deal, CrawlResult } from './types';
import storesData from '@/data/stores.json';

// Sale/discount keywords to look for (Finnish + English)
const SALE_KEYWORDS = [
  'sale', 'ale', 'alennus', 'alennukset', 'tarjous', 'tarjoukset',
  'outlet', 'loppuunmyynti', 'kampanja', 'etu', 'edut',
  'off', 'discount', 'clearance', 'deal', 'deals',
  'mid-season', 'end of season', 'final sale',
];

// Patterns that indicate a percentage discount
const PERCENTAGE_PATTERNS = [
  /(\d{1,2})\s*%\s*(off|alennus|ale)?/gi,
  /(-\s*\d{1,2}\s*%)/gi,
  /(up to|jopa|yli)\s*(\d{1,2})\s*%/gi,
  /(save|säästä)\s*(\d{1,2})\s*%/gi,
];

// Specific sale page paths to try for each store
const SALE_PATHS: Record<string, string[]> = {
  'hm': ['/fi_fi/sale.html', '/fi_fi/ale.html'],
  'zara': ['/fi/sale-l1310.html'],
  'cos': ['/fi_fi/sale.html'],
  'marimekko': ['/fi_fi/sale/'],
  'stockmann': ['/fi/tarjoukset/', '/fi/ale/'],
  'sokos': ['/tarjoukset'],
  'monki': ['/fi/sale/'],
  'stories': ['/fi_fi/sale.html'],
  'weekday': ['/fi_fi/sale.html'],
  'arket': ['/fi_fi/sale.html'],
  'nike': ['/fi/w/sale'],
  'lindex': ['/fi/ale/'],
  'kappahl': ['/fi-fi/ale/'],
  'mango': ['/fi/ale'],
  'uniqlo': ['/fi/fi/special-offers.html'],
  'intersport': ['/kampanja/', '/tarjoukset/'],
  'stadium': ['/rea/', '/kampanjer/'],
  'gant': ['/sale/'],
  'filippa-k': ['/fi/sale/'],
  'hugoboss': ['/fi/sale/'],
  'xxl': ['/kampanjat/', '/ale/'],
};

/**
 * Fetch a page and extract any sale/discount indicators
 */
async function crawlStore(store: Store): Promise<Deal[]> {
  const deals: Deal[] = [];
  const now = new Date().toISOString();

  try {
    // Fetch the main page
    const response = await fetch(store.website, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HelsinkiDeals/1.0; +https://helsinki-deals.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[${store.name}] HTTP ${response.status}`);
      return deals;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts and styles to reduce noise
    $('script, style, noscript').remove();

    const bodyText = $('body').text().toLowerCase();
    const title = $('title').text().toLowerCase();

    // Check for sale keywords in the page
    for (const keyword of SALE_KEYWORDS) {
      if (bodyText.includes(keyword) || title.includes(keyword)) {
        // Try to extract more context around the keyword
        const description = extractSaleContext($, keyword);
        const percentage = extractPercentage(bodyText);

        if (description) {
          deals.push({
            storeId: store.id,
            description,
            percentage: percentage || undefined,
            url: store.website,
            foundAt: now,
          });
          break; // One deal per store from main page
        }
      }
    }

    // Check for sale-specific links
    const saleLinks: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      const hrefLower = href.toLowerCase();

      for (const keyword of SALE_KEYWORDS) {
        if (text.includes(keyword) || hrefLower.includes(keyword)) {
          let fullUrl = href;
          if (href.startsWith('/')) {
            const baseUrl = new URL(store.website);
            fullUrl = `${baseUrl.origin}${href}`;
          } else if (!href.startsWith('http')) {
            continue;
          }
          saleLinks.push(fullUrl);
          break;
        }
      }
    });

    // Crawl found sale links (max 2)
    for (const saleUrl of saleLinks.slice(0, 2)) {
      try {
        const saleResponse = await fetch(saleUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HelsinkiDeals/1.0)',
            'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (saleResponse.ok) {
          const saleHtml = await saleResponse.text();
          const sale$ = cheerio.load(saleHtml);
          sale$('script, style, noscript').remove();

          const saleText = sale$('body').text().toLowerCase();
          const percentage = extractPercentage(saleText);
          const saleTitle = sale$('title').text() || sale$('h1').first().text();

          if (saleTitle) {
            deals.push({
              storeId: store.id,
              description: saleTitle.trim().slice(0, 200),
              percentage: percentage || undefined,
              url: saleUrl,
              foundAt: now,
            });
          }
        }
      } catch {
        // Skip failed sale page fetches
      }
    }
  } catch (error) {
    console.warn(`[${store.name}] Crawl error:`, error instanceof Error ? error.message : 'Unknown error');
  }

  // Deduplicate deals by description
  const unique = new Map<string, Deal>();
  for (const deal of deals) {
    const key = `${deal.storeId}-${deal.description.slice(0, 50)}`;
    if (!unique.has(key)) {
      unique.set(key, deal);
    }
  }

  return Array.from(unique.values());
}

/**
 * Extract context around a sale keyword from the HTML
 */
function extractSaleContext($: cheerio.CheerioAPI, keyword: string): string | null {
  // Look for elements containing the keyword
  const selectors = [
    'h1', 'h2', 'h3', 'h4',
    '.sale', '.campaign', '.banner', '.promo', '.offer',
    '[class*="sale"]', '[class*="promo"]', '[class*="campaign"]',
    '[class*="ale"]', '[class*="offer"]', '[class*="deal"]',
    'a[href*="sale"]', 'a[href*="ale"]',
  ];

  for (const selector of selectors) {
    const elements = $(selector);
    let found: string | null = null;

    elements.each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes(keyword) && text.length > 3 && text.length < 300) {
        found = text;
        return false; // break
      }
    });

    if (found) return found;
  }

  return `Sale/discount found (${keyword})`;
}

/**
 * Extract percentage from text
 */
function extractPercentage(text: string): string | null {
  for (const pattern of PERCENTAGE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
}

/**
 * Crawl all stores and return results
 */
export async function crawlAllStores(): Promise<CrawlResult> {
  const stores = storesData as Store[];
  const allDeals: Deal[] = [];

  console.log(`Starting crawl of ${stores.length} stores...`);

  // Process in batches of 5 to avoid overwhelming
  const batchSize = 5;
  for (let i = 0; i < stores.length; i += batchSize) {
    const batch = stores.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((store) => crawlStore(store))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allDeals.push(...result.value);
      }
    }

    console.log(`Crawled ${Math.min(i + batchSize, stores.length)}/${stores.length} stores...`);

    // Small delay between batches
    if (i + batchSize < stores.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`Crawl complete. Found ${allDeals.length} deals.`);

  return {
    lastCrawled: new Date().toISOString(),
    deals: allDeals,
  };
}
