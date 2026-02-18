'use client';

import { StoreWithDeals, CATEGORY_LABELS, CATEGORY_COLORS, StoreCategory } from '@/lib/types';

interface DealsListProps {
  stores: StoreWithDeals[];
  selectedCategories: StoreCategory[];
  lastCrawled: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function DealsList({
  stores,
  selectedCategories,
  lastCrawled,
  isCollapsed,
  onToggleCollapse,
}: DealsListProps) {
  const filteredStores = stores.filter(
    (store) =>
      store.deals.length > 0 &&
      (selectedCategories.length === 0 || selectedCategories.includes(store.category))
  );

  const allStoresFiltered = stores.filter(
    (store) =>
      selectedCategories.length === 0 || selectedCategories.includes(store.category)
  );

  const storesWithoutDeals = allStoresFiltered.filter((s) => s.deals.length === 0);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fi-FI', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className={`bottom-sheet ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Handle bar for mobile */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex justify-center py-2 md:hidden"
        aria-label="Toggle deals panel"
      >
        <div className="w-10 h-1 bg-slate-600 rounded-full" />
      </button>

      {/* Header */}
      <div className="px-4 pb-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🔥 Active Deals
            {filteredStores.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold">
                {filteredStores.length}
              </span>
            )}
          </h2>
          <span className="text-xs text-slate-500">
            Updated: {formatDate(lastCrawled)}
          </span>
        </div>
      </div>

      {/* Deals list */}
      <div className="overflow-y-auto max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-320px)]">
        {filteredStores.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-slate-500 text-sm">
              No active deals found.
            </p>
            <p className="text-slate-600 text-xs mt-1">
              Try running the crawler to find fresh deals.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredStores.map((store) => (
              <div
                key={store.id}
                className="deal-card bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      {store.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {store.address}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[store.category]}15`,
                      borderColor: `${CATEGORY_COLORS[store.category]}40`,
                      color: CATEGORY_COLORS[store.category],
                    }}
                  >
                    {CATEGORY_LABELS[store.category]}
                  </span>
                </div>

                {store.deals.map((deal, idx) => (
                  <div
                    key={idx}
                    className="mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-2">
                      {deal.percentage && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold whitespace-nowrap">
                          {deal.percentage}
                        </span>
                      )}
                      <p className="text-sm text-slate-300 leading-snug">
                        {deal.description.slice(0, 150)}
                      </p>
                    </div>
                    <a
                      href={deal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View deal
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Stores without deals */}
        {storesWithoutDeals.length > 0 && (
          <div className="px-4 pb-4">
            <details className="group">
              <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-500 py-2">
                {storesWithoutDeals.length} stores without deals
              </summary>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {storesWithoutDeals.map((store) => (
                  <a
                    key={store.id}
                    href={store.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-600 hover:text-slate-400 truncate"
                  >
                    {store.name}
                  </a>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
