import type {ErrorEvent} from '@sentry/react'
import {expect, test} from 'vitest'
import {
  scrubSentryEvent,
  scrubSentrySpan,
  scrubServerBreadcrumb,
  templateSiteUrl,
} from './telemetry-scrub'

const ORIGIN = 'https://site.example'
const REPOSITORY_PATH = 'github.com/owner/private-repo/pull/7/files/src/secret.ts'
const DIFF_API_QUERY = '?owner=owner&repo=private-repo&pull=7'
const GITHUB_API = 'https://api.github.com'
const GITHUB_PATCH_URL = `${GITHUB_API}/repos/owner/private-repo/pulls/7`

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

test('scrubSentrySpan on the server templates a request name and keeps the origin of a call', () => {
  const request = scrubSentrySpan({
    span: span(`GET /diffs/${REPOSITORY_PATH}`, {
      'sentry.segment.name': `GET /diffs/${REPOSITORY_PATH}`,
      'url.full': `${ORIGIN}/diffs/${REPOSITORY_PATH}?domain=a`,
      'url.query': '?domain=a',
    }),
    origin: ORIGIN,
    otherHostUrls: 'origin',
  })
  expect(request.name).toBe('GET /diffs/$path')
  expect(request.attributes).toEqual({
    'sentry.segment.name': 'GET /diffs/$path',
    'url.full': `${ORIGIN}/diffs/$path?domain=a`,
    'url.query': '?domain=a',
  })
  const call = scrubSentrySpan({
    span: span(`GET ${GITHUB_PATCH_URL}`, {
      'url.full': `${GITHUB_PATCH_URL}?per_page=1#x`,
      'url.query': '?per_page=1',
      'url.fragment': 'x',
      'server.address': 'api.github.com',
    }),
    origin: ORIGIN,
    otherHostUrls: 'origin',
  })
  expect(call.name).toBe(`GET ${GITHUB_API}`)
  expect(call.attributes).toEqual({'url.full': GITHUB_API, 'server.address': 'api.github.com'})
})

test('scrubSentrySpan on the server keeps text that only looks like a URL', () => {
  const scrubbed = scrubSentrySpan({
    span: span('GET https://[bad', {'sentry.op': 'http.client'}),
    origin: ORIGIN,
    otherHostUrls: 'origin',
  })
  expect(scrubbed.name).toBe('GET https://[bad')
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

test('scrubSentryEvent on the server templates the transaction and drops a diff API query', () => {
  const event: ErrorEvent = {
    type: undefined,
    transaction: `GET /diffs/${REPOSITORY_PATH}`,
    request: {url: `${ORIGIN}/api/diffs/diff${DIFF_API_QUERY}`, query_string: DIFF_API_QUERY},
    breadcrumbs: [{category: 'fetch', data: {url: GITHUB_PATCH_URL}}],
  }
  expect(scrubSentryEvent({event, origin: ORIGIN, otherHostUrls: 'origin'})).toEqual({
    type: undefined,
    transaction: 'GET /diffs/$path',
    request: {url: `${ORIGIN}/api/diffs/diff`},
    breadcrumbs: [{category: 'fetch', data: {url: GITHUB_API}}],
  })
})

test('scrubSentryEvent keeps the query of a request that is not to the diff API', () => {
  const event: ErrorEvent = {
    type: undefined,
    request: {url: `${ORIGIN}/index?tab=a`, query_string: 'tab=a'},
  }
  expect(scrubSentryEvent({event, origin: ORIGIN})).toEqual(event)
})

test('scrubServerBreadcrumb drops a wide event', () => {
  const breadcrumb = {
    category: 'console',
    level: 'log' as const,
    data: {arguments: [{event: 'webhook delivery', repository: 'owner/private-repo'}]},
  }
  expect(scrubServerBreadcrumb({breadcrumb, origin: ORIGIN})).toBeNull()
})

test('scrubServerBreadcrumb keeps the origin of logged URLs and drops the repository', () => {
  const breadcrumb = {
    category: 'console',
    level: 'warning' as const,
    message: 'diff upstream attempt failed [object Object]',
    data: {
      logger: 'console',
      arguments: [
        'diff upstream attempt failed',
        {
          url: GITHUB_PATCH_URL,
          source: `https://github.com/owner/private-repo/pull/7`,
          viewer: `${ORIGIN}/diffs/${REPOSITORY_PATH}`,
          repository: 'owner/private-repo',
          hold: {until: 1},
          tries: [GITHUB_PATCH_URL],
          status: 503,
        },
      ],
    },
  }
  const scrubbed = {
    url: GITHUB_API,
    source: 'https://github.com',
    viewer: `${ORIGIN}/diffs/$path`,
    hold: {until: 1},
    tries: [GITHUB_API],
    status: 503,
  }
  expect(scrubServerBreadcrumb({breadcrumb, origin: ORIGIN})).toEqual({
    category: 'console',
    level: 'warning',
    message: `diff upstream attempt failed ${JSON.stringify(scrubbed)}`,
    data: {logger: 'console', arguments: ['diff upstream attempt failed', scrubbed]},
  })
})

test('scrubServerBreadcrumb keeps a console breadcrumb without arguments', () => {
  const breadcrumb = {category: 'console', level: 'error' as const}
  expect(scrubServerBreadcrumb({breadcrumb, origin: ORIGIN})).toEqual({
    ...breadcrumb,
    message: '',
    data: {arguments: []},
  })
})

test('scrubServerBreadcrumb keeps the origin of an outgoing call and drops its query', () => {
  const breadcrumb = {
    category: 'fetch',
    type: 'http',
    data: {method: 'GET', url: GITHUB_PATCH_URL, 'url.query': 'q=repo', status_code: 200},
  }
  expect(scrubServerBreadcrumb({breadcrumb, origin: ORIGIN})).toEqual({
    ...breadcrumb,
    data: {method: 'GET', url: GITHUB_API, status_code: 200},
  })
})

test.each([
  ['an HTTP breadcrumb without data', {category: 'fetch', type: 'http'}],
  ['another breadcrumb', {category: 'navigation', data: {to: '/'}}],
])('scrubServerBreadcrumb keeps %s', (_name, breadcrumb) => {
  expect(scrubServerBreadcrumb({breadcrumb, origin: ORIGIN})).toEqual(breadcrumb)
})
