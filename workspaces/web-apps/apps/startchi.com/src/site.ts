import type {OgTheme} from '@davidjfelix/og/image'

// What the site says about itself wherever a page or a share card names it.
export const site = {
  // A preview build bakes in its own pr-<N> URL (VITE_PUBLIC_SITE_URL, set by
  // .depot/actions/preview-wrangler) so its absolute tags name the host that
  // serves them; production builds carry the canonical origin.
  origin: import.meta.env.VITE_PUBLIC_SITE_URL || 'https://startchi.com',
  siteName: 'startchi.com',
  title: 'startchi.com',
  description: 'The Chicago and Midwest startup ecosystem: a directory, signal boost, and org hub.',
}

// The share card in the app's dark scheme: bg.canvas, text, and text.muted
// from panda.config.ts (Panda's neutral 950, 100, and 400).
export const cardTheme: OgTheme = {
  background: '#0a0a0a',
  foreground: '#f5f5f5',
  muted: '#a3a3a3',
}
