import {expect, test} from 'vitest'

import type {CodeEntity, EntityKind} from './entity'
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
  ownContentHash?: string
  startLine?: number
}

function createEntity({
  name,
  qualifiedName = name,
  kind = 'function',
  tokens = SUBSTANTIAL_TOKENS,
  structuralHash = 'aaaa',
  ownContentHash = 'bbbb',
  startLine = 1,
}: CreateEntityParams): CodeEntity {
  return {
    kind,
    name,
    qualifiedName,
    range: {startLine, endLine: startLine + 2},
    structuralHash,
    contentHash: ownContentHash,
    ownContentHash,
    tokens,
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
