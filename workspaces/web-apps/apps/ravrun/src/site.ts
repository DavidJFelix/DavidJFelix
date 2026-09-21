import type {OgTheme} from '@davidjfelix/og/image'

// What the site says about itself wherever a page or a share card names it.
export const site = {
  // rav.run is a registered alias; ravrun.com is the canonical origin (see
  // wrangler.toml routes).
  origin: 'https://ravrun.com',
  siteName: 'ravrun',
  title: 'ravrun — training plan generator',
  description:
    'Tell ravrun your race and current fitness; get a phased, paced training plan you can share as a link and export to your calendar.',
}

// The share card in the app's dark scheme: background, foreground, and muted
// text from src/styles.css (Tailwind gray-900, gray-200, gray-400).
export const cardTheme: OgTheme = {
  background: '#111827',
  foreground: '#e5e7eb',
  muted: '#9ca3af',
}
