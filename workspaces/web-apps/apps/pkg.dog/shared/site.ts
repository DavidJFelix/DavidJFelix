import type {OgTheme} from '@davidjfelix/og/image'

// What the site says about itself wherever a page or a server route names it.
// Shared between app/ (OpenGraph meta) and server/ (the /og/default.png card).
export const site = {
  origin: 'https://pkg.dog',
  siteName: 'pkg.dog',
  title: 'pkg.dog',
  description:
    'pkg.dog tree-shakes published packages into their independent parts and republishes them — so updates and vulnerabilities only reach the code you actually import.',
}

// The share card in the app's dark scheme: bg.canvas, text, and text.muted
// from panda.config.ts (Panda's neutral 950, 100, and 400).
export const cardTheme: OgTheme = {
  background: '#0a0a0a',
  foreground: '#f5f5f5',
  muted: '#a3a3a3',
}
