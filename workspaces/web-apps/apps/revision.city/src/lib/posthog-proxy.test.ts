// @vitest-environment node

import {expect, test, vi} from 'vitest'
import {type FetchRequest, INGEST_PREFIX, postHogUpstream, proxyToPostHog} from './posthog-proxy'

test('routes the SDK bundle to the assets host', () => {
  expect(postHogUpstream('/diag/static/array.js')).toEqual({
    host: 'us-assets.i.posthog.com',
    pathname: '/static/array.js',
  })
})

test('routes remote config (/array) to the assets host', () => {
  expect(postHogUpstream('/diag/array/phc_abc/config.js')).toEqual({
    host: 'us-assets.i.posthog.com',
    pathname: '/array/phc_abc/config.js',
  })
})

test('routes event capture to the ingestion host', () => {
  expect(postHogUpstream('/diag/e/')).toEqual({
    host: 'us.i.posthog.com',
    pathname: '/e/',
  })
})

test('routes feature flags to the ingestion host', () => {
  expect(postHogUpstream('/diag/flags/')).toEqual({
    host: 'us.i.posthog.com',
    pathname: '/flags/',
  })
})

test('maps the bare prefix to the ingestion root', () => {
  expect(postHogUpstream(INGEST_PREFIX)).toEqual({
    host: 'us.i.posthog.com',
    pathname: '/',
  })
})

// A fetch stub that records the forwarded request and answers with the given response.
function stubFetch(response: Response = new Response('ok')) {
  return vi.fn<FetchRequest>(() => Promise.resolve(response))
}

function forwardedRequest(fetchImpl: ReturnType<typeof stubFetch>): Request {
  return fetchImpl.mock.calls[0][0]
}

test('forwards a request without the site cookie and with the client IP', async () => {
  const fetchImpl = stubFetch()
  const body = JSON.stringify({event: 'pageview'})
  const request = new Request('http://revision.test/diag/e/?ip=0', {
    method: 'POST',
    body,
    headers: {cookie: 'session=secret', 'CF-Connecting-IP': '203.0.113.7'},
  })
  await proxyToPostHog(request, {fetch: fetchImpl})
  const forwarded = forwardedRequest(fetchImpl)
  expect(forwarded.url).toBe('https://us.i.posthog.com/e/?ip=0')
  expect(forwarded.method).toBe('POST')
  expect(forwarded.headers.get('cookie')).toBeNull()
  expect(forwarded.headers.get('X-Forwarded-For')).toBe('203.0.113.7')
  expect(await forwarded.text()).toBe(body)
})

test('forwards a request with no client IP without an X-Forwarded-For header', async () => {
  const fetchImpl = stubFetch()
  await proxyToPostHog(new Request('http://revision.test/diag/static/array.js'), {
    fetch: fetchImpl,
  })
  const forwarded = forwardedRequest(fetchImpl)
  expect(forwarded.url).toBe('https://us-assets.i.posthog.com/static/array.js')
  expect(forwarded.headers.get('X-Forwarded-For')).toBeNull()
})

test('removes set-cookie from the answer and sets the sandbox policy', async () => {
  const upstream = new Response('{}', {
    status: 202,
    headers: {'set-cookie': 'tracker=1', 'content-type': 'application/json'},
  })
  const response = await proxyToPostHog(new Request('http://revision.test/diag/flags/'), {
    fetch: stubFetch(upstream),
  })
  expect(response.status).toBe(202)
  expect(response.headers.get('set-cookie')).toBeNull()
  expect(response.headers.get('content-type')).toBe('application/json')
  expect(response.headers.get('content-security-policy')).toBe('sandbox')
  expect(await response.text()).toBe('{}')
})

test('returns 504 when the upstream times out', async () => {
  const fetchImpl = vi.fn<FetchRequest>(() =>
    Promise.reject(new DOMException('timed out', 'TimeoutError')),
  )
  const response = await proxyToPostHog(new Request('http://revision.test/diag/e/'), {
    fetch: fetchImpl,
  })
  expect(response.status).toBe(504)
})

test('throws a fetch error that is not a timeout', async () => {
  const error = new TypeError('network down')
  const fetchImpl = vi.fn<FetchRequest>(() => Promise.reject(error))
  await expect(
    proxyToPostHog(new Request('http://revision.test/diag/e/'), {
      fetch: fetchImpl,
    }),
  ).rejects.toBe(error)
})
