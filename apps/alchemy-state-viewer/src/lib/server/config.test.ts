import {expect, test} from 'vitest'
import {resolveStateStoreSettings} from './config'

test('resolveStateStoreSettings returns url and token when both are set', () => {
  expect(
    resolveStateStoreSettings({
      ALCHEMY_STATE_URL: ' https://state.example.com ',
      ALCHEMY_STATE_TOKEN: ' abc ',
    }),
  ).toEqual({url: 'https://state.example.com', authToken: 'abc'})
})

test.each([
  ['no vars', {}],
  ['url only', {ALCHEMY_STATE_URL: 'https://state.example.com'}],
  ['token only', {ALCHEMY_STATE_TOKEN: 'abc'}],
  ['blank url', {ALCHEMY_STATE_URL: '  ', ALCHEMY_STATE_TOKEN: 'abc'}],
])('resolveStateStoreSettings is undefined with %s', (_name, env) => {
  expect(resolveStateStoreSettings(env)).toBeUndefined()
})
