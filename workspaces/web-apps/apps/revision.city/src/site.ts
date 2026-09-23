import type {OgTheme} from '@davidjfelix/og/image'

// What the site says about itself wherever a page or a share card names it.
export const site = {
  // A preview build bakes in its own pr-<N> URL (VITE_PUBLIC_SITE_URL, set by
  // .depot/actions/preview-wrangler) so its absolute tags name the host that
  // serves them; production builds carry the canonical origin.
  origin: import.meta.env.VITE_PUBLIC_SITE_URL || 'https://revision.city',
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
