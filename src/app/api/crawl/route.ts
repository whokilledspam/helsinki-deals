import { NextResponse } from 'next/server';
import { crawlAllStores } from '@/lib/crawler';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const maxDuration = 60; // Allow up to 60s on Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Optional: verify cron secret for Vercel cron jobs
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow unauthenticated access in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('Starting crawl...');
    const result = await crawlAllStores();

    // In development, write results to the data file
    if (process.env.NODE_ENV !== 'production') {
      try {
        const dealsPath = join(process.cwd(), 'src', 'data', 'deals.json');
        await writeFile(dealsPath, JSON.stringify(result, null, 2));
        console.log(`Wrote ${result.deals.length} deals to ${dealsPath}`);
      } catch (writeError) {
        console.warn('Could not write deals file:', writeError);
      }
    }

    return NextResponse.json({
      success: true,
      lastCrawled: result.lastCrawled,
      dealsFound: result.deals.length,
      deals: result.deals,
    });
  } catch (error) {
    console.error('Crawl failed:', error);
    return NextResponse.json(
      { error: 'Crawl failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
