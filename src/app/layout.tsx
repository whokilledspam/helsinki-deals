import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Helsinki Deals — Clothing Store Discounts Map',
  description: 'Scout the best clothing store discounts in Helsinki city center. Interactive map showing real-time sales from H&M, Zara, Marimekko, Stockmann, and 40+ more stores.',
  keywords: ['Helsinki', 'deals', 'sale', 'ale', 'clothing', 'fashion', 'discount', 'map'],
  openGraph: {
    title: 'Helsinki Deals — Clothing Store Discounts Map',
    description: 'Find the best clothing deals in Helsinki city center',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
