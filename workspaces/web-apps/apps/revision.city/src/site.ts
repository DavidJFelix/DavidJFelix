import type {OgTheme} from '@davidjfelix/og/image'

// What the site says about itself wherever a page or a share card names it.
export const site = {
  origin: 'https://revision.city',
  siteName: 'revision.city',
  title: 'revision.city',
  description: 'Version control, centered on review.',
}

// The share card in the diffs dark scheme: background, foreground, and
// muted-foreground from src/diffs/diffs.css (oklch(0.145 0 0), oklch(0.985 0
// 0), oklch(0.708 0 0)).
export const cardTheme: OgTheme = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  muted: '#a3a3a3',
}
