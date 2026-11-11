import {expect, test} from 'vitest'

import type {SequenceElement} from './entity'
import {alignByHash, diffSequenceElements} from './sequence-alignment'

// 600 by 600 is past the 250,000-cell table cap, so these cases reach the
// unique-hash split.
const LARGE = 600

function hashes(count: number): string[] {
  return Array.from({length: count}, (_, index) => `item${index}`)
}

function toElements(values: readonly string[]): SequenceElement[] {
  return values.map((hash, index) => ({
    hash,
    preview: hash,
    range: {startLine: index + 1, endLine: index + 1},
    span: {from: index, to: index + 1},
    hasEntities: false,
  }))
}

// Two repeated hashes. Started on the other hash, the second sequence shares no
// head or tail with the first, so the whole sequence is a middle with no unique
// hash.
function alternating(count: number, first: string, second: string): string[] {
  return Array.from({length: count}, (_, index) => (index % 2 === 0 ? first : second))
}

test('pairs a large middle on hashes that occur once on each side', () => {
  const left = hashes(LARGE)
  const right = left.toSpliced(LARGE - 10, 1).toSpliced(10, 0, 'added')

  const pairs = alignByHash(left, right)

  expect(pairs).toHaveLength(LARGE - 1)
  expect(pairs).toContainEqual([300, 301])
  expect(pairs.some(([old]) => old === LARGE - 10)).toBe(false)
})

test('leaves a large middle with no unique hashes unpaired', () => {
  const left = alternating(LARGE, 'even', 'odd')
  const right = alternating(LARGE, 'odd', 'even')

  expect(alignByHash(left, right)).toEqual([])
})

test('reports one insert and one delete far apart in a large sequence', () => {
  const left = hashes(LARGE)
  const right = left.toSpliced(LARGE - 10, 1).toSpliced(10, 0, 'added')

  const diff = diffSequenceElements({before: toElements(left), after: toElements(right)})

  expect(diff?.detail.edits.map(({type, index, preview}) => ({type, index, preview}))).toEqual([
    {type: 'inserted', index: 10, preview: 'added'},
    {type: 'deleted', index: LARGE - 10, preview: `item${LARGE - 10}`},
  ])
  expect(diff?.insertedElements.map(({hash}) => hash)).toEqual(['added'])
  expect(diff?.deletedElements.map(({hash}) => hash)).toEqual([`item${LARGE - 10}`])
})

test('drops a unique hash that moved out of order and reports the move', () => {
  const left = hashes(LARGE)
  const right = [...left.toSpliced(5, 1), 'item5']

  const diff = diffSequenceElements({before: toElements(left), after: toElements(right)})

  expect(diff?.detail.edits.map(({type, index}) => ({type, index}))).toEqual([
    {type: 'deleted', index: 5},
    {type: 'inserted', index: LARGE - 1},
  ])
})

test('keeps only the lengths for a large middle with no unique hashes', () => {
  const before = toElements(alternating(LARGE, 'even', 'odd'))
  const after = toElements(alternating(LARGE, 'odd', 'even'))

  expect(diffSequenceElements({before, after})).toEqual({
    detail: {lengthBefore: LARGE, lengthAfter: LARGE, edits: []},
    insertedElements: [],
    deletedElements: [],
  })
})
