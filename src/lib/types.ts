export interface Store {
  id: string;
  name: string;
  address: string;
  website: string;
  lat: number;
  lng: number;
  category: StoreCategory;
}

export type StoreCategory =
  | 'fast-fashion'
  | 'luxury'
  | 'vintage'
  | 'streetwear'
  | 'department-store'
  | 'nordic-design'
  | 'sports'
  | 'mid-range'
  | 'accessories';

export interface Deal {
  storeId: string;
  description: string;
  percentage?: string;
  url: string;
  foundAt: string; // ISO timestamp
}

export interface CrawlResult {
  lastCrawled: string; // ISO timestamp
  deals: Deal[];
}

export interface StoreWithDeals extends Store {
  deals: Deal[];
}

export const CATEGORY_LABELS: Record<StoreCategory, string> = {
  'fast-fashion': '⚡ Fast Fashion',
  'luxury': '💎 Luxury',
  'vintage': '♻️ Vintage & Second-hand',
  'streetwear': '🛹 Streetwear',
  'department-store': '🏬 Department Store',
  'nordic-design': '🇫🇮 Nordic Design',
  'sports': '🏃 Sports & Outdoor',
  'mid-range': '👔 Mid-range',
  'accessories': '👜 Accessories',
};

export const CATEGORY_COLORS: Record<StoreCategory, string> = {
  'fast-fashion': '#f59e0b',
  'luxury': '#8b5cf6',
  'vintage': '#10b981',
  'streetwear': '#ef4444',
  'department-store': '#3b82f6',
  'nordic-design': '#06b6d4',
  'sports': '#f97316',
  'mid-range': '#6366f1',
  'accessories': '#ec4899',
};
