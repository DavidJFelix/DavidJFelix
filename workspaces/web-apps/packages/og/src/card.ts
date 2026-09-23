// The card endpoints apps mount under /og. `ogCard` is the default card every
// app serves at /og/default.png; `ogCards` serves a family of cards resolved
// per request (one per post, one per diff). Both render on the Worker at
// request time and keep the PNG in the Workers cache, so a burst of scrapers
// (every client that unfurls a shared link) rasterizes a card once per edge
// location instead of once per request.
import type {OgImageParams, OgRuntime} from './image'
import {createOgRenderer} from './image'

export interface OgCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

const DAY_SECONDS = 86_400

export interface OgCardsParams {
  runtime: OgRuntime
  // Where rendered cards are kept between requests; the Workers Cache API's
  // default cache when the runtime offers one, nothing otherwise.
  cache?: OgCache
  // How long a rendered card stays cacheable, in seconds; a day when omitted.
  maxAge?: number
  // The card a request names, or undefined when it names none, which answers
  // 404 and is never cached.
  card: (request: Request) => OgImageParams | undefined | Promise<OgImageParams | undefined>
}

export interface OgCardParams extends OgImageParams {
  runtime: OgRuntime
  cache?: OgCache
}

// `caches.default` is Cloudflare's addition to CacheStorage, absent from the
// standard type and from Node.
const defaultCache = (): OgCache | undefined =>
  (globalThis as {caches?: {default?: OgCache}}).caches?.default

export const ogCards = ({runtime, cache, maxAge = DAY_SECONDS, card}: OgCardsParams) => {
  const render = createOgRenderer(runtime)
  return async (request: Request): Promise<Response> => {
    const store = cache ?? defaultCache()
    const cached = await store?.match(request)
    if (cached) return cached
    const params = await card(request)
    if (!params) return new Response(null, {status: 404})
    const response = new Response(await render(params), {
      headers: {'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${maxAge}`},
    })
    await store?.put(request, response.clone())
    return response
  }
}

export const ogCard = ({runtime, cache, ...card}: OgCardParams) =>
  ogCards({runtime, cache, card: () => card})
