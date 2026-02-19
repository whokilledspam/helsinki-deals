'use client';

import { useState, useCallback, useMemo } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { DealsList } from '@/components/DealsList';
import MapView from '@/components/Map';
import { StoreWithDeals, StoreCategory, CrawlResult } from '@/lib/types';
import storesData from '@/data/stores.json';
import dealsData from '@/data/deals.json';

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
                  : 'bg-[#0072C6] hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              }`}
            >
              {isCrawling ? '⏳ Crawling...' : '🔄 Crawl Deals'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full">
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

      <footer className="px-4 py-3 text-center border-t border-slate-800/50">
        <p className="text-xs text-slate-600">
          Helsinki Deals — Open source clothing discount scout •{' '}
          <a href="https://github.com/whokilledspam/helsinki-deals" className="text-slate-500 hover:text-slate-400" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </main>
  );
}
