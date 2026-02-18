/**
 * Standalone crawler script — run via: npx tsx src/lib/run-crawler.ts
 * Used by GitHub Actions weekly cron and manual crawling.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  // Dynamic import to handle the @ path alias resolution
  const { crawlAllStores } = await import('./crawler');
  
  console.log('🕷️  Helsinki Deals Crawler');
  console.log('========================\n');

  const result = await crawlAllStores();

  const dealsPath = join(process.cwd(), 'src', 'data', 'deals.json');
  writeFileSync(dealsPath, JSON.stringify(result, null, 2));

  console.log(`\n✅ Wrote ${result.deals.length} deals to ${dealsPath}`);
  console.log(`   Last crawled: ${result.lastCrawled}`);
}

main().catch((error) => {
  console.error('❌ Crawler failed:', error);
  process.exit(1);
});
