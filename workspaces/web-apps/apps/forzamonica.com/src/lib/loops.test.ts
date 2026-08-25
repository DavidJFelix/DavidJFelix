import {expect, test, vi} from 'vitest'
import {createLoopsContact} from './loops'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const API_KEY = 'test-api-key'

const stubFetch = (response: Response) => vi.fn<FetchLike>(() => Promise.resolve(response))

test('creates the contact with the bearer key and a source tag', async () => {
  const fetchImpl = stubFetch(new Response('{"success":true,"id":"c1"}', {status: 200}))
  const subscribed = await createLoopsContact(
    {email: 'monica@example.com', apiKey: API_KEY},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(true)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const [url, init] = fetchImpl.mock.calls[0]
  expect(url).toBe('https://app.loops.so/api/v1/contacts/create')
  expect(init?.method).toBe('POST')
  expect(init?.headers).toEqual({
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  })
  // BACKLOG(david) bruhj
  // oxlint-disable-next-line typescript/no-base-to-string -- already f'd
  expect(JSON.parse(String(init?.body))).toEqual({
    email: 'monica@example.com',
    source: 'forzamonica.com landing',
  })
})

test('treats an already-subscribed contact (409) as on the list', async () => {
  const fetchImpl = stubFetch(new Response('{"success":false}', {status: 409}))
  const subscribed = await createLoopsContact(
    {email: 'monica@example.com', apiKey: API_KEY},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(true)
})

test('resolves false when the API rejects the request', async () => {
  const fetchImpl = stubFetch(new Response('{"success":false}', {status: 401}))
  const subscribed = await createLoopsContact(
    {email: 'monica@example.com', apiKey: API_KEY},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(false)
})

test('resolves false when the network fails', async () => {
  const fetchImpl = vi.fn<FetchLike>(() => Promise.reject(new TypeError('network down')))
  const subscribed = await createLoopsContact(
    {email: 'monica@example.com', apiKey: API_KEY},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(false)
})

test('resolves false without fetching when no API key is configured', async () => {
  const fetchImpl = stubFetch(new Response('{"success":true}', {status: 200}))
  const subscribed = await createLoopsContact(
    {email: 'monica@example.com', apiKey: undefined},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(false)
  expect(fetchImpl).not.toHaveBeenCalled()
})
