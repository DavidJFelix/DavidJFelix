import {expect, test} from 'vitest'
import {resolveStateStoreSettings} from './config'

const URL_ENV = {ALCHEMY_STATE_URL: 'https://state.example.com'}

test('resolves url and token from string env', async () => {
  const settings = await resolveStateStoreSettings({
    env: {ALCHEMY_STATE_URL: ' https://state.example.com ', ALCHEMY_STATE_TOKEN: ' abc '},
  })
  expect(settings).toEqual({url: 'https://state.example.com', authToken: 'abc'})
})

test('reads url and token strings from the platform env (wrangler vars/.dev.vars)', async () => {
  const settings = await resolveStateStoreSettings({
    env: {},
    platformEnv: {ALCHEMY_STATE_URL: 'https://state.example.com', ALCHEMY_STATE_TOKEN: 'abc'},
  })
  expect(settings).toEqual({url: 'https://state.example.com', authToken: 'abc'})
})

test('falls back to the Secrets Store binding for the token', async () => {
  const settings = await resolveStateStoreSettings({
    env: URL_ENV,
    platformEnv: {ALCHEMY_STATE_TOKEN_SECRET: {get: () => Promise.resolve(' bound-token ')}},
  })
  expect(settings).toEqual({url: 'https://state.example.com', authToken: 'bound-token'})
})

test('the string env token wins over the binding', async () => {
  const settings = await resolveStateStoreSettings({
    env: {...URL_ENV, ALCHEMY_STATE_TOKEN: 'env-token'},
    platformEnv: {ALCHEMY_STATE_TOKEN_SECRET: {get: () => Promise.resolve('bound-token')}},
  })
  expect(settings?.authToken).toBe('env-token')
})

test.each([
  ['no vars', {}],
  ['token only', {ALCHEMY_STATE_TOKEN: 'abc'}],
  ['blank url', {ALCHEMY_STATE_URL: '  ', ALCHEMY_STATE_TOKEN: 'abc'}],
  ['url but no token source', {ALCHEMY_STATE_URL: 'https://state.example.com'}],
])('undefined with %s', async (_name, env) => {
  expect(await resolveStateStoreSettings({env})).toBeUndefined()
})

test.each([
  ['a blank binding value', {ALCHEMY_STATE_TOKEN_SECRET: {get: () => Promise.resolve('  ')}}],
  ['a non-binding value', {ALCHEMY_STATE_TOKEN_SECRET: 'not-a-binding'}],
  ['an absent binding', {}],
])('undefined with url set and %s', async (_name, platformEnv) => {
  expect(await resolveStateStoreSettings({env: URL_ENV, platformEnv})).toBeUndefined()
})

test('the deployed token path routes requests through the service binding', async () => {
  const routed: string[] = []
  const settings = await resolveStateStoreSettings({
    env: URL_ENV,
    platformEnv: {
      ALCHEMY_STATE_TOKEN_SECRET: {get: () => Promise.resolve('bound-token')},
      ALCHEMY_STATE_STORE: {
        fetch: (input: string | URL) => {
          routed.push(String(input))
          return Promise.resolve(new Response('ok'))
        },
      },
    },
  })
  expect(settings?.fetch).toBeDefined()
  await settings?.fetch?.('https://state.example.com/state/stacks')
  expect(routed).toEqual(['https://state.example.com/state/stacks'])
})

test('the dev token path keeps global fetch even when the service binding exists', async () => {
  const settings = await resolveStateStoreSettings({
    env: {...URL_ENV, ALCHEMY_STATE_TOKEN: 'env-token'},
    platformEnv: {ALCHEMY_STATE_STORE: {fetch: () => Promise.resolve(new Response('ok'))}},
  })
  expect(settings?.fetch).toBeUndefined()
})

test('the deployed token path works without a service binding', async () => {
  const settings = await resolveStateStoreSettings({
    env: URL_ENV,
    platformEnv: {ALCHEMY_STATE_TOKEN_SECRET: {get: () => Promise.resolve('bound-token')}},
  })
  expect(settings).toEqual({url: 'https://state.example.com', authToken: 'bound-token'})
  expect(settings?.fetch).toBeUndefined()
})

test('a failing binding read propagates', async () => {
  await expect(
    resolveStateStoreSettings({
      env: URL_ENV,
      platformEnv: {
        ALCHEMY_STATE_TOKEN_SECRET: {get: () => Promise.reject(new Error('secret not found'))},
      },
    }),
  ).rejects.toThrow('secret not found')
})
