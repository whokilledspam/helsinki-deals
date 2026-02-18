'use client';

import { StoreCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

interface FilterBarProps {
  categories: StoreCategory[];
  selectedCategories: StoreCategory[];
  onToggleCategory: (category: StoreCategory) => void;
  totalStores: number;
  activeDeals: number;
}

export function FilterBar({
  categories,
  selectedCategories,
  onToggleCategory,
  totalStores,
  activeDeals,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Filter by Category
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{totalStores} stores</span>
          <span className="text-emerald-400 font-medium">{activeDeals} deals</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const isSelected = selectedCategories.includes(category);
          const color = CATEGORY_COLORS[category];
          return (
            <button
              key={category}
              onClick={() => onToggleCategory(category)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isSelected
                  ? 'text-white shadow-lg'
                  : 'text-slate-400 bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:text-slate-300'
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: `${color}20`,
                      borderColor: `${color}60`,
                      color: color,
                    }
                  : undefined
              }
            >
              {CATEGORY_LABELS[category]}
            </button>
          );
        })}
        {selectedCategories.length > 0 && (
          <button
            onClick={() => selectedCategories.forEach(onToggleCategory)}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 transition-all"
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
