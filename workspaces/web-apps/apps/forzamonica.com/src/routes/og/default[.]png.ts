import {ogCard} from '@davidjfelix/og/card'
import {viteRuntime} from '@davidjfelix/og/runtime/vite'
import {createFileRoute} from '@tanstack/react-router'
import {cardTheme, site} from '@/site.ts'

// The share card every page's og:image points at, rendered on the Worker at
// request time (satori + resvg on wasm) and kept in the edge cache.
const card = ogCard({
  runtime: viteRuntime,
  title: site.title,
  description: site.description,
  siteName: site.siteName,
  theme: cardTheme,
})

// HEAD is registered beside GET, not left to Start's HEAD-to-GET fallback: the
// handler answers both, so the route says so.
export const Route = createFileRoute('/og/default.png')({
  server: {handlers: {GET: ({request}) => card(request), HEAD: ({request}) => card(request)}},
})
