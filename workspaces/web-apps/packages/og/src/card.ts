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

// The deployed version rendering the cards, when the runtime knows it (on
// Workers, the version metadata binding's id), or a function that resolves
// it per request. A cached card outlives the deploy that drew it, so each
// version keeps its own entries and a deploy never serves the cards of the
// one before it. Without a version, a card stays at the edge for its whole
// cache life, across deploys.
export type OgCardVersion =
  | string
  | undefined
  | (() => string | undefined | Promise<string | undefined>)

export interface OgResolvedCard extends OgImageParams {
  // How long this card stays cacheable, in seconds, when the resolver knows
  // better than the handler's default: a card drawn without the data it asked
  // for keeps a short life, so the next scraper gets another try at it.
  maxAge?: number
}

export interface OgCardsParams {
  runtime: OgRuntime
  // Where rendered cards are kept between requests; the Workers Cache API's
  // default cache when the runtime offers one, nothing otherwise.
  cache?: OgCache
  version?: OgCardVersion
  // How long a rendered card stays cacheable, in seconds; a day when omitted.
  maxAge?: number
  // The card a request names, or undefined when it names none, which answers
  // 404 and is never cached.
  card: (request: Request) => OgResolvedCard | undefined | Promise<OgResolvedCard | undefined>
}

export interface OgCardParams extends OgImageParams {
  runtime: OgRuntime
  cache?: OgCache
  version?: OgCardVersion
}

// `caches.default` is Cloudflare's addition to CacheStorage, absent from the
// standard type and from Node.
const defaultCache = (): OgCache | undefined =>
  (globalThis as {caches?: {default?: OgCache}}).caches?.default

// The cache keys on a GET request for the URL alone, whatever the incoming
// method: the Workers Cache API refuses any other method (`put` throws,
// `match` never finds one), so a HEAD reads and fills the entry its GET would.
// The version rides in a query parameter no route reads; the request itself
// is answered as it was asked.
const cacheKey = (request: Request, version: string | undefined): Request => {
  const url = new URL(request.url)
  if (version) url.searchParams.set('v', version)
  return new Request(url.href)
}

// A HEAD answers with GET's status and headers, Content-Length included, and
// no body; the frameworks that forward HEAD to the GET handler leave that to
// the handler.
const respond = (request: Request, response: Response): Response =>
  request.method === 'HEAD' ? new Response(null, response) : response

export const ogCards = ({runtime, cache, version, maxAge = DAY_SECONDS, card}: OgCardsParams) => {
  const render = createOgRenderer(runtime)
  return async (request: Request): Promise<Response> => {
    const store = cache ?? defaultCache()
    const key = cacheKey(request, typeof version === 'function' ? await version() : version)
    const cached = await store?.match(key)
    if (cached) return respond(request, cached)
    const resolved = await card(request)
    if (!resolved) return new Response(null, {status: 404})
    const {maxAge: cardMaxAge = maxAge, ...params} = resolved
    const png = await render(params)
    const response = new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.byteLength),
        'Cache-Control': `public, max-age=${cardMaxAge}`,
      },
    })
    await store?.put(key, response.clone())
    return respond(request, response)
  }
}

export const ogCard = ({runtime, cache, version, ...card}: OgCardParams) =>
  ogCards({runtime, cache, version, card: () => card})
