import { NextResponse } from 'next/server';
import { crawlAllStores } from '@/lib/crawler';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('Starting crawl...');
    const result = await crawlAllStores();

    return NextResponse.json({
      success: true,
      lastCrawled: result.lastCrawled,
      dealsFound: result.deals.length,
      deals: result.deals,
      note: 'Deals found but cannot persist on Vercel (read-only filesystem). Use GitHub Actions workflow to update deals.json permanently.',
    });
  } catch (error) {
    console.error('Crawl failed:', error);
    return NextResponse.json(
      { error: 'Crawl failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
