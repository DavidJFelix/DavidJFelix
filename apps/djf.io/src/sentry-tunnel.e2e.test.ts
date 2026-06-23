import {expect, test} from '@playwright/test'
import {SENTRY_TUNNEL_ROUTE} from './lib/sentry-tunnel'

// Exercises the deployed worker's tunnel route end to end (local `wrangler dev`
// boot and the per-PR preview worker alike). Every case is rejected before the
// upstream forward, so the suite never touches Sentry -- deterministic and
// secret-free, the same bar as the rest of the e2e suite.

test('the tunnel route rejects non-POST methods with 405', async ({request}) => {
  const response = await request.get(SENTRY_TUNNEL_ROUTE)
  expect(response.status()).toBe(405)
  expect(response.headers().allow).toBe('POST')
})

test('the tunnel route rejects an envelope with no DSN with 400', async ({request}) => {
  const response = await request.post(SENTRY_TUNNEL_ROUTE, {
    headers: {'content-type': 'application/x-sentry-envelope'},
    data: `${JSON.stringify({event_id: 'no-dsn'})}\n`,
  })
  expect(response.status()).toBe(400)
})

test('the tunnel route rejects a non-Sentry DSN host with 400', async ({request}) => {
  const response = await request.post(SENTRY_TUNNEL_ROUTE, {
    headers: {'content-type': 'application/x-sentry-envelope'},
    data: `${JSON.stringify({dsn: 'https://key@evil.example/1'})}\n`,
  })
  expect(response.status()).toBe(400)
})
