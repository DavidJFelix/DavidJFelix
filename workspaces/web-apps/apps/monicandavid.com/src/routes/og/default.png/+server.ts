import {ogCard} from '@davidjfelix/og/card'
import {cardTheme, site} from '../../../site'
import type {RequestHandler} from './$types'

// The share card every page's og:image points at, rendered on the Worker at
// request time (satori + resvg on wasm) and kept in the edge cache. The
// runtime is loaded on the first request rather than at import: SvelteKit's
// build loads every route module in Node to read its page options, and Node
// cannot import the wasm modules the runtime carries (vite.config.ts leaves
// them for wrangler's bundler).
let card: Promise<(request: Request) => Promise<Response>> | undefined

const loadCard = () =>
  (card ??= import('@davidjfelix/og/runtime/vite').then(({viteRuntime}) =>
    ogCard({
      runtime: viteRuntime,
      title: site.title,
      description: site.description,
      siteName: site.siteName,
      theme: cardTheme,
    }),
  ))

export const GET: RequestHandler = async ({request}) => (await loadCard())(request)
