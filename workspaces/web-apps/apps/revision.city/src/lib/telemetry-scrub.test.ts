import type {ErrorEvent} from '@sentry/react'
import {expect, test} from 'vitest'
import {scrubSentryEvent, scrubSentrySpan, templateSiteUrl} from './telemetry-scrub'

const ORIGIN = 'https://site.example'
const REPOSITORY_PATH = 'github.com/owner/private-repo/pull/7/files/src/secret.ts'
const DIFF_API_QUERY = '?owner=owner&repo=private-repo&pull=7'

test.each([
  ['viewer path', `/diffs/${REPOSITORY_PATH}`, '/diffs/$path'],
  ['viewer URL', `${ORIGIN}/diffs/${REPOSITORY_PATH}`, `${ORIGIN}/diffs/$path`],
  [
    'viewer URL with a query and a hash',
    `/diffs/${REPOSITORY_PATH}?domain=a#L1`,
    '/diffs/$path?domain=a',
  ],
  ['share-card path', `/og/diffs/${REPOSITORY_PATH}`, '/og/diffs/$path'],
  ['diff API URL', `${ORIGIN}/api/diffs/diff${DIFF_API_QUERY}`, `${ORIGIN}/api/diffs/diff`],
  ['diff API path with a hash', `/api/diffs/diff${DIFF_API_QUERY}#x`, '/api/diffs/diff'],
  ['diffs index', '/diffs/', '/diffs/'],
  ['other path with a hash', '/index?tab=a#top', '/index?tab=a'],
  ['other site URL', `${ORIGIN}/bugs`, `${ORIGIN}/bugs`],
  [
    'external URL',
    `https://github.com/diffs/${REPOSITORY_PATH}`,
    `https://github.com/diffs/${REPOSITORY_PATH}`,
  ],
  [
    'protocol-relative URL',
    `//cdn.example/diffs/${REPOSITORY_PATH}`,
    `//cdn.example/diffs/${REPOSITORY_PATH}`,
  ],
  ['plain text', 'GET site.example', 'GET site.example'],
])('templateSiteUrl: %s', (_name, url, expected) => {
  expect(templateSiteUrl({url, origin: ORIGIN})).toBe(expected)
})

const span = (name: string, attributes: Record<string, unknown>) => ({
  trace_id: 'trace',
  span_id: 'span',
  name,
  start_timestamp: 0,
  status: 'ok' as const,
  is_segment: true,
  attributes,
})

test('scrubSentrySpan templates a page load and drops its path parameters and hash', () => {
  const scrubbed = scrubSentrySpan({
    span: span(`/diffs/${REPOSITORY_PATH}`, {
      'url.full': `${ORIGIN}/diffs/${REPOSITORY_PATH}#L1`,
      'url.path': `/diffs/${REPOSITORY_PATH}`,
      'url.template': '/diffs/$',
      'url.path.parameter._splat': REPOSITORY_PATH,
      'params._splat': REPOSITORY_PATH,
      'url.fragment': 'L1',
      'sentry.op': 'pageload',
    }),
    origin: ORIGIN,
  })
  expect(scrubbed.name).toBe('/diffs/$path')
  expect(scrubbed.attributes).toEqual({
    'url.full': `${ORIGIN}/diffs/$path`,
    'url.path': '/diffs/$path',
    'url.template': '/diffs/$path',
    'sentry.op': 'pageload',
  })
})

test('scrubSentrySpan drops the query of a diff API call and templates attribute objects', () => {
  const scrubbed = scrubSentrySpan({
    span: span('GET site.example', {
      'url.full': `${ORIGIN}/api/diffs/diff${DIFF_API_QUERY}`,
      'url.query': DIFF_API_QUERY,
      'http.query': DIFF_API_QUERY,
      'http.url': {value: `${ORIGIN}/api/diffs/diff${DIFF_API_QUERY}`, type: 'string'},
      'http.response.status_code': 200,
    }),
    origin: ORIGIN,
  })
  expect(scrubbed.name).toBe('GET site.example')
  expect(scrubbed.attributes).toEqual({
    'url.full': `${ORIGIN}/api/diffs/diff`,
    'http.url': {value: `${ORIGIN}/api/diffs/diff`, type: 'string'},
    'http.response.status_code': 200,
  })
})

test('scrubSentrySpan keeps the query of a call that is not to the diff API', () => {
  const scrubbed = scrubSentrySpan({
    span: span('GET github.com', {
      'url.full': 'https://github.com/login?next=a',
      'url.query': '?next=a',
    }),
    origin: ORIGIN,
  })
  expect(scrubbed.attributes).toEqual({
    'url.full': 'https://github.com/login?next=a',
    'url.query': '?next=a',
  })
})

test('scrubSentryEvent templates the transaction, the request and the breadcrumb data', () => {
  const event: ErrorEvent = {
    type: undefined,
    transaction: `/diffs/${REPOSITORY_PATH}`,
    request: {
      url: `${ORIGIN}/diffs/${REPOSITORY_PATH}`,
      headers: {Referer: `${ORIGIN}/diffs/${REPOSITORY_PATH}`, 'User-Agent': 'agent'},
    },
    breadcrumbs: [
      {category: 'navigation', data: {from: '/', to: `/diffs/${REPOSITORY_PATH}`}},
      {category: 'fetch', data: {url: `/api/diffs/diff${DIFF_API_QUERY}`, status_code: 200}},
      {category: 'console', message: 'no data'},
    ],
  }
  expect(scrubSentryEvent({event, origin: ORIGIN})).toEqual({
    type: undefined,
    transaction: '/diffs/$path',
    request: {
      url: `${ORIGIN}/diffs/$path`,
      headers: {Referer: `${ORIGIN}/diffs/$path`, 'User-Agent': 'agent'},
    },
    breadcrumbs: [
      {category: 'navigation', data: {from: '/', to: '/diffs/$path'}},
      {category: 'fetch', data: {url: '/api/diffs/diff', status_code: 200}},
      {category: 'console', message: 'no data'},
    ],
  })
})

test('scrubSentryEvent leaves an event without a transaction, a request or breadcrumbs', () => {
  const event: ErrorEvent = {type: undefined, message: 'boom'}
  expect(scrubSentryEvent({event, origin: ORIGIN})).toEqual(event)
})

test('scrubSentryEvent leaves a request without a URL or headers', () => {
  const event: ErrorEvent = {type: undefined, request: {method: 'GET'}}
  expect(scrubSentryEvent({event, origin: ORIGIN})).toEqual(event)
})
