import {expect, test, vi} from 'vitest'

import {findMissingChunk, installMissingChunkReload} from './missing-chunk-reload'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const PAGE_URL = 'https://revision.city/diffs/o/r/pull/1'
const CHUNK_URL = 'https://revision.city/assets/route-abc.js'

const answer = (status: number) => vi.fn<FetchLike>(async () => new Response('x', {status}))

test.each([
  {
    name: 'Chromium',
    message: `Failed to fetch dynamically imported module: ${CHUNK_URL}`,
    missing: CHUNK_URL,
  },
  {
    name: 'Firefox',
    message: `error loading dynamically imported module: ${CHUNK_URL}`,
    missing: CHUNK_URL,
  },
  {
    name: 'Vite for a stylesheet',
    message: 'Unable to preload CSS for /assets/route-abc.css',
    missing: 'https://revision.city/assets/route-abc.css',
  },
])('a chunk that answers 404 is missing, from the $name message', async ({message, missing}) => {
  const fetchImpl = answer(404)

  const chunkUrl = await findMissingChunk({
    error: new Error(message),
    pageUrl: PAGE_URL,
    fetch: fetchImpl,
  })

  expect(chunkUrl).toBe(missing)
  expect(fetchImpl).toHaveBeenCalledWith(missing, expect.objectContaining({cache: 'no-store'}))
})

test.each([
  {name: 'a chunk that answers 200', error: new Error(`Failed: ${CHUNK_URL}`), status: 200},
  {
    name: 'a message with no URL',
    error: new Error('Importing a module script failed.'),
    status: 404,
  },
  {name: 'an error that is not an Error', error: 'failed', status: 404},
  {
    name: 'a chunk on another origin',
    error: new Error('Failed: https://cdn.example.test/assets/a.js'),
    status: 404,
  },
])('$name is not missing', async ({error, status}) => {
  const chunkUrl = await findMissingChunk({error, pageUrl: PAGE_URL, fetch: answer(status)})

  expect(chunkUrl).toBeUndefined()
})

test('a check that fails with a network error does not call the chunk missing', async () => {
  const fetchImpl = vi.fn<FetchLike>(async () => {
    throw new TypeError('Failed to fetch')
  })

  const chunkUrl = await findMissingChunk({
    error: new Error(`Failed: ${CHUNK_URL}`),
    pageUrl: PAGE_URL,
    fetch: fetchImpl,
  })

  expect(chunkUrl).toBeUndefined()
})

const preloadError = (message: string): Event =>
  Object.assign(new Event('vite:preloadError', {cancelable: true}), {payload: new Error(message)})

test.each([
  {name: 'reloads the page once for a missing chunk', status: 404, reloads: 1},
  {name: 'does not reload the page for a chunk the server has', status: 200, reloads: 0},
])('a preload error $name', async ({status, reloads}) => {
  sessionStorage.clear()
  const target = new EventTarget()
  const reload = vi.fn<() => void>()
  installMissingChunkReload({target, page: {href: PAGE_URL, reload}, fetch: answer(status)})

  target.dispatchEvent(preloadError(`Failed: ${CHUNK_URL}`))
  target.dispatchEvent(preloadError(`Failed: ${CHUNK_URL}`))

  await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(reloads))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(reload).toHaveBeenCalledTimes(reloads)
  sessionStorage.clear()
})
