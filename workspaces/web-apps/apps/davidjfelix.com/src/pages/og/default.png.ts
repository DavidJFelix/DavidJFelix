import {ogCard} from '@davidjfelix/og/card'
import {viteRuntime} from '@davidjfelix/og/runtime/vite'
import type {APIRoute} from 'astro'
import {cardTheme, site} from '../../site'

// The only on-demand route besides bugs.ts and diag -- astro.config.mjs
// prerenders every other page in Node (prerenderEnvironment: 'node'), but this
// endpoint has to run in workerd, where the wasm modules load as imported
// modules instead of raw bytes.
export const prerender = false

// The share card every page's og:image points at, rendered on the Worker at
// request time (satori + resvg on wasm) and kept in the edge cache.
const card = ogCard({
  runtime: viteRuntime,
  title: site.title,
  description: site.description,
  siteName: site.siteName,
  theme: cardTheme,
})

export const GET: APIRoute = ({request}) => card(request)
