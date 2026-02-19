'use client';

import { useEffect, useRef, useState } from 'react';
import { StoreWithDeals, StoreCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

interface MapProps {
  stores: StoreWithDeals[];
  selectedCategories: StoreCategory[];
}

export default function MapView({ stores, selectedCategories }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  const filteredStores = stores.filter(
    (store) => selectedCategories.length === 0 || selectedCategories.includes(store.category)
  );

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      // Fix default icons
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center: [60.1695, 24.9414],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      mapInstanceRef.current = map;
      (window as any).__leaflet = L;
      setReady(true);

      return () => {
        map.remove();
        mapInstanceRef.current = null;
      };
    });
  }, []);

  // Update markers when stores/filters change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).__leaflet;
    if (!map || !L || !ready) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add new markers
    filteredStores.forEach((store) => {
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

      const popupContent = buildPopupHTML(store, hasDeals);

      const marker = L.marker([store.lat, store.lng], { icon })
        .bindPopup(popupContent, { maxWidth: 280 })
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (filteredStores.length > 0) {
      const bounds = L.latLngBounds(filteredStores.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [filteredStores, ready]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0f172a', borderRadius: '12px', zIndex: 10
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
            <svg style={{ height: '2rem', width: '2rem', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span style={{ fontSize: '0.875rem' }}>Loading map...</span>
          </div>
        </div>
      )}
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
    </div>
  );
}

function buildPopupHTML(store: StoreWithDeals, hasDeals: boolean): string {
  const categoryLabel = CATEGORY_LABELS[store.category];
  const dealsHTML = hasDeals
    ? store.deals.map((deal) => `
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:8px;margin-top:6px;">
          <p style="font-size:0.875rem;color:#6ee7b7;font-weight:500;margin:0;">
            ${deal.percentage ? `<span style="color:#34d399;font-weight:bold;margin-right:4px;">${deal.percentage}</span>` : ''}
            ${escapeHTML(deal.description.slice(0, 100))}
          </p>
          <a href="${escapeHTML(deal.url)}" target="_blank" rel="noopener noreferrer" style="font-size:0.75rem;color:#60a5fa;margin-top:4px;display:inline-block;">View deal →</a>
        </div>
      `).join('')
    : '<p style="font-size:0.875rem;color:#64748b;font-style:italic;">No active deals</p>';

  return `
    <div style="min-width:200px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <h3 style="font-weight:bold;font-size:1rem;color:white;margin:0;">${escapeHTML(store.name)}</h3>
        ${hasDeals ? '<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:0.75rem;font-weight:500;background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.3);">SALE</span>' : ''}
      </div>
      <p style="font-size:0.875rem;color:#94a3b8;margin-bottom:4px;">${escapeHTML(store.address)}</p>
      <p style="font-size:0.75rem;color:#64748b;margin-bottom:12px;">${escapeHTML(categoryLabel)}</p>
      ${dealsHTML}
      <a href="${escapeHTML(store.website)}" target="_blank" rel="noopener noreferrer" style="margin-top:12px;display:inline-block;font-size:0.75rem;color:#60a5fa;">Visit website →</a>
    </div>
  `;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
