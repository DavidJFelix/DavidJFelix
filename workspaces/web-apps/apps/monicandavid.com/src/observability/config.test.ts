import {expect, test} from 'vitest'
import {resolvePostHog, resolveSentry} from './config'

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

test('resolvePostHog is disabled when the key is blank', () => {
  expect(resolvePostHog({posthogKey: '  '})).toEqual({enabled: false})
})

test('resolvePostHog is enabled and trims the key when set', () => {
  expect(resolvePostHog({posthogKey: ' phc_abc '})).toEqual({enabled: true, key: 'phc_abc'})
})
