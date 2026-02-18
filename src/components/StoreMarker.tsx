'use client';

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { StoreWithDeals, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

interface StoreMarkerProps {
  store: StoreWithDeals;
  onClick?: () => void;
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

export function StoreMarker({ store, onClick }: StoreMarkerProps) {
  const hasDeals = store.deals.length > 0;
  const color = CATEGORY_COLORS[store.category];
  const icon = createMarkerIcon(hasDeals, color);

  return (
    <Marker
      position={[store.lat, store.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onClick?.(),
      }}
    >
      <Popup maxWidth={280}>
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-base text-white">{store.name}</h3>
            {hasDeals && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                SALE
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-1">{store.address}</p>
          <p className="text-xs text-slate-500 mb-3">
            {CATEGORY_LABELS[store.category]}
          </p>

          {hasDeals ? (
            <div className="space-y-2">
              {store.deals.map((deal, idx) => (
                <div
                  key={idx}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2"
                >
                  <p className="text-sm text-emerald-300 font-medium">
                    {deal.percentage && (
                      <span className="text-emerald-400 font-bold mr-1">
                        {deal.percentage}
                      </span>
                    )}
                    {deal.description.slice(0, 100)}
                  </p>
                  <a
                    href={deal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                  >
                    View deal →
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No active deals</p>
          )}

          <a
            href={store.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300"
          >
            Visit website →
          </a>
        </div>
      </Popup>
    </Marker>
  );
}
