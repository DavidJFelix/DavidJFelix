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

const fakeCache = () => {
  const entries = new Map<string, Response>()
  const cache: OgCache = {
    match: async (key) => entries.get(key.url),
    put: async (key, response) => {
      entries.set(key.url, response)
    },
  }
  return {cache, entries}
}

test('serves the rendered card as a cacheable PNG when no cache exists', async () => {
  const response = await ogCard(card)(request)
  expect(response.headers.get('Content-Type')).toBe('image/png')
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
  expect(pngSize(new Uint8Array(await response.arrayBuffer()))).toEqual(ogImageSize)
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

test('answers 404 without caching when the request names no card', async () => {
  const {cache, entries} = fakeCache()
  const handler = ogCards({runtime, cache, card: () => undefined})
  const response = await handler(new Request('https://djf.io/og/blog/missing.png'))
  expect(response.status).toBe(404)
  expect(entries.size).toBe(0)
})
