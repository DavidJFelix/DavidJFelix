import type {OgTheme} from '@davidjfelix/og/image'

// What the site says about itself wherever a page or a share card names it.
export const site = {
  origin: 'https://forzamonica.com',
  siteName: 'forzamonica art',
  title: 'forzamonica art',
  description: 'Original watercolors and archival prints by Monica Felix.',
}

// The share card in the shop's light paper scheme: paper, ink, and ink.muted
// from panda.config.ts.
export const cardTheme: OgTheme = {
  background: '#f7f9fa',
  foreground: '#1e2a3a',
  muted: '#5b6a7c',
}
