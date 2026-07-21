import {expect, test} from 'vitest'
import {rethrowAsHttpError} from './errors'
import {StateApiError} from './state-api'

test('a StateApiError becomes a 502 HTTP error', () => {
  let thrown: unknown
  try {
    rethrowAsHttpError(new StateApiError({message: 'store is down'}))
  } catch (cause) {
    thrown = cause
  }
  expect(thrown).toMatchObject({status: 502, body: {message: 'store is down'}})
})

test('other failures rethrow untouched', () => {
  const original = new Error('unrelated')
  expect(() => rethrowAsHttpError(original)).toThrow(original)
})
