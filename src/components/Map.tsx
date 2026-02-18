'use client';

import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { StoreMarker } from './StoreMarker';
import { StoreWithDeals, StoreCategory } from '@/lib/types';
import { useEffect } from 'react';
import L from 'leaflet';

// Fix Leaflet default marker icon issue with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const HELSINKI_CENTER: [number, number] = [60.1695, 24.9414];
const DEFAULT_ZOOM = 15;

interface MapProps {
  stores: StoreWithDeals[];
  selectedCategories: StoreCategory[];
  onStoreClick?: (store: StoreWithDeals) => void;
}

function FitBounds({ stores }: { stores: StoreWithDeals[] }) {
  const map = useMap();

  useEffect(() => {
    if (stores.length > 0) {
      const bounds = L.latLngBounds(stores.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [stores, map]);

  return null;
}

export default function MapView({ stores, selectedCategories, onStoreClick }: MapProps) {
  const filteredStores = stores.filter(
    (store) => selectedCategories.length === 0 || selectedCategories.includes(store.category)
  );

  return (
    <MapContainer
      center={HELSINKI_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ width: '100%', height: '100%', borderRadius: '12px' }}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {filteredStores.map((store) => (
        <StoreMarker
          key={store.id}
          store={store}
          onClick={() => onStoreClick?.(store)}
        />
      ))}
      <FitBounds stores={filteredStores} />
    </MapContainer>
  );
}
