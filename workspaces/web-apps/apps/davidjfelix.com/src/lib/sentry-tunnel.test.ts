import {expect, test, vi} from 'vitest'
import {forwardEnvelope, SENTRY_TUNNEL_ROUTE} from './sentry-tunnel'

// A valid Sentry SaaS DSN and the ingest URL the relay must forward it to.
const DSN = 'https://abc123@o42.ingest.us.sentry.io/789'
const INGEST_URL = 'https://o42.ingest.us.sentry.io/api/789/envelope/'

// The request origin is irrelevant to the relay logic; use a neutral host.
const ORIGIN = 'https://example.test'

// An envelope is NDJSON; the header (first line) carries the DSN when tunneling.
const envelopeWith = (header: Record<string, unknown>): string =>
  `${JSON.stringify(header)}\n{"type":"event"}\n`

const post = (body: string): Request =>
  new Request(`${ORIGIN}${SENTRY_TUNNEL_ROUTE}`, {method: 'POST', body})

// fetch stub that records its call and stands in for a 200 from Sentry ingest.
// fetch by call signature only: lib.dom types `typeof fetch` with a required
// static `preconnect`, which a plain stub cannot (and need not) satisfy.
type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
const stubFetch = () => vi.fn<FetchLike>(async () => new Response('{"id":"evt"}', {status: 200}))

test('rejects non-POST methods with 405 and an Allow header, without forwarding', async () => {
  const fetchImpl = stubFetch()
  const response = await forwardEnvelope(
    new Request(`${ORIGIN}${SENTRY_TUNNEL_ROUTE}`),
    {},
    fetchImpl as unknown as typeof fetch,
  )
  expect(response.status).toBe(405)
  expect(response.headers.get('allow')).toBe('POST')
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('forwards a valid envelope to the project ingest endpoint and returns its response', async () => {
  const fetchImpl = stubFetch()
  const body = envelopeWith({event_id: 'e1', dsn: DSN})
  const response = await forwardEnvelope(post(body), {}, fetchImpl as unknown as typeof fetch)

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledWith(INGEST_URL, {
    method: 'POST',
    body,
    headers: {'content-type': 'application/x-sentry-envelope'},
  })
})

test('forwards a header-only envelope with no trailing newline', async () => {
  const fetchImpl = stubFetch()
  const body = JSON.stringify({dsn: DSN})
  await forwardEnvelope(post(body), {}, fetchImpl as unknown as typeof fetch)
  expect(fetchImpl).toHaveBeenCalledWith(INGEST_URL, expect.objectContaining({body}))
})

test('forwards a non-regional ingest host (no region segment)', async () => {
  const fetchImpl = stubFetch()
  const body = envelopeWith({dsn: 'https://abc@o42.ingest.sentry.io/789'})
  await forwardEnvelope(post(body), {}, fetchImpl as unknown as typeof fetch)
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://o42.ingest.sentry.io/api/789/envelope/',
    expect.anything(),
  )
})

test('rejects an envelope whose header has no DSN with 400', async () => {
  const fetchImpl = stubFetch()
  const response = await forwardEnvelope(
    post(envelopeWith({event_id: 'no-dsn'})),
    {},
    fetchImpl as unknown as typeof fetch,
  )
  expect(response.status).toBe(400)
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('rejects an envelope whose DSN is not a string with 400', async () => {
  const response = await forwardEnvelope(post(envelopeWith({dsn: 42})))
  expect(response.status).toBe(400)
})

test('rejects an envelope with an unparseable header with 400', async () => {
  const response = await forwardEnvelope(post('this is not json\n{}'))
  expect(response.status).toBe(400)
})

test('rejects a header that parses to null with 400', async () => {
  const response = await forwardEnvelope(post('null\n{}'))
  expect(response.status).toBe(400)
})

test('rejects a malformed DSN URL with 400', async () => {
  const response = await forwardEnvelope(post(envelopeWith({dsn: 'not a url'})))
  expect(response.status).toBe(400)
})

test('rejects a non-https DSN with 400', async () => {
  const response = await forwardEnvelope(
    post(envelopeWith({dsn: 'http://abc@o42.ingest.sentry.io/1'})),
  )
  expect(response.status).toBe(400)
})

test('rejects a DSN on a non-Sentry host with 400 (open-proxy guard)', async () => {
  const fetchImpl = stubFetch()
  const response = await forwardEnvelope(
    post(envelopeWith({dsn: 'https://abc@evil.example/1'})),
    {},
    fetchImpl as unknown as typeof fetch,
  )
  expect(response.status).toBe(400)
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('rejects a DSN with a non-numeric project id with 400', async () => {
  const response = await forwardEnvelope(
    post(envelopeWith({dsn: 'https://abc@o42.ingest.sentry.io/x'})),
  )
  expect(response.status).toBe(400)
})

test('forwards when the envelope DSN matches the configured project', async () => {
  const fetchImpl = stubFetch()
  const response = await forwardEnvelope(
    post(envelopeWith({dsn: DSN})),
    {allowedDsn: DSN},
    fetchImpl as unknown as typeof fetch,
  )
  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledWith(INGEST_URL, expect.anything())
})

test('rejects with 403 when the envelope DSN points at a different host', async () => {
  const fetchImpl = stubFetch()
  const response = await forwardEnvelope(
    post(envelopeWith({dsn: 'https://abc@o99.ingest.sentry.io/789'})),
    {allowedDsn: DSN},
    fetchImpl as unknown as typeof fetch,
  )
  expect(response.status).toBe(403)
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('rejects with 403 when the envelope DSN points at a different project', async () => {
  const response = await forwardEnvelope(
    post(envelopeWith({dsn: 'https://abc@o42.ingest.us.sentry.io/111'})),
    {allowedDsn: DSN},
  )
  expect(response.status).toBe(403)
})

test('rejects with 403 when the configured DSN is itself malformed (fails closed)', async () => {
  const response = await forwardEnvelope(post(envelopeWith({dsn: DSN})), {allowedDsn: 'not a url'})
  expect(response.status).toBe(403)
})
