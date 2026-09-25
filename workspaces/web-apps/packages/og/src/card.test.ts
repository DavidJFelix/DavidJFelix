import {expect, test, vi} from 'vitest'
import type {OgCache} from './card'
import {ogCard, ogCards} from './card'
import type {OgImageParams} from './image'
import {pngSize} from './png'
import {nodeRuntime} from './runtime/node'
import {ogImageSize} from './tags'

const runtime = await nodeRuntime()
const card = {runtime, title: 'startchi.com', description: 'A directory.', siteName: 'startchi.com'}
const request = new Request('https://startchi.com/og/default.png')
const headRequest = new Request(request.url, {method: 'HEAD'})

// Mirrors the Workers Cache API as verified under workerd: entries are keyed
// by GET requests alone -- `put` refuses any other method and `match` never
// finds one -- so a handler that hands the cache a HEAD key fails here the way
// it fails at the edge.
const fakeCache = () => {
  const entries = new Map<string, Response>()
  const cache: OgCache = {
    match: async (key) => (key.method === 'GET' ? entries.get(key.url) : undefined),
    put: async (key, response) => {
      if (key.method !== 'GET') throw new TypeError('Cannot cache response to non-GET request.')
      entries.set(key.url, response)
    },
  }
  return {cache, entries}
}

test('serves the rendered card as a cacheable PNG when no cache exists', async () => {
  const response = await ogCard(card)(request)
  const png = new Uint8Array(await response.arrayBuffer())
  expect(response.headers.get('Content-Type')).toBe('image/png')
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
  expect(response.headers.get('Content-Length')).toBe(String(png.byteLength))
  expect(pngSize(png)).toEqual(ogImageSize)
})

test('stores a miss in the given cache and serves the hit from it afterwards', async () => {
  const {cache, entries} = fakeCache()
  const handler = ogCard({...card, cache})
  const miss = await handler(request)
  expect(entries.size).toBe(1)
  const hit = await handler(request)
  expect(hit).toBe(entries.get(request.url))
  expect(new Uint8Array(await hit.arrayBuffer())).toEqual(new Uint8Array(await miss.arrayBuffer()))
})

test('answers HEAD with the status and headers GET carries and no body', async () => {
  const handler = ogCard(card)
  const png = new Uint8Array(await (await handler(request)).arrayBuffer())
  const head = await handler(headRequest)
  expect(head.status).toBe(200)
  expect(head.headers.get('Content-Type')).toBe('image/png')
  expect(head.headers.get('Cache-Control')).toBe('public, max-age=86400')
  expect(head.headers.get('Content-Length')).toBe(String(png.byteLength))
  expect(head.body).toBeNull()
})

test('a HEAD miss fills the cache under the GET key, so the GET after it is a hit', async () => {
  const {cache, entries} = fakeCache()
  const handler = ogCard({...card, cache})
  const head = await handler(headRequest)
  expect(entries.size).toBe(1)
  const hit = await handler(request)
  expect(hit).toBe(entries.get(request.url))
  expect(head.headers.get('Content-Length')).toBe(hit.headers.get('Content-Length'))
})

test('a HEAD hit is served from the cached GET entry without its body', async () => {
  const {cache, entries} = fakeCache()
  const handler = ogCard({...card, cache})
  await handler(request)
  const head = await handler(headRequest)
  expect(entries.size).toBe(1)
  expect(head.body).toBeNull()
  expect(head.headers.get('Content-Length')).toBe(
    entries.get(request.url)?.headers.get('Content-Length'),
  )
})

// The stub is undone inline rather than in a hook; the vitest API for that
// is spelled as it is. cSpell:ignore unstubAllGlobals
test('uses the Workers default cache when the runtime provides one', async () => {
  const {cache, entries} = fakeCache()
  vi.stubGlobal('caches', {default: cache})
  try {
    await ogCard(card)(request)
    expect(entries.size).toBe(1)
  } finally {
    vi.unstubAllGlobals()
  }
})

// A family of cards: the resolver reads the request, and each URL is its own
// cache entry, so two posts never share a rendering.
test('resolves a card per request and caches each URL on its own', async () => {
  const {cache, entries} = fakeCache()
  const resolve = vi.fn<(incoming: Request) => Promise<OgImageParams>>(async (incoming) => ({
    title: new URL(incoming.url).pathname,
    description: 'One per path',
    siteName: 'djf.io',
  }))
  const handler = ogCards({runtime, cache, maxAge: 3600, card: resolve})
  const first = new Request('https://djf.io/og/blog/first.png')
  const second = new Request('https://djf.io/og/blog/second.png')

  const one = await handler(first)
  const other = await handler(second)
  await handler(first)

  expect(one.headers.get('Cache-Control')).toBe('public, max-age=3600')
  expect(pngSize(new Uint8Array(await one.clone().arrayBuffer()))).toEqual(ogImageSize)
  expect(new Uint8Array(await one.arrayBuffer())).not.toEqual(
    new Uint8Array(await other.arrayBuffer()),
  )
  expect(entries.size).toBe(2)
  expect(resolve).toHaveBeenCalledTimes(2)
})

// A card drawn without the data it asked for should not sit at the edge for
// the handler's whole default; the resolver says how long it is good for.
test('lets a card set its own cache life', async () => {
  const handler = ogCards({
    runtime,
    card: () => ({
      title: 'Without a title',
      description: 'Try again soon',
      siteName: 'djf.io',
      maxAge: 300,
    }),
  })
  const response = await handler(new Request('https://djf.io/og/blog/fallback.png'))
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
  expect(pngSize(new Uint8Array(await response.arrayBuffer()))).toEqual(ogImageSize)
})

// A cached card outlives the deploy that drew it, so the deployed version is
// part of the key: a new version starts from an empty cache instead of serving
// the previous version's cards, and the same version keeps serving its own.
test('keeps each deployed version to its own cache entries', async () => {
  const {cache, entries} = fakeCache()
  const resolve = vi.fn<() => OgImageParams>(() => card)
  const first = ogCards({runtime, cache, version: 'v1', card: resolve})
  const second = ogCards({runtime, cache, version: async () => 'v2', card: resolve})

  await first(request)
  await first(request)
  await second(request)

  expect([...entries.keys()]).toEqual([
    'https://startchi.com/og/default.png?v=v1',
    'https://startchi.com/og/default.png?v=v2',
  ])
  expect(resolve).toHaveBeenCalledTimes(2)
})

test('keys the default card by version as well, and by URL alone without one', async () => {
  const {cache, entries} = fakeCache()
  await ogCard({...card, cache, version: 'v1'})(request)
  await ogCard({...card, cache, version: async () => undefined})(request)

  expect([...entries.keys()]).toEqual(['https://startchi.com/og/default.png?v=v1', request.url])
})

test('answers 404 without caching when the request names no card', async () => {
  const {cache, entries} = fakeCache()
  const handler = ogCards({runtime, cache, card: () => undefined})
  const missing = 'https://djf.io/og/blog/missing.png'
  const response = await handler(new Request(missing))
  expect(response.status).toBe(404)
  expect((await handler(new Request(missing, {method: 'HEAD'}))).status).toBe(404)
  expect(entries.size).toBe(0)
})
