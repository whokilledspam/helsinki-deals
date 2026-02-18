'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FilterBar } from '@/components/FilterBar';
import { DealsList } from '@/components/DealsList';
import { StoreWithDeals, StoreCategory, CrawlResult } from '@/lib/types';
import storesData from '@/data/stores.json';
import dealsData from '@/data/deals.json';

const MapView = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#0f172a', borderRadius: '12px' }}>
      <div className="flex flex-col items-center gap-2" style={{ color: '#64748b' }}>
        <svg className="animate-spin" style={{ height: '2rem', width: '2rem' }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span style={{ fontSize: '0.875rem' }}>Loading map...</span>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const storesWithDeals = useMemo(() => {
    const stores = storesData as StoreWithDeals[];
    const crawlResult = dealsData as CrawlResult;
    return stores.map((store) => ({
      ...store,
      deals: crawlResult.deals.filter((deal) => deal.storeId === store.id),
    }));
  }, []);

  const crawlResult = dealsData as CrawlResult;
  const categories = useMemo(
    () => Array.from(new Set(storesWithDeals.map((s) => s.category))) as StoreCategory[],
    [storesWithDeals]
  );

  const [selectedCategories, setSelectedCategories] = useState<StoreCategory[]>([]);
  const [isDealsCollapsed, setIsDealsCollapsed] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);

  const handleToggleCategory = useCallback((category: StoreCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const handleCrawl = async () => {
    setIsCrawling(true);
    try {
      const response = await fetch('/api/crawl');
      const data = await response.json();
      if (data.success) {
        alert(`Crawl complete! Found ${data.dealsFound} deals. Refresh the page to see updated results.`);
      } else {
        alert('Crawl failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Crawl error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsCrawling(false);
    }
  };

  const activeDeals = crawlResult.deals.length;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 md:px-6 py-4 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white">
              🏷️ Helsinki Deals
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400">
              BETA
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCrawl}
              disabled={isCrawling}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isCrawling
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-[var(--color-helsinki-blue)] hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              }`}
            >
              {isCrawling ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin" style={{ height: '1rem', width: '1rem' }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Crawling...
                </span>
              ) : (
                '🔄 Crawl Deals'
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full">
        {/* Map + Filters */}
        <div className="flex-1 flex flex-col p-4 md:p-6 gap-4">
          <FilterBar
            categories={categories}
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            totalStores={storesWithDeals.length}
            activeDeals={activeDeals}
          />
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50" style={{ minHeight: '500px' }}>
            <MapView
              stores={storesWithDeals}
              selectedCategories={selectedCategories}
            />
          </div>
        </div>

        {/* Deals Sidebar / Bottom Sheet */}
        <div className="w-full md:w-96 lg:w-[420px] md:border-l border-t md:border-t-0 border-slate-800/50 bg-slate-900/50">
          <DealsList
            stores={storesWithDeals}
            selectedCategories={selectedCategories}
            lastCrawled={crawlResult.lastCrawled}
            isCollapsed={isDealsCollapsed}
            onToggleCollapse={() => setIsDealsCollapsed(!isDealsCollapsed)}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 text-center border-t border-slate-800/50">
        <p className="text-xs text-slate-600">
          Helsinki Deals — Open source clothing discount scout •{' '}
          <a
            href="https://github.com/whokilledspam/helsinki-deals"
            className="text-slate-500 hover:text-slate-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}
