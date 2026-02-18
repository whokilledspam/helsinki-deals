import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'helsinki-blue': '#0072C6',
        'helsinki-dark': '#1a1a2e',
        'deal-green': '#10b981',
        'deal-red': '#ef4444',
      },
    },
  },
  plugins: [],
}
export default config
