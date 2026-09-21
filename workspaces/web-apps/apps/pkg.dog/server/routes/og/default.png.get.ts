import {ogCard} from '@davidjfelix/og/card'
import {nitroRuntime} from '@davidjfelix/og/runtime/nitro'
import {defineEventHandler, toWebRequest} from 'h3'
import {cardTheme, site} from '../../../shared/site'

// The share card every page's og:image points at, rendered on the Worker at
// request time (satori + resvg on wasm) and kept in the edge cache.
const card = ogCard({
  runtime: nitroRuntime,
  title: site.title,
  description: site.description,
  siteName: site.siteName,
  theme: cardTheme,
})

export default defineEventHandler((event) => card(toWebRequest(event)))
