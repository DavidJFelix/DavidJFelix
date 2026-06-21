import {expect, test} from 'vitest'
import {DEFAULT_POSTHOG_HOST, resolvePostHog, resolveSentry} from './config'

test('resolveSentry is disabled when no DSN is set', () => {
  expect(resolveSentry({})).toEqual({enabled: false})
})

test('resolveSentry is disabled when the DSN is blank', () => {
  expect(resolveSentry({sentryDsn: '   '})).toEqual({enabled: false})
})

test('resolveSentry is enabled and trims the DSN when set', () => {
  expect(resolveSentry({sentryDsn: ' https://k@o0.ingest.sentry.io/1 '})).toEqual({
    enabled: true,
    dsn: 'https://k@o0.ingest.sentry.io/1',
  })
})

test('resolvePostHog is disabled when no key is set', () => {
  expect(resolvePostHog({})).toEqual({enabled: false})
})

test('resolvePostHog defaults the host when only a key is set', () => {
  expect(resolvePostHog({posthogKey: 'phc_abc'})).toEqual({
    enabled: true,
    key: 'phc_abc',
    host: DEFAULT_POSTHOG_HOST,
  })
})

test('resolvePostHog uses and trims a custom host', () => {
  expect(
    resolvePostHog({posthogKey: ' phc_abc ', posthogHost: ' https://eu.i.posthog.com '}),
  ).toEqual({enabled: true, key: 'phc_abc', host: 'https://eu.i.posthog.com'})
})
