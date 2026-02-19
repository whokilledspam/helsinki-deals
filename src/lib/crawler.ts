import * as cheerio from 'cheerio';
import { Store, Deal, CrawlResult } from './types';
import storesData from '../data/stores.json';

// ── False-positive filters ──────────────────────────────────────────
// These phrases often appear in footers/legal text and are NOT real deals
const FALSE_POSITIVES = [
  'terms of sale', 'terms and conditions', 'conditions of sale',
  'myyntiehdot', 'käyttöehdot', 'tietosuoja', 'privacy',
  'cookie', 'eväste', 'rekisteriseloste', 'returns', 'palautus',
  'return policy', 'shipping', 'toimitus', 'asiakaspalvelu',
  'customer service', 'wholesale', 'press', 'careers', 'ura',
  'investor', 'annual report', 'sustainability', 'vastuullisuus',
  'gift card', 'lahjakortti', 'sign up', 'newsletter', 'uutiskirje',
  'log in', 'kirjaudu', 'rekisteröidy', 'my account', 'oma tili',
];

// Sale keywords — Finnish + English
const SALE_KEYWORDS_STRONG = [
  'ale', 'alennus', 'alennukset', 'tarjous', 'tarjoukset',
  'loppuunmyynti', 'kampanja',
  'sale', 'clearance', 'outlet', 'final sale',
  'mid-season sale', 'end of season',
];

// Percentage patterns
const PERCENTAGE_PATTERNS = [
  /(-?\d{1,2})\s*%\s*(off|alennus|ale|discount)?/gi,
  /(up to|jopa|yli|till|až)\s*(\d{1,2})\s*%/gi,
  /(save|säästä|spara)\s*(\d{1,2})\s*%/gi,
];

// Clothing categories for context
const CLOTHING_CATEGORIES = [
  // English
  'dresses', 'tops', 'shirts', 'blouses', 'pants', 'trousers', 'jeans',
  'jackets', 'coats', 'knitwear', 'sweaters', 'hoodies', 'skirts',
  'shorts', 'shoes', 'boots', 'sneakers', 'bags', 'accessories',
  'underwear', 'swimwear', 'sportswear', 'outerwear', 'suits',
  't-shirts', 'blazers', 'cardigans', 'leggings',
  'men', 'women', 'kids', 'children',
  // Finnish
  'mekot', 'paidat', 'housut', 'farkut', 'takit', 'neuleet',
  'hupparit', 'hameet', 'shortsit', 'kengät', 'laukut',
  'asusteet', 'alusvaatteet', 'uima-asut', 'urheiluvaatteet',
  'miesten', 'naisten', 'lasten',
  // Swedish (common in Finnish retail)
  'klänningar', 'byxor', 'jackor', 'skor', 'väskor',
];

// ── Playwright setup ────────────────────────────────────────────────

async function getPlaywrightBrowser() {
  try {
    const { chromium } = await import('playwright');
    return await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch {
    return null;
  }
}

async function fetchWithPlaywright(
  browser: Awaited<ReturnType<typeof getPlaywrightBrowser>>,
  url: string,
  timeoutMs = 15000
): Promise<string | null> {
  if (!browser) return null;
  let page;
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'fi-FI',
      extraHTTPHeaders: { 'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8' },
    });
    page = await context.newPage();
    await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,mp4,webm}', route => route.abort());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(3000);
    const html = await page.content();
    await page.close();
    await context.close();
    return html;
  } catch (error) {
    if (page) await page.close().catch(() => {});
    return null;
  }
}

async function fetchWithCheerio(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

const JS_RENDERED_SITES = [
  'zara.com', 'hm.com', 'nike.com', 'cos.com', 'stories.com',
  'weekday.com', 'arket.com', 'monki.com', 'mango.com',
  'hugoboss.com', 'filippa-k.com', 'uniqlo.com',
];

function needsPlaywright(url: string): boolean {
  return JS_RENDERED_SITES.some(site => url.includes(site));
}

// ── Analysis ────────────────────────────────────────────────────────

function isFalsePositive(text: string): boolean {
  const lower = text.toLowerCase();
  return FALSE_POSITIVES.some(fp => lower.includes(fp));
}

function extractPercentage(text: string): string | null {
  for (const pattern of PERCENTAGE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) {
      const pct = match[0].trim();
      // Ignore tiny discounts or 0%
      const num = parseInt(pct.replace(/\D/g, ''));
      if (num >= 5 && num <= 90) return pct;
    }
  }
  return null;
}

