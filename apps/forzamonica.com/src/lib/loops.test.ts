import {expect, test, vi} from 'vitest'
import {subscribeToLoops} from './loops'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const ENDPOINT = 'https://app.loops.so/api/newsletter-form/test-form-id'

const stubFetch = (response: Response) => vi.fn<FetchLike>(() => Promise.resolve(response))

test('posts the email to the form endpoint as form data', async () => {
  const fetchImpl = stubFetch(new Response('{"success":true}', {status: 200}))
  const subscribed = await subscribeToLoops(
    {email: 'monica@example.com', endpoint: ENDPOINT},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(true)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const [url, init] = fetchImpl.mock.calls[0]
  expect(url).toBe(ENDPOINT)
  expect(init?.method).toBe('POST')
  expect(String(init?.body)).toBe('email=monica%40example.com')
})

test('resolves false when the endpoint rejects the submission', async () => {
  const fetchImpl = stubFetch(new Response('too many requests', {status: 429}))
  const subscribed = await subscribeToLoops(
    {email: 'monica@example.com', endpoint: ENDPOINT},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(false)
})

test('resolves false when the network fails', async () => {
  const fetchImpl = vi.fn<FetchLike>(() => Promise.reject(new TypeError('network down')))
  const subscribed = await subscribeToLoops(
    {email: 'monica@example.com', endpoint: ENDPOINT},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(false)
})

test('resolves false without fetching when no endpoint is configured', async () => {
  const fetchImpl = stubFetch(new Response('{"success":true}', {status: 200}))
  const subscribed = await subscribeToLoops(
    {email: 'monica@example.com', endpoint: null},
    fetchImpl as unknown as typeof fetch,
  )
  expect(subscribed).toBe(false)
  expect(fetchImpl).not.toHaveBeenCalled()
})
