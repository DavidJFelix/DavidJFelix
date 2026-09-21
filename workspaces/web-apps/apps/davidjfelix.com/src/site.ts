import type {OgTheme} from '@davidjfelix/og/image'

// What the site says about itself wherever a page or a share card names it.
export const site = {
  origin: 'https://davidjfelix.com',
  siteName: 'davidjfelix.com',
  title: 'David J. Felix',
  description: 'Personal site of David J. Felix.',
}

// The share card in the page's dark scheme: the dark side of --bg, --fg, and
// --muted's light-dark() pairs in src/pages/index.astro.
export const cardTheme: OgTheme = {
  background: '#09090b',
  foreground: '#e4e4e7',
  muted: '#a1a1aa',
}
