import {expect, test} from 'vitest'

import type {CodeEntity, EntityKind, EntitySpan, SequenceElement} from './entity'
import {matchEntities} from './match-entities'

// Long enough to clear the matcher's minimum for structural matching, so cases
// that mean to exercise that phase actually reach it.
const SUBSTANTIAL_TOKENS = Array.from({length: 16}, (_, index) => `token${index}`)

interface CreateEntityParams {
  name: string
  qualifiedName?: string
  kind?: EntityKind
  tokens?: readonly string[]
  structuralHash?: string
  contentHash?: string
  ownContentHash?: string
  startLine?: number
  span?: EntitySpan
  elements?: readonly SequenceElement[]
}

function createEntity({
  name,
  qualifiedName = name,
  kind = 'function',
  tokens = SUBSTANTIAL_TOKENS,
  structuralHash = 'aaaa',
  ownContentHash = 'bbbb',
  contentHash = ownContentHash,
  startLine = 1,
  span,
  elements,
}: CreateEntityParams): CodeEntity {
  return {
    kind,
    name,
    qualifiedName,
    range: {startLine, endLine: startLine + 2},
    structuralHash,
    contentHash,
    ownContentHash,
    tokens,
    span: span ?? {from: startLine * 100, to: startLine * 100 + 99},
    ...(elements === undefined ? {} : {elements}),
  }
}

interface CreateElementParams {
  hash: string
  index?: number
  hasEntities?: boolean
  span?: EntitySpan
}

function createElement({
  hash,
  index = 0,
  hasEntities = false,
  span,
}: CreateElementParams): SequenceElement {
  return {
    hash,
    preview: hash,
    range: {startLine: index + 1, endLine: index + 1},
    span: span ?? {from: index * 10, to: index * 10 + 9},
    hasEntities,
  }
}

test('reports nothing when both revisions hold the same entities', () => {
  const entity = createEntity({name: 'greet'})

  const changes = matchEntities({oldEntities: [entity], newEntities: [entity]})

  expect(changes).toEqual([])
})

test('reports a same-named entity with a changed body as modified', () => {
  const before = createEntity({name: 'greet', ownContentHash: 'one'})
  const after = createEntity({name: 'greet', ownContentHash: 'two'})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toMatchObject([{type: 'modified', qualifiedName: 'greet'}])
})

test('treats a same-named entity of a different kind as an add plus a delete', () => {
  const before = createEntity({name: 'Widget', kind: 'function'})
  const after = createEntity({name: 'Widget', kind: 'class'})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes.map((change) => change.type).toSorted()).toEqual(['added', 'deleted'])
})

test('matches an identical body under a new name as a rename', () => {
  const before = createEntity({name: 'greet', structuralHash: 'same'})
  const after = createEntity({name: 'welcome', structuralHash: 'same'})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toMatchObject([
    {type: 'renamed', qualifiedName: 'welcome', previousQualifiedName: 'greet'},
  ])
})

test('matches an entity that kept its name but changed owner as a move', () => {
  const before = createEntity({name: 'render', qualifiedName: 'Widget.render', kind: 'method'})
  const after = createEntity({name: 'render', qualifiedName: 'Gadget.render', kind: 'method'})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toMatchObject([
    {type: 'moved', qualifiedName: 'Gadget.render', previousQualifiedName: 'Widget.render'},
  ])
})

test('stays quiet when an entity is untouched but sits at a new line', () => {
  const before = createEntity({name: 'greet', startLine: 5})
  const after = createEntity({name: 'greet', startLine: 40})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toEqual([])
})

test('leaves a one-line body to token matching rather than trusting its shape', () => {
  const before = createEntity({name: 'goes', structuralHash: 'same', tokens: ['return', '2']})
  const after = createEntity({name: 'arrives', structuralHash: 'same', tokens: ['return', '3']})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes.map((change) => change.type).toSorted()).toEqual(['added', 'deleted'])
})

test('matches a renamed and lightly edited body by token overlap', () => {
  const before = createEntity({name: 'greet', structuralHash: 'one', tokens: SUBSTANTIAL_TOKENS})
  const after = createEntity({
    name: 'welcome',
    structuralHash: 'two',
    tokens: [...SUBSTANTIAL_TOKENS.slice(0, 15), 'changed'],
  })

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toMatchObject([{type: 'renamed', previousQualifiedName: 'greet'}])
  expect(changes[0].similarity).toBeGreaterThan(0.8)
})

test('leaves a rewritten body unmatched rather than guessing a rename', () => {
  const before = createEntity({name: 'greet', structuralHash: 'one', tokens: ['a', 'b', 'c', 'd']})
  const after = createEntity({name: 'welcome', structuralHash: 'two', tokens: ['w', 'x', 'y', 'z']})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes.map((change) => change.type).toSorted()).toEqual(['added', 'deleted'])
})

