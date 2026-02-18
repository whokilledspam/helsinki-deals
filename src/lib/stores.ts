import storesData from '@/data/stores.json';
import dealsData from '@/data/deals.json';
import { Store, Deal, CrawlResult, StoreWithDeals, StoreCategory } from './types';

export function getStores(): Store[] {
  return storesData as Store[];
}

export function getDeals(): CrawlResult {
  return dealsData as CrawlResult;
}

export function getStoresWithDeals(): StoreWithDeals[] {
  const stores = getStores();
  const { deals } = getDeals();

  return stores.map((store) => ({
    ...store,
    deals: deals.filter((deal) => deal.storeId === store.id),
  }));
}

export function getCategories(): StoreCategory[] {
  const stores = getStores();
  const categories = new Set(stores.map((s) => s.category));
  return Array.from(categories) as StoreCategory[];
}

export function getActiveDealsCount(): number {
  const { deals } = getDeals();
  return deals.length;
}
