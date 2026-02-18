# 🏷️ Helsinki Deals

> Scout the best clothing store discounts in Helsinki city center — on an interactive map.

![Helsinki Deals](https://img.shields.io/badge/Helsinki-Deals-0072C6?style=for-the-badge&logo=mapbox&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss)

## 📸 Screenshots

<!-- Add screenshots here -->
> *Screenshots coming soon — deploy the app and take some!*

## What is this?

Helsinki Deals is a web app that:

1. **Maps 50+ clothing stores** in Helsinki city center (Keskusta)
2. **Crawls their websites** for active sales, discounts, and promotions
3. **Shows everything on an interactive map** with color-coded markers
4. **Lists all deals** in a searchable sidebar

Perfect for anyone who wants to find the best clothing deals in Helsinki without checking dozens of websites.

### Stores covered

| Category | Stores |
|---|---|
| ⚡ Fast Fashion | H&M, Zara, Monki, Weekday, Mango, Bershka, Pull & Bear, Uniqlo, Reserved, KappAhl, Lindex, Jack & Jones, Vero Moda, New Yorker, Dressmann, Cubus, Volt Fashion |
| 💎 Luxury | Hugo Boss |
| 🇫🇮 Nordic Design | Marimekko, Makia, R-Collection, Ivana Helsinki, Samuji |
| 👔 Mid-range | COS, & Other Stories, ARKET, Filippa K, GANT, Marc O'Polo, Tiger of Sweden, Massimo Dutti, Tommy Hilfiger, Esprit |
| 🛹 Streetwear | Carlings, Superdry, Makia |
| ♻️ Vintage | Beyond Retro, UFF, Relove, Episode, Penny the Store, Segunda Mano |
| 🏃 Sports | Nike, Stadium, Intersport, Peak Performance, XXL Sport |
| 🏬 Department | Stockmann, Sokos |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Run locally

```bash
git clone https://github.com/whokilledspam/helsinki-deals.git
cd helsinki-deals
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run the crawler

Trigger the crawler to find active deals:

```bash
# Via the API route (start the dev server first)
curl http://localhost:3000/api/crawl

# The crawler will:
# 1. Visit each store's website
# 2. Search for sale/discount indicators
# 3. Save results to src/data/deals.json
```

Or click the **"🔄 Crawl Deals"** button in the UI.

## 🔍 How Crawling Works

The crawler (`src/lib/crawler.ts`) does the following for each store:

1. **Fetches the main page** with Finnish language headers
2. **Searches for sale keywords** in both Finnish and English:
   - Finnish: `ale`, `alennus`, `tarjous`, `kampanja`, `loppuunmyynti`
   - English: `sale`, `discount`, `clearance`, `off`, `deal`
3. **Extracts percentage patterns** like `-30%`, `up to 50% off`, `jopa 70%`
4. **Follows sale-specific links** found on the page
5. **Returns structured deal objects** with descriptions, percentages, and URLs

Stores are crawled in batches of 5 with a 1-second delay between batches to be respectful.

### Limitations

- Only works with server-rendered HTML (not JS-rendered SPAs)
- Some stores may block automated requests
- Percentage extraction is heuristic-based
- Sale data is only as fresh as the last crawl

## 🏗️ Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Vercel will auto-detect Next.js settings
4. Deploy!

The `vercel.json` includes a weekly cron job that hits `/api/crawl` every Monday at 6 AM UTC.

To secure the cron endpoint, set a `CRON_SECRET` environment variable in Vercel.

## 🏪 Adding New Stores

Edit `src/data/stores.json` and add a new entry:

```json
{
  "id": "store-name-location",
  "name": "Store Name",
  "address": "Street Address, 00100 Helsinki",
  "website": "https://www.store.com/fi/",
  "lat": 60.1695,
  "lng": 24.9414,
  "category": "fast-fashion"
}
```

### Categories

- `fast-fashion` — H&M, Zara, etc.
- `luxury` — Hugo Boss, etc.
- `vintage` — Second-hand and thrift stores
- `streetwear` — Carlings, Superdry, etc.
- `department-store` — Stockmann, Sokos
- `nordic-design` — Marimekko, Makia, etc.
- `sports` — Nike, Stadium, etc.
- `mid-range` — COS, GANT, Filippa K, etc.
- `accessories` — Bags, shoes, jewelry

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 14](https://nextjs.org/) | React framework (App Router) |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS](https://tailwindcss.com/) | Styling |
| [React Leaflet](https://react-leaflet.js.org/) | Interactive maps |
| [Leaflet](https://leafletjs.com/) | Map library |
| [Cheerio](https://cheerio.js.org/) | HTML parsing for crawler |
| [CARTO Dark](https://carto.com/basemaps/) | Dark map tiles |

## 📁 Project Structure

```
helsinki-deals/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main map view
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Global styles + Leaflet overrides
│   │   └── api/crawl/route.ts    # Crawler API endpoint
│   ├── components/
│   │   ├── Map.tsx               # Interactive Leaflet map
│   │   ├── StoreMarker.tsx       # Individual store markers
│   │   ├── DealsList.tsx         # Sidebar deal cards
│   │   └── FilterBar.tsx         # Category filter pills
│   ├── lib/
│   │   ├── crawler.ts            # Web crawler logic
│   │   ├── stores.ts             # Store data helpers
│   │   └── types.ts              # TypeScript types
│   └── data/
│       ├── stores.json           # Store database (50+ stores)
│       └── deals.json            # Crawled deal results
├── vercel.json                   # Vercel cron config
└── README.md
```

## 📜 License

MIT

---

Built with ❤️ in Helsinki 🇫🇮
