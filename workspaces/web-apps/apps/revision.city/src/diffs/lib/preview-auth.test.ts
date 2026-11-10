import {expect, test} from 'vitest'

import {
  decodeProxyState,
  encodeProxyState,
  isPreviewHost,
  isSignInBroker,
  parseProxyCallbackURL,
  shouldProxySignIn,
} from './preview-auth'

const DEV_WORKER = 'https://revision-city-dev.nullserve.workers.dev'
const PREVIEW = 'pr-40-revision-city-dev.nullserve.workers.dev'
const PREVIEW_CALLBACK = `https://${PREVIEW}/api/auth/github/callback`

const CONFIG = {proxyURL: DEV_WORKER}

test.each([
  ['a per-PR preview of the dev worker', PREVIEW, true],
  ['a preview in upper case', PREVIEW.toUpperCase(), true],
  ['a preview of another worker', 'pr-7-djf-io.nullserve.workers.dev', false],
  ['a preview on another subdomain', 'pr-40-revision-city-dev.other.workers.dev', false],
  [
    'a preview of a worker whose name ends the same',
    'pr-40-x-revision-city-dev.nullserve.workers.dev',
    false,
  ],
  ['the dev worker itself', 'revision-city-dev.nullserve.workers.dev', false],
  ['production', 'revision.city', false],
  ['a look-alike suffix', `${PREVIEW}.evil.com`, false],
  ['a look-alike prefix', `evil-${PREVIEW}`, false],
  ['a non-numeric PR number', 'pr-abc-revision-city-dev.nullserve.workers.dev', false],
])('recognizes %s as a preview host: %s', (_case, hostname, expected) => {
  expect(isPreviewHost({hostname, proxyURL: DEV_WORKER})).toBe(expected)
})

test.each([
  ['no dev worker', undefined],
  ['an empty dev worker', ''],
  ['a dev worker that is not a URL', 'revision-city-dev'],
  ['a dev worker that is not on workers.dev', 'https://revision.city'],
])('recognizes no preview host with %s', (_case, proxyURL) => {
  expect(isPreviewHost({hostname: PREVIEW, proxyURL})).toBe(false)
})

test.each([
  ['another site entirely', 'https://evil.example.com/api/auth/github/callback'],
  ['a look-alike host', `https://${PREVIEW}.evil.com/api/auth/github/callback`],
  [
    'a preview on another subdomain',
    'https://pr-40-revision-city-dev.other.workers.dev/api/auth/github/callback',
  ],
  ['plain http', `http://${PREVIEW}/api/auth/github/callback`],
  ['the dev worker itself', `${DEV_WORKER}/api/auth/github/callback`],
  ['some other path on a real preview', `https://${PREVIEW}/api/diffs/entity-diff`],
  ['not a URL at all', PREVIEW],
  ['an empty value', ''],
  ['nothing', null],
])('refuses to forward a code to %s', (_case, value) => {
  expect(parseProxyCallbackURL(value, CONFIG)).toBeUndefined()
})

test('refuses every callback when no dev worker is configured', () => {
  expect(parseProxyCallbackURL(PREVIEW_CALLBACK, {})).toBeUndefined()
})

test('accepts a preview callback and strips everything but host and path', () => {
  expect(
    parseProxyCallbackURL(`https://user:pw@${PREVIEW}:443/api/auth/github/callback?a=1`, CONFIG),
  ).toBe(PREVIEW_CALLBACK)
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

test.each([
  {
    case: 'the dev worker',
    url: `${DEV_WORKER}/api/auth/github/login`,
    config: CONFIG,
    expected: true,
  },
  {
    case: 'a preview of the dev worker',
    url: `https://${PREVIEW}/api/auth/github/login`,
    config: CONFIG,
    expected: false,
  },
  {
    case: 'production',
    url: 'https://revision.city/api/auth/github/login',
    config: {},
    expected: false,
  },
  {
    case: 'a dev worker that is not a URL',
    url: `${DEV_WORKER}/api/auth/github/login`,
    config: {proxyURL: 'revision-city-dev'},
    expected: false,
  },
])('runs sign-in for previews on $case: $expected', ({url, config, expected}) => {
  expect(isSignInBroker(new URL(url), config)).toBe(expected)
})
