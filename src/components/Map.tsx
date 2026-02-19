'use client';

import { useEffect, useState, useMemo } from 'react';
import { StoreWithDeals, StoreCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

interface MapProps {
  stores: StoreWithDeals[];
  selectedCategories: StoreCategory[];
  onStoreClick?: (store: StoreWithDeals) => void;
}

export default function MapView({ stores, selectedCategories, onStoreClick }: MapProps) {
  const [mounted, setMounted] = useState(false);
  const [leafletModules, setLeafletModules] = useState<{
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
    useMap: any;
    L: any;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Import leaflet and react-leaflet only on client
    Promise.all([
      import('leaflet'),
      import('react-leaflet'),
    ]).then(([L, RL]) => {
      // Fix default marker icons
      delete (L.default.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setLeafletModules({
        MapContainer: RL.MapContainer,
        TileLayer: RL.TileLayer,
        Marker: RL.Marker,
        Popup: RL.Popup,
        useMap: RL.useMap,
        L: L.default,
      });
    });
  }, []);

  const filteredStores = stores.filter(
    (store) => selectedCategories.length === 0 || selectedCategories.includes(store.category)
  );

  if (!mounted || !leafletModules) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0f172a', borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
          <svg style={{ height: '2rem', width: '2rem', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span style={{ fontSize: '0.875rem' }}>Loading map...</span>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, L } = leafletModules;

  return (
    <MapContainer
      center={[60.1695, 24.9414]}
      zoom={15}
      style={{ width: '100%', height: '100%', borderRadius: '12px' }}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {filteredStores.map((store) => {
        const hasDeals = store.deals.length > 0;
        const color = CATEGORY_COLORS[store.category];
        const size = hasDeals ? 14 : 10;
        const bgColor = hasDeals ? '#10b981' : color;
        const borderColor = hasDeals ? '#10b981' : color;

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="position:relative;width:${size}px;height:${size}px;">
              ${hasDeals ? `<div class="pulse-dot" style="position:absolute;width:${size + 8}px;height:${size + 8}px;border-radius:50%;background:rgba(16,185,129,0.3);top:-4px;left:-4px;"></div>` : ''}
              <div style="width:${size}px;height:${size}px;border-radius:50%;background:${bgColor};border:2px solid ${borderColor};box-shadow:0 2px 8px rgba(0,0,0,0.4);position:relative;z-index:1;"></div>
            </div>
          `,
          iconSize: [size + 8, size + 8],
          iconAnchor: [(size + 8) / 2, (size + 8) / 2],
          popupAnchor: [0, -(size + 8) / 2],
        });

        return (
          <Marker
            key={store.id}
            position={[store.lat, store.lng]}
            icon={icon}
            eventHandlers={{ click: () => onStoreClick?.(store) }}
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
                      <div key={idx} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '8px' }}>
                        <p style={{ fontSize: '0.875rem', color: '#6ee7b7', fontWeight: 500, margin: 0 }}>
                          {deal.percentage && <span style={{ color: '#34d399', fontWeight: 'bold', marginRight: '4px' }}>{deal.percentage}</span>}
                          {deal.description.slice(0, 100)}
                        </p>
                        <a href={deal.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '4px', display: 'inline-block' }}>View deal →</a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: '#64748b', fontStyle: 'italic' }}>No active deals</p>
                )}
                <a href={store.website} target="_blank" rel="noopener noreferrer" style={{ marginTop: '12px', display: 'inline-block', fontSize: '0.75rem', color: '#60a5fa' }}>Visit website →</a>
              </div>
            </Popup>
          </Marker>
        );
      })}
      <FitBoundsInner stores={filteredStores} L={L} />
    </MapContainer>
  );
}

function FitBoundsInner({ stores, L }: { stores: StoreWithDeals[]; L: any }) {
  // useMap must be imported dynamically too, but we can use it here since
  // this component only renders inside MapContainer which is client-only
  const [useMap, setUseMap] = useState<any>(null);

  useEffect(() => {
    import('react-leaflet').then((RL) => setUseMap(() => RL.useMap));
  }, []);

  if (!useMap) return null;

  return <FitBoundsImpl stores={stores} L={L} useMap={useMap} />;
}

function FitBoundsImpl({ stores, L, useMap }: { stores: StoreWithDeals[]; L: any; useMap: any }) {
  const map = useMap();

  useEffect(() => {
    if (stores.length > 0) {
      const bounds = L.latLngBounds(stores.map((s: StoreWithDeals) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [stores, map, L]);

  return null;
}
