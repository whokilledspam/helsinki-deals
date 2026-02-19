import * as cheerio from 'cheerio';
import { Store, Deal, CrawlResult } from './types';
import storesData from '../data/stores.json';

// Sale/discount keywords (Finnish + English)
const SALE_KEYWORDS = [
  'sale', 'ale', 'alennus', 'alennukset', 'tarjous', 'tarjoukset',
  'outlet', 'loppuunmyynti', 'kampanja', 'etu', 'edut',
  'off', 'discount', 'clearance', 'deal', 'deals',
  'mid-season', 'end of season', 'final sale',
];

const PERCENTAGE_PATTERNS = [
  /(\d{1,2})\s*%\s*(off|alennus|ale)?/gi,
  /(-\s*\d{1,2}\s*%)/gi,
  /(up to|jopa|yli)\s*(\d{1,2})\s*%/gi,
  /(save|säästä)\s*(\d{1,2})\s*%/gi,
];

/**
 * Try to load Playwright for JS-rendered sites.
 * Falls back gracefully if not installed.
 */
async function getPlaywrightBrowser() {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    return browser;
  } catch {
    return null;
  }
}

/**
 * Fetch page HTML using Playwright (handles JS-rendered content)
 */
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
      extraHTTPHeaders: {
        'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
      },
    });
    page = await context.newPage();
    
    // Block images, fonts, media to speed up loading
    await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,mp4,webm}', route => route.abort());
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    
    // Wait a bit for JS to render
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    await page.close();
    await context.close();
    return html;
  } catch (error) {
    if (page) await page.close().catch(() => {});
    console.warn(`Playwright failed for ${url}:`, error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

/**
 * Fetch page HTML using simple fetch (for static sites)
 */
async function fetchWithCheerio(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

// Sites known to require JS rendering
const JS_RENDERED_SITES = [
  'zara.com', 'hm.com', 'nike.com', 'cos.com', 'stories.com',
  'weekday.com', 'arket.com', 'monki.com', 'mango.com',
  'hugoboss.com', 'filippa-k.com', 'uniqlo.com',
];

function needsPlaywright(url: string): boolean {
  return JS_RENDERED_SITES.some(site => url.includes(site));
}

/**
 * Analyze HTML for sale/discount content
 */
function analyzePage(html: string, store: Store): Deal[] {
  const deals: Deal[] = [];
  const now = new Date().toISOString();
  const $ = cheerio.load(html);

  $('script, style, noscript, svg').remove();

  const bodyText = $('body').text().toLowerCase();
  const title = $('title').text().toLowerCase();

  // Check for sale keywords
  for (const keyword of SALE_KEYWORDS) {
    if (bodyText.includes(keyword) || title.includes(keyword)) {
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
        break;
      }
    }
  }

  // Find sale-specific links
  const saleLinks: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    const hrefLower = href.toLowerCase();

    for (const keyword of SALE_KEYWORDS) {
      if (text.includes(keyword) || hrefLower.includes(keyword)) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          try {
            const baseUrl = new URL(store.website);
            fullUrl = `${baseUrl.origin}${href}`;
          } catch { continue; }
        } else if (!href.startsWith('http')) {
          continue;
        }
        saleLinks.push(fullUrl);
        break;
      }
    }
  });

  // Note sale links found (we'll crawl them separately if needed)
  for (const saleUrl of saleLinks.slice(0, 2)) {
    const linkText = $(`a[href="${saleUrl}"], a[href="${saleUrl.replace(store.website, '')}"]`).first().text().trim();
    if (linkText && linkText.length > 2 && linkText.length < 200) {
      deals.push({
        storeId: store.id,
        description: linkText,
        percentage: extractPercentage(linkText.toLowerCase()) || undefined,
        url: saleUrl,
        foundAt: now,
      });
    }
  }

  return deals;
}

function extractSaleContext($: cheerio.CheerioAPI, keyword: string): string | null {
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
        return false;
      }
    });

    if (found) return found;
  }

  return `Sale/discount found (${keyword})`;
}

function extractPercentage(text: string): string | null {
  for (const pattern of PERCENTAGE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

/**
 * Crawl a single store
 */
async function crawlStore(
  store: Store,
  browser: Awaited<ReturnType<typeof getPlaywrightBrowser>>
): Promise<Deal[]> {
  const usePlaywright = browser && needsPlaywright(store.website);
  
  console.log(`[${store.name}] Crawling${usePlaywright ? ' (Playwright)' : ' (fetch)'}...`);

  let html: string | null = null;

  if (usePlaywright) {
    html = await fetchWithPlaywright(browser, store.website);
  }
  
  // Fallback to fetch if Playwright failed or not needed
  if (!html) {
    html = await fetchWithCheerio(store.website);
  }

  if (!html) {
    console.warn(`[${store.name}] Failed to fetch`);
    return [];
  }

  const deals = analyzePage(html, store);

  // Deduplicate
  const unique = new Map<string, Deal>();
  for (const deal of deals) {
    const key = `${deal.storeId}-${deal.description.slice(0, 50)}`;
    if (!unique.has(key)) unique.set(key, deal);
  }

  const result = Array.from(unique.values());
  if (result.length > 0) {
    console.log(`[${store.name}] Found ${result.length} deal(s)`);
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

  // Try to launch Playwright
  const browser = await getPlaywrightBrowser();
  if (browser) {
    console.log('✅ Playwright available — JS-rendered sites will be fully crawled');
  } else {
    console.log('⚠️  Playwright not available — falling back to fetch+cheerio for all sites');
    console.log('   Install playwright for better results: npm install playwright && npx playwright install chromium');
  }

  // Process in batches
  const batchSize = browser ? 3 : 5; // Smaller batches with Playwright (more memory)
  for (let i = 0; i < stores.length; i += batchSize) {
    const batch = stores.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((store) => crawlStore(store, browser))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allDeals.push(...result.value);
      }
    }

    console.log(`Crawled ${Math.min(i + batchSize, stores.length)}/${stores.length} stores...`);

    if (i + batchSize < stores.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Clean up Playwright
  if (browser) {
    await browser.close().catch(() => {});
  }

  console.log(`Crawl complete. Found ${allDeals.length} deals across ${stores.length} stores.`);

  return {
    lastCrawled: new Date().toISOString(),
    deals: allDeals,
  };
}

