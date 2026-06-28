import {expect, test} from 'vitest'
import {INGEST_PREFIX, postHogUpstream} from './posthog-proxy'

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
