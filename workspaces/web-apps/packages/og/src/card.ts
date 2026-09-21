// The default-card endpoint every app mounts at /og/default.png: renders the
// site's card and serves it as PNG, keeping the result in the Workers cache so
// a burst of scrapers (every client that unfurls a shared link) rasterizes it
// once per edge location instead of once per request.
import type {OgImageParams, OgRuntime} from './image'
import {createOgRenderer} from './image'

export interface OgCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

export interface OgCardParams extends OgImageParams {
  runtime: OgRuntime
  // Where rendered cards are kept between requests; the Workers Cache API's
  // default cache when the runtime offers one, nothing otherwise.
  cache?: OgCache
}

// `caches.default` is Cloudflare's addition to CacheStorage, absent from the
// standard type and from Node.
const defaultCache = (): OgCache | undefined =>
  (globalThis as {caches?: {default?: OgCache}}).caches?.default

export const ogCard = ({runtime, cache, ...card}: OgCardParams) => {
  const render = createOgRenderer(runtime)
  return async (request: Request): Promise<Response> => {
    const store = cache ?? defaultCache()
    const cached = await store?.match(request)
    if (cached) return cached
    const response = new Response(await render(card), {
      headers: {'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400'},
    })
    await store?.put(request, response.clone())
    return response
  }
}