test('never claims one old entity for two new ones', () => {
  const before = createEntity({name: 'greet', structuralHash: 'same'})
  const first = createEntity({name: 'welcome', structuralHash: 'same'})
  const second = createEntity({name: 'salute', structuralHash: 'same'})

  const changes = matchEntities({oldEntities: [before], newEntities: [first, second]})

  expect(changes.filter((change) => change.type === 'renamed')).toHaveLength(1)
  expect(changes.filter((change) => change.type === 'added')).toHaveLength(1)
})

test('reports entities present on only one side', () => {
  const before = createEntity({name: 'removed', structuralHash: 'one', tokens: ['a']})
  const after = createEntity({name: 'introduced', structuralHash: 'two', tokens: ['z']})

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toMatchObject([
    {type: 'added', qualifiedName: 'introduced'},
    {type: 'deleted', qualifiedName: 'removed'},
  ])
})

// A property occurrence sharing its key with siblings, the way objects in a
// JSON array all carry `name`. Ordinal suffixes follow document order.
function createOccurrence(hash: string, ordinal: number): CodeEntity {
  return createEntity({
    name: 'name',
    qualifiedName: ordinal === 0 ? 'defs.name' : `defs.name#${ordinal + 1}`,
    kind: 'property',
    contentHash: hash,
    ownContentHash: hash,
    tokens: [hash],
    startLine: ordinal + 1,
  })
}

test('aligns colliding names by content so an insertion does not cascade', () => {
  const olds = ['alpha', 'beta', 'gamma'].map((hash, ordinal) => createOccurrence(hash, ordinal))
  const news = ['fresh', 'alpha', 'beta', 'gamma'].map((hash, ordinal) =>
    createOccurrence(hash, ordinal),
  )

  const changes = matchEntities({oldEntities: olds, newEntities: news})

  expect(changes).toMatchObject([{type: 'added', qualifiedName: 'defs.name'}])
})

test('pairs an edited occurrence by its position among unedited siblings', () => {
  const olds = ['alpha', 'beta', 'gamma'].map((hash, ordinal) => createOccurrence(hash, ordinal))
  const news = ['alpha', 'edited', 'gamma'].map((hash, ordinal) => createOccurrence(hash, ordinal))

  const changes = matchEntities({oldEntities: olds, newEntities: news})

  expect(changes).toMatchObject([{type: 'modified', qualifiedName: 'defs.name#2'}])
})

test('summarizes an array insertion as an element edit with its index', () => {
  const before = createEntity({
    name: 'words',
    kind: 'property',
    ownContentHash: 'one',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"beta"', index: 1}),
    ],
  })
  const after = createEntity({
    name: 'words',
    kind: 'property',
    ownContentHash: 'two',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"lezer"', index: 1}),
      createElement({hash: '"beta"', index: 2}),
    ],
  })

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toMatchObject([
    {
      type: 'modified',
      qualifiedName: 'words',
      detail: {
        lengthBefore: 2,
        lengthAfter: 3,
        edits: [{type: 'inserted', index: 1, preview: '"lezer"'}],
      },
    },
  ])
})

test('reports an in-place scalar edit as a delete plus insert at its index', () => {
  const before = createEntity({
    name: 'words',
    kind: 'property',
    ownContentHash: 'one',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"betas"', index: 1}),
    ],
  })
  const after = createEntity({
    name: 'words',
    kind: 'property',
    ownContentHash: 'two',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"beta"', index: 1}),
    ],
  })

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes[0].detail?.edits).toMatchObject([
    {type: 'deleted', index: 1, preview: '"betas"'},
    {type: 'inserted', index: 1, preview: '"beta"'},
  ])
})

test('stays quiet about an element edit that nested entities already report', () => {
  const before = createEntity({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'same',
    elements: [createElement({hash: 'objA', index: 0, hasEntities: true})],
  })
  const after = createEntity({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'same',
    elements: [createElement({hash: 'objB', index: 0, hasEntities: true})],
  })

  const changes = matchEntities({oldEntities: [before], newEntities: [after]})

  expect(changes).toEqual([])
})

test('reports an inserted object element once, not once per key inside it', () => {
  const before = createEntity({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'one',
    span: {from: 0, to: 200},
    elements: [createElement({hash: 'objA', hasEntities: true, span: {from: 100, to: 199}})],
  })
  const after = createEntity({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'two',
    span: {from: 0, to: 300},
    elements: [
      createElement({hash: 'objNew', hasEntities: true, span: {from: 10, to: 99}}),
      createElement({hash: 'objA', hasEntities: true, span: {from: 100, to: 199}}),
    ],
  })
  const insertedKey = createEntity({
    name: 'name',
    qualifiedName: 'defs.name',
    kind: 'property',
    tokens: ['"name"', '"lezer"'],
    span: {from: 20, to: 40},
  })

  const changes = matchEntities({oldEntities: [before], newEntities: [after, insertedKey]})

  expect(changes).toMatchObject([
    {
      type: 'modified',
      qualifiedName: 'defs',
      detail: {lengthBefore: 1, lengthAfter: 2, edits: [{type: 'inserted', index: 0}]},
    },
  ])
})