function extractCategories(text: string): string[] {
  const lower = text.toLowerCase();
  return CLOTHING_CATEGORIES.filter(cat => {
    // Match whole words only
    const regex = new RegExp(`\\b${cat}\\b`, 'i');
    return regex.test(lower);
  });
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Find sale links on a store's main page
 */
function findSaleLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{ url: string; text: string }> {
  const links: Array<{ url: string; text: string }> = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = cleanText($(el).text());
    const hrefLower = href.toLowerCase();
    const textLower = text.toLowerCase();

    // Check if the link is sale-related
    const isSaleLink = SALE_KEYWORDS_STRONG.some(kw =>
      textLower.includes(kw) || hrefLower.includes(kw)
    );

    if (!isSaleLink) return;
    if (isFalsePositive(text)) return;
    if (text.length < 2 || text.length > 200) return;

    let fullUrl = href;
    if (href.startsWith('/')) {
      try {
        fullUrl = new URL(href, baseUrl).href;
      } catch { return; }
    } else if (!href.startsWith('http')) {
      return;
    }

    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      links.push({ url: fullUrl, text });
    }
  });

  return links;
}

/**
 * Extract specific sale items/categories from a sale page
 */
function extractSaleDetails($: cheerio.CheerioAPI): Array<{ text: string; percentage?: string; categories: string[] }> {
  const details: Array<{ text: string; percentage?: string; categories: string[] }> = [];
  const seen = new Set<string>();

  // Look for promotional banners, headings, and highlighted sections
  const selectors = [
    // Headings with sale content
    'h1', 'h2', 'h3',
    // Common sale/promo containers
    '[class*="promo"]', '[class*="banner"]', '[class*="campaign"]',
    '[class*="hero"]', '[class*="offer"]', '[class*="deal"]',
    '[class*="sale"]', '[class*="discount"]',
    '[class*="ale-"]', '[class*="-ale"]',
    // Product category links within sale sections
    '[class*="category"]', '[class*="grid"] a',
    // Price containers
    '[class*="price"] [class*="was"]', '[class*="price"] [class*="old"]',
    '[class*="original-price"]', '[class*="reduced"]',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = cleanText($(el).text());
      if (text.length < 3 || text.length > 300) return;
      if (isFalsePositive(text)) return;

      const lower = text.toLowerCase();
      const hasSaleKeyword = SALE_KEYWORDS_STRONG.some(kw => lower.includes(kw));
      const percentage = extractPercentage(text);
      const categories = extractCategories(text);

      if (!hasSaleKeyword && !percentage && categories.length === 0) return;

      const key = text.slice(0, 60).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      details.push({ text, percentage: percentage || undefined, categories });
    });
  }

  return details;
}

/**
 * Build a meaningful deal description
 */
function buildDescription(text: string, categories: string[]): string {
  let desc = cleanText(text);

  // If the text is just a keyword like "Sale" or "Ale", enrich with categories
  if (desc.length < 15 && categories.length > 0) {
    const catStr = categories.slice(0, 3).join(', ');
    desc = `${desc} — ${catStr}`;
  }

  return desc;
}

/**
 * Crawl a single store — main page + sale pages
 */
