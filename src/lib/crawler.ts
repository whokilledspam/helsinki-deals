import * as cheerio from 'cheerio';
import { Store, Deal, CrawlResult } from './types';
import storesData from '../data/stores.json';

// ── False positives ─────────────────────────────────────────────────
const FALSE_POSITIVES = [
  'terms of sale', 'terms and conditions', 'conditions of sale',
  'myyntiehdot', 'käyttöehdot', 'tietosuoja', 'privacy',
  'cookie', 'eväste', 'rekisteriseloste', 'returns', 'palautus',
  'return policy', 'shipping', 'toimitus', 'asiakaspalvelu',
  'customer service', 'wholesale', 'press', 'careers', 'ura',
  'investor', 'annual report', 'sustainability', 'vastuullisuus',
  'gift card', 'lahjakortti', 'sign up', 'newsletter', 'uutiskirje',
  'log in', 'kirjaudu', 'rekisteröidy', 'my account', 'oma tili',
  'size guide', 'kokotauluk', 'student', 'subscribe', 'tilaa',
  'spotify', 'instagram', 'facebook', 'tiktok', 'youtube',
  'arvostelu', 'review', 'opas', 'guide',
];

// Strong sale keywords — these indicate actual sales
const SALE_KEYWORDS = [
  'ale', 'alennus', 'alennukset', 'tarjous', 'tarjoukset',
  'loppuunmyynti', 'kampanja',
  'sale', 'clearance', 'outlet', 'final sale',
  'mid-season sale', 'end of season',
  'season sale', 'talviale', 'kesäale', 'kevätale',
];

const PERCENTAGE_PATTERNS = [
  /(-?\d{1,2})\s*%\s*(off|alennus|ale|discount)?/gi,
  /(up to|jopa|yli|till)\s*(\d{1,2})\s*%/gi,
  /(save|säästä|spara)\s*(\d{1,2})\s*%/gi,
];

// ── Playwright ──────────────────────────────────────────────────────

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
  } catch {
    if (page) await page.close().catch(() => {});
    return null;
  }
}

async function fetchSimple(url: string): Promise<string | null> {
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

const JS_SITES = ['zara.com', 'hm.com', 'nike.com', 'cos.com', 'stories.com', 'weekday.com', 'arket.com', 'monki.com', 'mango.com', 'hugoboss.com', 'filippa-k.com', 'uniqlo.com'];

// ── Helpers ─────────────────────────────────────────────────────────

function isFalsePositive(text: string): boolean {
  const lower = text.toLowerCase();
  return FALSE_POSITIVES.some(fp => lower.includes(fp));
}

function extractPercentage(text: string): string | null {
  for (const pattern of PERCENTAGE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[0].replace(/\D/g, ''));
      if (num >= 10 && num <= 80) return match[0].trim();
    }
  }
  return null;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function hasSaleKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return SALE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Score how likely a text block is to be an actual deal.
 * Must return > 0 to be included.
 */
function scoreDeal(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  // Has a percentage discount — strong signal
  if (extractPercentage(text)) score += 3;

  // Has sale keyword
  if (hasSaleKeyword(lower)) score += 2;

  // Has price info (€ or "hinta")
  if (/\d+[,.]?\d*\s*€/.test(text) || lower.includes('hinta') || lower.includes('price')) score += 2;

  // Has "from" price indicator
  if (lower.includes('alk.') || lower.includes('from ') || lower.includes('starting')) score += 1;

  // Has specific product name (long enough, mixed case)
  if (text.length > 20 && /[A-Z][a-z]/.test(text)) score += 1;

  // Penalty: too short (just a category name like "Shoes")
  if (text.length < 15) score -= 2;

  // Penalty: looks like navigation (has "Takaisin", "Kaikki", "Shop All")
  if (lower.includes('takaisin') || lower.includes('kaikki kategori') || lower.includes('shop all')) score -= 5;

  // Penalty: is just a list of categories
  if ((text.match(/[A-Z][a-z]+/g) || []).length > 5 && !extractPercentage(text)) score -= 3;

  // Penalty: false positive
  if (isFalsePositive(text)) score -= 10;

  return score;
}

// ── Main crawl logic ────────────────────────────────────────────────

/**
 * Extract actual deals from a page's HTML
 */
