import {expect, test} from 'vitest'

import {
  isRecord,
  readOptionalNumber,
  readOptionalString,
  readStringPath,
  readUnknownPath,
} from './json-read'

test.each<[unknown, boolean]>([
  [{}, true],
  [[], true],
  [null, false],
  [undefined, false],
  ['text', false],
])('isRecord(%j) is %s', (value, expected) => {
  expect(isRecord(value)).toBe(expected)
})

test.each<[unknown, string | undefined]>([
  ['text', 'text'],
  ['', undefined],
  [1, undefined],
])('readOptionalString(%j) is %j', (value, expected) => {
  expect(readOptionalString(value)).toBe(expected)
})

test.each<[unknown, number | undefined]>([
  [3, 3],
  [Number.NaN, undefined],
  [Number.POSITIVE_INFINITY, undefined],
  ['3', undefined],
])('readOptionalNumber(%j) is %j', (value, expected) => {
  expect(readOptionalNumber(value)).toBe(expected)
})

const DATA = {head: {repo: {full_name: 'owner/repo', id: 7}}}

test.each<[readonly string[], unknown]>([
  [['head', 'repo', 'id'], 7],
  [['head', 'missing'], undefined],
  [['head', 'repo', 'id', 'deeper'], undefined],
  [[], DATA],
])('readUnknownPath follows %j', (path, expected) => {
  expect(readUnknownPath(DATA, path)).toEqual(expected)
})

test.each<[readonly string[], string | undefined]>([
  [['head', 'repo', 'full_name'], 'owner/repo'],
  [['head', 'repo', 'id'], undefined],
  [['base', 'sha'], undefined],
])('readStringPath reads %j as a string only', (path, expected) => {
  expect(readStringPath(DATA, path)).toBe(expected)
})
