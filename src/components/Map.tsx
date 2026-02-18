'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { StoreWithDeals, StoreCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';

// Fix Leaflet default marker icon issue — safe to run client-side only
// since this file is only loaded via dynamic import with ssr: false
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

function createMarkerIcon(hasDeals: boolean, color: string): L.DivIcon {
  const size = hasDeals ? 14 : 10;
  const pulseClass = hasDeals ? 'pulse-dot' : '';
  const borderColor = hasDeals ? '#10b981' : color;
  const bgColor = hasDeals ? '#10b981' : color;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        ${hasDeals ? `<div class="${pulseClass}" style="
          position: absolute;
          width: ${size + 8}px;
          height: ${size + 8}px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.3);
          top: -4px;
          left: -4px;
        "></div>` : ''}
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${bgColor};
          border: 2px solid ${borderColor};
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          position: relative;
          z-index: 1;
        "></div>
      </div>
    `,
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, (size + 8) / 2],
    popupAnchor: [0, -(size + 8) / 2],
  });
}

function StoreMarkerItem({ store, onClick }: { store: StoreWithDeals; onClick?: () => void }) {
  const hasDeals = store.deals.length > 0;
  const color = CATEGORY_COLORS[store.category];
  const icon = useMemo(() => createMarkerIcon(hasDeals, color), [hasDeals, color]);

  return (
    <Marker
      position={[store.lat, store.lng]}
      icon={icon}
      eventHandlers={{ click: () => onClick?.() }}
    >
      <Popup maxWidth={280}>
        <div style={{ minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white', margin: 0 }}>{store.name}</h3>
            {hasDeals && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
                background: 'rgba(16,185,129,0.2)', color: '#34d399',
                border: '1px solid rgba(16,185,129,0.3)'
              }}>
                SALE
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '4px' }}>{store.address}</p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '12px' }}>
            {CATEGORY_LABELS[store.category]}
          </p>

          {hasDeals ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {store.deals.map((deal, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: '8px', padding: '8px'
                  }}
                >
                  <p style={{ fontSize: '0.875rem', color: '#6ee7b7', fontWeight: 500, margin: 0 }}>
                    {deal.percentage && (
                      <span style={{ color: '#34d399', fontWeight: 'bold', marginRight: '4px' }}>
                        {deal.percentage}
                      </span>
                    )}
                    {deal.description.slice(0, 100)}
                  </p>
                  <a
                    href={deal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '4px', display: 'inline-block' }}
                  >
                    View deal →
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#64748b', fontStyle: 'italic' }}>No active deals</p>
          )}

          <a
            href={store.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: '12px', display: 'inline-block', fontSize: '0.75rem', color: '#60a5fa' }}
          >
            Visit website →
          </a>
        </div>
      </Popup>
    </Marker>
  );
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
        <StoreMarkerItem
          key={store.id}
          store={store}
          onClick={() => onStoreClick?.(store)}
        />
      ))}
      <FitBounds stores={filteredStores} />
    </MapContainer>
  );
}