async function crawlStore(
  store: Store,
  browser: Awaited<ReturnType<typeof getPlaywrightBrowser>>
): Promise<Deal[]> {
  const usePlaywright = browser && needsPlaywright(store.website);
  console.log(`[${store.name}] Crawling${usePlaywright ? ' (Playwright)' : ' (fetch)'}...`);

  const fetchPage = async (url: string): Promise<string | null> => {
    if (usePlaywright) {
      const html = await fetchWithPlaywright(browser, url);
      if (html) return html;
    }
    return await fetchWithCheerio(url);
  };

  // 1. Fetch main page
  const mainHtml = await fetchPage(store.website);
  if (!mainHtml) {
    console.warn(`[${store.name}] Failed to fetch`);
    return [];
  }

  const $ = cheerio.load(mainHtml);
  $('script, style, noscript, svg, iframe').remove();

  const now = new Date().toISOString();
  const deals: Deal[] = [];

  // 2. Find sale links on main page
  const saleLinks = findSaleLinks($, store.website);

  // 3. Extract details from main page
  const mainDetails = extractSaleDetails($);
  for (const detail of mainDetails) {
    const desc = buildDescription(detail.text, detail.categories);
    if (desc.length > 3) {
      deals.push({
        storeId: store.id,
        description: desc,
        percentage: detail.percentage,
        url: store.website,
        foundAt: now,
      });
    }
  }

  // 4. Follow up to 3 sale links and extract details from those pages
  const salePagesToVisit = saleLinks.slice(0, 3);
  for (const link of salePagesToVisit) {
    try {
      const saleHtml = await fetchPage(link.url);
      if (!saleHtml) continue;

      const sale$ = cheerio.load(saleHtml);
      sale$('script, style, noscript, svg, iframe').remove();

      const saleTitle = cleanText(sale$('h1').first().text()) || cleanText(sale$('title').first().text());
      const saleDetails = extractSaleDetails(sale$);

      if (saleDetails.length > 0) {
        // Use the most specific details from the sale page
        for (const detail of saleDetails.slice(0, 5)) {
          const desc = buildDescription(detail.text, detail.categories);
          if (desc.length > 3 && !isFalsePositive(desc)) {
            deals.push({
              storeId: store.id,
              description: desc,
              percentage: detail.percentage,
              url: link.url,
              foundAt: now,
            });
          }
        }
      } else if (saleTitle && !isFalsePositive(saleTitle)) {
        // Fallback: use the sale page title
        const categories = extractCategories(sale$('body').text());
        const percentage = extractPercentage(sale$('body').text());
        const desc = buildDescription(saleTitle, categories);
        deals.push({
          storeId: store.id,
          description: desc,
          percentage: percentage || undefined,
          url: link.url,
          foundAt: now,
        });
      }

      // Small delay between sale page fetches
      await new Promise(r => setTimeout(r, 500));
    } catch {
      // Skip failed sale page
    }
  }

  // 5. If we only found main page sale links but no details, use the link text
  if (deals.length === 0 && saleLinks.length > 0) {
    for (const link of saleLinks.slice(0, 3)) {
      if (!isFalsePositive(link.text) && link.text.length > 2) {
        deals.push({
          storeId: store.id,
          description: link.text,
          percentage: extractPercentage(link.text) || undefined,
          url: link.url,
          foundAt: now,
        });
      }
    }
  }

  // 6. Deduplicate and filter
  const unique = new Map<string, Deal>();
  for (const deal of deals) {
    // Skip very generic descriptions
    if (/^sale$/i.test(deal.description.trim())) continue;
    if (/^ale$/i.test(deal.description.trim())) continue;

    const key = `${deal.storeId}-${deal.description.slice(0, 60).toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, deal);
  }

  const result = Array.from(unique.values());
  if (result.length > 0) {
    console.log(`[${store.name}] Found ${result.length} deal(s):`);
    result.forEach(d => console.log(`    ${d.percentage || '   '} | ${d.description.slice(0, 80)}`));
  }
  return result;
}

/**
 * Crawl all stores
 */
export async function crawlAllStores(): Promise<CrawlResult> {
  const stores = storesData as Store[];
  const allDeals: Deal[] = [];

  console.log(`Starting crawl of ${stores.length} stores...`);

  const browser = await getPlaywrightBrowser();
  if (browser) {
    console.log('✅ Playwright available — JS-rendered sites will be fully crawled');
  } else {
    console.log('⚠️  Playwright not available — falling back to fetch+cheerio');
  }

  const batchSize = browser ? 3 : 5;
  for (let i = 0; i < stores.length; i += batchSize) {
    const batch = stores.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((store) => crawlStore(store, browser))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') allDeals.push(...result.value);
    }

    console.log(`Crawled ${Math.min(i + batchSize, stores.length)}/${stores.length} stores...`);
    if (i + batchSize < stores.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (browser) await browser.close().catch(() => {});

  console.log(`\nCrawl complete. Found ${allDeals.length} deals across ${stores.length} stores.`);
  return { lastCrawled: new Date().toISOString(), deals: allDeals };
}
