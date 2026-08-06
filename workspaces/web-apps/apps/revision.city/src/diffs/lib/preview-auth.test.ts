import {expect, test} from 'vitest'

import {
  decodeProxyState,
  encodeProxyState,
  isPreviewHost,
  parseProxyCallbackURL,
  shouldProxySignIn,
} from './preview-auth'

const DEV_WORKER = 'https://revision-city-dev.nullserve.workers.dev'
const PREVIEW = 'pr-40-revision-city-dev.nullserve.workers.dev'
const PREVIEW_CALLBACK = `https://${PREVIEW}/api/auth/github/callback`

test.each([
  ['a per-PR preview of the dev worker', PREVIEW, true],
  ['a preview of another worker', 'pr-7-djf-io.nullserve.workers.dev', true],
  ['the dev worker itself', 'revision-city-dev.nullserve.workers.dev', false],
  ['production', 'revision.city', false],
  ['a look-alike suffix', `${PREVIEW}.evil.com`, false],
  ['a look-alike prefix', `evil-${PREVIEW}`, false],
  ['a non-numeric PR number', 'pr-abc-revision-city-dev.nullserve.workers.dev', false],
])('recognizes %s as a preview host: %s', (_case, hostname, expected) => {
  expect(isPreviewHost(hostname)).toBe(expected)
})

test.each([
  ['another site entirely', 'https://evil.example.com/api/auth/github/callback'],
  ['a look-alike host', `https://${PREVIEW}.evil.com/api/auth/github/callback`],
  ['plain http', `http://${PREVIEW}/api/auth/github/callback`],
  ['the dev worker itself', `${DEV_WORKER}/api/auth/github/callback`],
  ['some other path on a real preview', `https://${PREVIEW}/api/diffs/entity-diff`],
  ['not a URL at all', PREVIEW],
  ['an empty value', ''],
  ['nothing', null],
])('refuses to forward a code to %s', (_case, value) => {
  expect(parseProxyCallbackURL(value)).toBeUndefined()
})

test('accepts a preview callback and strips everything but host and path', () => {
  expect(parseProxyCallbackURL(`https://user:pw@${PREVIEW}:443/api/auth/github/callback?a=1`)).toBe(
    PREVIEW_CALLBACK,
  )
})

test('carries the csrf and target through a round trip', () => {
  const encoded = encodeProxyState({csrf: 'csrf-value', proxyAuthTo: PREVIEW_CALLBACK})

  expect(decodeProxyState(encoded)).toEqual({csrf: 'csrf-value', proxyAuthTo: PREVIEW_CALLBACK})
})

test.each([
  ['an ordinary sign-in state', crypto.randomUUID()],
  ['base64 that is not JSON', btoa('not json at all')],
  ['JSON with no target', btoa(JSON.stringify({csrf: 'only-csrf'}))],
  ['JSON with no csrf', btoa(JSON.stringify({proxyAuthTo: PREVIEW_CALLBACK}))],
  ['an empty value', ''],
  ['nothing', null],
])('reads %s as not a proxied sign-in', (_case, value) => {
  expect(decodeProxyState(value)).toBeUndefined()
})

test.each([
  {
    case: 'a preview with a dev worker configured',
    url: `https://${PREVIEW}/api/auth/github/login`,
    config: {proxyURL: DEV_WORKER},
    expected: true,
  },
  {
    case: 'the dev worker itself, which runs its own OAuth',
    url: `${DEV_WORKER}/api/auth/github/login`,
    config: {proxyURL: DEV_WORKER},
    expected: false,
  },
  {
    case: 'production',
    url: 'https://revision.city/api/auth/github/login',
    config: {proxyURL: DEV_WORKER},
    expected: false,
  },
  {
    case: 'a preview with nothing configured',
    url: `https://${PREVIEW}/api/auth/github/login`,
    config: {},
    expected: false,
  },
])('proxies sign-in for $case: $expected', ({url, config, expected}) => {
  expect(shouldProxySignIn(new URL(url), config)).toBe(expected)
})
