import {expect, test, vi} from 'vitest'
import type {OgCache} from './card'
import {ogCard} from './card'
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
