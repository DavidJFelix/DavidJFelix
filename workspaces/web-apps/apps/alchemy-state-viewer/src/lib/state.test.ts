import {expect, test} from 'vitest'
import {
  isAction,
  maskState,
  type PersistedStateView,
  REDACTED_PLACEHOLDER,
  statusCounts,
  statusTone,
  typeOf,
} from './state'

test('maskState replaces a redacted envelope with the placeholder', () => {
  expect(maskState({__redacted__: 'super-secret'})).toBe(REDACTED_PLACEHOLDER)
})

test('maskState drops redacted secrets nested in objects and arrays', () => {
  const masked = maskState({
    props: {
      apiToken: {__redacted__: 'super-secret'},
      list: [{__redacted__: 'another'}, 'plain'],
    },
  })
  expect(JSON.stringify(masked)).not.toContain('super-secret')
  expect(JSON.stringify(masked)).not.toContain('another')
  expect(masked).toEqual({
    props: {
      apiToken: REDACTED_PLACEHOLDER,
      list: [REDACTED_PLACEHOLDER, 'plain'],
    },
  })
})

test('maskState only treats single-key envelopes as markers', () => {
  const value = {__redacted__: 'x', other: 1}
  expect(maskState(value)).toEqual({__redacted__: 'x', other: 1})
})

// Effect's Duration wire encoding fixes the field names. cSpell:words millis
test.each([
  [{_tag: 'Millis', millis: 1500}, '1500ms'],
  [{_tag: 'Nanos', nanos: '123'}, '123ns'],
  [{_tag: 'Infinity'}, 'infinite'],
  [{_tag: 'NegativeInfinity'}, '0ms'],
])('maskState renders duration %j as %s', (encoded, expected) => {
  expect(maskState({__duration__: encoded})).toBe(expected)
})

test('maskState leaves an unrecognized duration payload as data', () => {
  expect(maskState({__duration__: {_tag: 'Weird'}})).toEqual({_tag: 'Weird'})
})

test.each([null, undefined, 'text', 42, true])('maskState passes %j through', (value) => {
  expect(maskState(value)).toBe(value)
})

test.each([
  ['created', 'ok'],
  ['updated', 'ok'],
  ['ran', 'ok'],
  ['creating', 'busy'],
  ['updating', 'busy'],
  ['deleting', 'busy'],
  ['replacing', 'busy'],
  ['running', 'busy'],
  ['replaced', 'warn'],
  ['something-else', 'unknown'],
  [undefined, 'unknown'],
])('statusTone(%s) is %s', (status, tone) => {
  expect(statusTone(status)).toBe(tone)
})

test('isAction and typeOf discriminate resources from actions', () => {
  const resource: PersistedStateView = {resourceType: 'AWS.S3.Bucket', status: 'created'}
  const legacyResource: PersistedStateView = {resourceType: 'AWS.SQS.Queue'}
  const action: PersistedStateView = {kind: 'action', actionType: 'NightlySync', status: 'ran'}
  expect(isAction(resource)).toBe(false)
  expect(isAction(legacyResource)).toBe(false)
  expect(isAction(action)).toBe(true)
  expect(typeOf(resource)).toBe('AWS.S3.Bucket')
  expect(typeOf(action)).toBe('NightlySync')
  expect(typeOf({})).toBe('unknown')
})

test('statusCounts tallies by status in stable order', () => {
  const states: PersistedStateView[] = [
    {status: 'created'},
    {status: 'created'},
    {status: 'updating'},
    {},
  ]
  expect(statusCounts(states)).toEqual([
    ['created', 2],
    ['unknown', 1],
    ['updating', 1],
  ])
})