function extractDeals($: cheerio.CheerioAPI, store: Store, pageUrl: string): Deal[] {
  const now = new Date().toISOString();
  const deals: Deal[] = [];
  const seen = new Set<string>();

  // 1. Look for promotional banners and headings
  const promoSelectors = [
    'h1', 'h2', 'h3',
    '[class*="promo"]', '[class*="banner"]', '[class*="campaign"]',
    '[class*="hero"]', '[class*="offer"]',
    '[class*="sale"]:not(nav *):not(footer *)',
    '[class*="discount"]',
    '[class*="ale-"]:not(nav *)', '[class*="-ale"]:not(nav *)',
  ];

  for (const selector of promoSelectors) {
    $(selector).each((_, el) => {
      const text = cleanText($(el).text());
      if (text.length < 5 || text.length > 250) return;

      const score = scoreDeal(text);
      if (score < 2) return; // Must have at least decent signal

      const key = text.slice(0, 60).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      deals.push({
        storeId: store.id,
        description: text,
        percentage: extractPercentage(text) || undefined,
        url: pageUrl,
        foundAt: now,
      });
    });
  }

  // 2. Look for product cards with discounted prices
  const productSelectors = [
    '[class*="product"]',
    '[class*="item"]',
    '[class*="card"]',
  ];

  for (const selector of productSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const text = cleanText($el.text());

      // Must have a price with discount indicator
      const hasOldPrice = $el.find('[class*="old"], [class*="was"], [class*="original"], [class*="regular"], del, s').length > 0;
      const hasNewPrice = $el.find('[class*="sale"], [class*="new"], [class*="current"], [class*="discount"], [class*="reduced"]').length > 0;
      const percentage = extractPercentage(text);

      if (!hasOldPrice && !hasNewPrice && !percentage) return;
      if (text.length < 10) return;

      const score = scoreDeal(text);
      if (score < 1) return;

      const key = text.slice(0, 60).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      deals.push({
        storeId: store.id,
        description: text,
        percentage: percentage || undefined,
        url: pageUrl,
        foundAt: now,
      });
    });
  }

  return deals;
}

/**
 * Find sale page URLs from the main page
 */
function findSalePageUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase().trim();
    const hrefLower = href.toLowerCase();

    // Only follow links that are clearly sale/outlet pages
    const isSaleUrl = /\/(sale|ale|outlet|tarjous|kampanja|clearance|deals)\b/i.test(hrefLower);
    const isSaleText = SALE_KEYWORDS.some(kw => text.includes(kw)) && text.length < 50;

    if (!isSaleUrl && !isSaleText) return;
    if (isFalsePositive(text)) return;

    let fullUrl = href;
    if (href.startsWith('/')) {
      try { fullUrl = new URL(href, baseUrl).href; } catch { return; }
    } else if (!href.startsWith('http')) return;

    // Skip if it's the same as the main page
    if (fullUrl === baseUrl) return;

    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      urls.push(fullUrl);
    }
  });

  return urls;
}

/**
 * Crawl one store
 */
async function crawlStore(
  store: Store,
  browser: Awaited<ReturnType<typeof getPlaywrightBrowser>>
): Promise<Deal[]> {
  const usePlaywright = browser && JS_SITES.some(s => store.website.includes(s));
  console.log(`[${store.name}] Crawling${usePlaywright ? ' (Playwright)' : ' (fetch)'}...`);

  const fetchPage = async (url: string) => {
    if (usePlaywright) {
      const html = await fetchWithPlaywright(browser, url);
      if (html) return html;
    }
    return await fetchSimple(url);
  };

  const mainHtml = await fetchPage(store.website);
  if (!mainHtml) {
    console.warn(`[${store.name}] Failed to fetch`);
    return [];
  }

  const $ = cheerio.load(mainHtml);
  $('script, style, noscript, svg, iframe, nav, footer').remove();

  const deals: Deal[] = [];

  // Extract deals from main page
  const mainDeals = extractDeals($, store, store.website);
  deals.push(...mainDeals);

  // Find and crawl sale pages (max 2)
  const $withNav = cheerio.load(mainHtml); // Re-parse to include nav for link finding
  $withNav('script, style, noscript, svg, iframe').remove();
  const saleUrls = findSalePageUrls($withNav, store.website);

  for (const saleUrl of saleUrls.slice(0, 2)) {
    try {
      const saleHtml = await fetchPage(saleUrl);
      if (!saleHtml) continue;

      const sale$ = cheerio.load(saleHtml);
      sale$('script, style, noscript, svg, iframe, nav, footer').remove();

      const saleDeals = extractDeals(sale$, store, saleUrl);
      deals.push(...saleDeals);

      await new Promise(r => setTimeout(r, 500));
    } catch {
      // Skip
    }
  }

  // Deduplicate
  const unique = new Map<string, Deal>();
  for (const deal of deals) {
    const key = `${deal.storeId}-${deal.description.slice(0, 60).toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, deal);
  }

  // Limit to top 8 deals per store (sorted by specificity — ones with % first)
  const result = Array.from(unique.values())
    .sort((a, b) => (b.percentage ? 1 : 0) - (a.percentage ? 1 : 0))
    .slice(0, 8);

  if (result.length > 0) {
    console.log(`[${store.name}] Found ${result.length} deal(s):`);
    result.forEach(d => console.log(`    ${(d.percentage || '').padEnd(10)} ${d.description.slice(0, 80)}`));
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
    console.log('✅ Playwright available');
  } else {
    console.log('⚠️  Playwright not available — falling back to fetch+cheerio');
  }

  const batchSize = browser ? 3 : 5;
  for (let i = 0; i < stores.length; i += batchSize) {
    const batch = stores.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(s => crawlStore(s, browser)));
    for (const result of results) {
      if (result.status === 'fulfilled') allDeals.push(...result.value);
    }
    console.log(`Crawled ${Math.min(i + batchSize, stores.length)}/${stores.length} stores...`);
    if (i + batchSize < stores.length) await new Promise(r => setTimeout(r, 1000));
  }

  if (browser) await browser.close().catch(() => {});

  console.log(`\nCrawl complete. Found ${allDeals.length} deals across ${stores.length} stores.`);
  return { lastCrawled: new Date().toISOString(), deals: allDeals };
}
