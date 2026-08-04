import {expect, test} from 'vitest'

import {isPreviewHost, parsePreviewOrigin, shouldBorrowSignIn} from './preview-auth'

const BROKER = 'https://revision.city'

test.each([
  ['a per-PR preview', 'pr-409-revision-city.nullserve.workers.dev', true],
  ['a preview of another worker', 'pr-7-djf-io.nullserve.workers.dev', true],
  ['production', 'revision.city', false],
  ['the stable worker URL', 'revision-city.nullserve.workers.dev', false],
  ['a look-alike suffix', 'pr-409-revision-city.nullserve.workers.dev.evil.com', false],
  ['a look-alike prefix', 'evil-pr-409-revision-city.nullserve.workers.dev', false],
  ['a non-numeric PR number', 'pr-abc-revision-city.nullserve.workers.dev', false],
])('recognizes %s as a preview host: %s', (_case, hostname, expected) => {
  expect(isPreviewHost(hostname)).toBe(expected)
})

test.each([
  ['another site entirely', 'https://evil.example.com'],
  ['a look-alike host', 'https://pr-409-revision-city.nullserve.workers.dev.evil.com'],
  ['plain http', 'http://pr-409-revision-city.nullserve.workers.dev'],
  ['not a URL at all', 'pr-409-revision-city.nullserve.workers.dev'],
  ['an empty value', ''],
  ['nothing', null],
])('refuses to forward a code to %s', (_case, value) => {
  expect(parsePreviewOrigin(value)).toBeUndefined()
})

test('accepts a preview origin and strips everything but the host', () => {
  expect(
    parsePreviewOrigin('https://user:pw@pr-409-revision-city.nullserve.workers.dev:443/evil?a=1'),
  ).toBe('https://pr-409-revision-city.nullserve.workers.dev')
})

test.each([
  {
    case: 'a preview with a stable origin configured',
    url: 'https://pr-409-revision-city.nullserve.workers.dev/api/auth/github/login',
    config: {brokerURL: BROKER},
    expected: true,
  },
  {
    case: 'production, which runs its own OAuth',
    url: 'https://revision.city/api/auth/github/login',
    config: {brokerURL: BROKER},
    expected: false,
  },
  {
    case: 'a preview with nothing configured',
    url: 'https://pr-409-revision-city.nullserve.workers.dev/api/auth/github/login',
    config: {},
    expected: false,
  },
])('borrows sign-in for $case: $expected', ({url, config, expected}) => {
  expect(shouldBorrowSignIn(new URL(url), config)).toBe(expected)
})
