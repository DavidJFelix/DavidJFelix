import {expect, test} from 'vitest'

import type {CodeSymbol, SequenceElement, SymbolKind, SymbolSpan} from './code-symbol'
import {matchSymbols} from './match-symbols'

// Long enough to clear the matcher's minimum for structural matching, so cases
// that mean to exercise that phase actually reach it.
const SUBSTANTIAL_TOKENS = Array.from({length: 16}, (_, index) => `token${index}`)

interface CreateSymbolParams {
  name: string
  qualifiedName?: string
  basePath?: string
  occurrence?: number
  kind?: SymbolKind
  tokens?: readonly string[]
  structuralHash?: string
  contentHash?: string
  ownContentHash?: string
  startLine?: number
  span?: SymbolSpan
  elements?: readonly SequenceElement[]
}

function createSymbol({
  name,
  qualifiedName = name,
  basePath = qualifiedName,
  occurrence = 1,
  kind = 'function',
  tokens = SUBSTANTIAL_TOKENS,
  structuralHash = 'aaaa',
  ownContentHash = 'bbbb',
  contentHash = ownContentHash,
  startLine = 1,
  span,
  elements,
}: CreateSymbolParams): CodeSymbol {
  return {
    kind,
    name,
    qualifiedName,
    basePath,
    occurrence,
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
  hasSymbols?: boolean
  span?: SymbolSpan
}

function createElement({
  hash,
  index = 0,
  hasSymbols = false,
  span,
}: CreateElementParams): SequenceElement {
  return {
    hash,
    preview: hash,
    range: {startLine: index + 1, endLine: index + 1},
    span: span ?? {from: index * 10, to: index * 10 + 9},
    hasSymbols,
  }
}

test('reports nothing when both revisions hold the same symbols', () => {
  const symbol = createSymbol({name: 'greet'})

  const changes = matchSymbols({oldSymbols: [symbol], newSymbols: [symbol]})

  expect(changes).toEqual([])
})

test('reports a same-named symbol with a changed body as modified', () => {
  const before = createSymbol({name: 'greet', ownContentHash: 'one'})
  const after = createSymbol({name: 'greet', ownContentHash: 'two'})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes).toMatchObject([{type: 'modified', qualifiedName: 'greet'}])
})

test('treats a same-named symbol of a different kind as an add plus a delete', () => {
  const before = createSymbol({name: 'Widget', kind: 'function'})
  const after = createSymbol({name: 'Widget', kind: 'class'})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes.map((change) => change.type).toSorted()).toEqual(['added', 'deleted'])
})

test('matches an identical body under a new name as a rename', () => {
  const before = createSymbol({name: 'greet', structuralHash: 'same'})
  const after = createSymbol({name: 'welcome', structuralHash: 'same'})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes).toMatchObject([
    {type: 'renamed', qualifiedName: 'welcome', previousQualifiedName: 'greet'},
  ])
})

test('does not pair equal shapes whose tokens differ', () => {
  const before = createSymbol({name: 'greet', structuralHash: 'same'})
  const after = createSymbol({
    name: 'welcome',
    structuralHash: 'same',
    tokens: SUBSTANTIAL_TOKENS.map((token) => `${token}x`),
  })

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes.map((change) => change.type).toSorted()).toEqual(['added', 'deleted'])
})

test('matches a symbol that kept its name but changed owner as a move', () => {
  const before = createSymbol({name: 'render', qualifiedName: 'Widget.render', kind: 'method'})
  const after = createSymbol({name: 'render', qualifiedName: 'Gadget.render', kind: 'method'})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes).toMatchObject([
    {type: 'moved', qualifiedName: 'Gadget.render', previousQualifiedName: 'Widget.render'},
  ])
})

test('stays quiet when a symbol is untouched but sits at a new line', () => {
  const before = createSymbol({name: 'greet', startLine: 5})
  const after = createSymbol({name: 'greet', startLine: 40})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes).toEqual([])
})

test('leaves a one-line body to token matching rather than trusting its shape', () => {
  const before = createSymbol({name: 'goes', structuralHash: 'same', tokens: ['return', '2']})
  const after = createSymbol({name: 'arrives', structuralHash: 'same', tokens: ['return', '3']})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes.map((change) => change.type).toSorted()).toEqual(['added', 'deleted'])
})

test('matches a renamed and lightly edited body by token overlap', () => {
  const before = createSymbol({name: 'greet', structuralHash: 'one', tokens: SUBSTANTIAL_TOKENS})
  const after = createSymbol({
    name: 'welcome',
    structuralHash: 'two',
    tokens: [...SUBSTANTIAL_TOKENS.slice(0, 15), 'changed'],
  })

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes).toMatchObject([{type: 'renamed', previousQualifiedName: 'greet'}])
  expect(changes[0].similarity).toBeGreaterThan(0.8)
})

test('leaves a rewritten body unmatched rather than guessing a rename', () => {
  const before = createSymbol({name: 'greet', structuralHash: 'one', tokens: ['a', 'b', 'c', 'd']})
  const after = createSymbol({name: 'welcome', structuralHash: 'two', tokens: ['w', 'x', 'y', 'z']})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes.map((change) => change.type).toSorted()).toEqual(['added', 'deleted'])
})

test('never claims one old symbol for two new ones', () => {
  const before = createSymbol({name: 'greet', structuralHash: 'same'})
  const first = createSymbol({name: 'welcome', structuralHash: 'same'})
  const second = createSymbol({name: 'salute', structuralHash: 'same'})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [first, second]})

  expect(changes.filter((change) => change.type === 'renamed')).toHaveLength(1)
  expect(changes.filter((change) => change.type === 'added')).toHaveLength(1)
})

test('reports symbols present on only one side', () => {
  const before = createSymbol({name: 'removed', structuralHash: 'one', tokens: ['a']})
  const after = createSymbol({name: 'introduced', structuralHash: 'two', tokens: ['z']})

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes).toMatchObject([
    {type: 'added', qualifiedName: 'introduced'},
    {type: 'deleted', qualifiedName: 'removed'},
  ])
})

function repeatToken(token: string, count: number): string[] {
  return Array.from({length: count}, () => token)
}

// The test has 100 old functions and 1 new function, each of 100,000 tokens.
// The fuzzy phase makes 100 comparisons. Together they read the 10,000,000 old
// tokens once and the 100,000 new tokens 100 times: 20,000,000 reads. One extra
// token in the first old function makes the total 20,000,001. Only the first
// old function is similar to the new one, so the phase finds a rename only if
// it runs.
test.each([
  {reads: '20,000,000', extraTokens: 0, runs: true},
  {reads: '20,000,001', extraTokens: 1, runs: false},
])('the fuzzy phase runs at $reads token reads: $runs', ({extraTokens, runs}) => {
  const otherTokens = repeatToken('other', 100_000)
  const oldSymbols = Array.from({length: 100}, (_, index) =>
    createSymbol({
      name: `old${index}`,
      structuralHash: `old${index}`,
      tokens:
        index === 0
          ? [...repeatToken('shared', 100_000), ...repeatToken('extra', extraTokens)]
          : otherTokens,
    }),
  )
  const newSymbol = createSymbol({
    name: 'new',
    structuralHash: 'new',
    tokens: repeatToken('shared', 100_000),
  })

  const changes = matchSymbols({oldSymbols, newSymbols: [newSymbol]})

  expect(changes.some((change) => change.type === 'renamed')).toBe(runs)
})

// If the phase counted all kinds together, it would read the 100,199 old tokens
// once and the 100,000 new tokens 200 times. That is 20,100,199 reads, over the
// limit.
test('the fuzzy phase counts only the reads between symbols of the same kind', () => {
  const oldFunction = createSymbol({
    name: 'old',
    structuralHash: 'old',
    tokens: repeatToken('shared', 100_000),
  })
  const deletedClasses = Array.from({length: 199}, (_, index) =>
    createSymbol({
      name: `Deleted${index}`,
      kind: 'class',
      structuralHash: `deleted${index}`,
      tokens: ['class'],
    }),
  )
  const newFunction = createSymbol({
    name: 'new',
    structuralHash: 'new',
    tokens: repeatToken('shared', 100_000),
  })

  const changes = matchSymbols({
    oldSymbols: [oldFunction, ...deletedClasses],
    newSymbols: [newFunction],
  })

  expect(changes).toContainEqual(expect.objectContaining({type: 'renamed', name: 'new'}))
})

// A property occurrence sharing its key with siblings, the way objects in a
// JSON array all carry `name`. Ordinal suffixes follow document order.
function createOccurrence(hash: string, ordinal: number): CodeSymbol {
  return createSymbol({
    name: 'name',
    qualifiedName: ordinal === 0 ? 'defs.name' : `defs.name#${ordinal + 1}`,
    basePath: 'defs.name',
    occurrence: ordinal + 1,
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

  const changes = matchSymbols({oldSymbols: olds, newSymbols: news})

  expect(changes).toMatchObject([{type: 'added', qualifiedName: 'defs.name'}])
})

test('pairs an edited occurrence by its position among unedited siblings', () => {
  const olds = ['alpha', 'beta', 'gamma'].map((hash, ordinal) => createOccurrence(hash, ordinal))
  const news = ['alpha', 'edited', 'gamma'].map((hash, ordinal) => createOccurrence(hash, ordinal))

  const changes = matchSymbols({oldSymbols: olds, newSymbols: news})

  expect(changes).toMatchObject([{type: 'modified', qualifiedName: 'defs.name#2'}])
})

// 101 old and 100 new leftovers of one name, each of `words` words: the pairing
// reads the 100 new lists 101 times and the 101 old lists 100 times. At 990
// words that is 19,998,000 reads; at 1,000 it is 20,200,000, over the limit.
// Each new entry is most like the old entry after it, so the pairing skips the
// first old entry only if it runs. Otherwise the zip skips the last.
test.each([
  {words: 990, runs: true},
  {words: 1000, runs: false},
])('the leftover pairing reads $words words an entry: runs $runs', ({words, runs}) => {
  const createLeftover = (hash: string, ordinal: number, word: string): CodeSymbol => ({
    ...createOccurrence(hash, ordinal),
    tokens: repeatToken(word, words),
  })
  const olds = Array.from({length: 101}, (_, ordinal) =>
    createLeftover(`old${ordinal}`, ordinal, ordinal === 0 ? 'other' : `word${ordinal - 1}`),
  )
  const news = Array.from({length: 100}, (_, ordinal) =>
    createLeftover(`new${ordinal}`, ordinal, `word${ordinal}`),
  )

  const changes = matchSymbols({oldSymbols: olds, newSymbols: news})

  expect(changes.filter((change) => change.type === 'deleted')).toMatchObject([
    {qualifiedName: runs ? 'defs.name' : 'defs.name#101'},
  ])
})

test('summarizes an array insertion as an element edit with its index', () => {
  const before = createSymbol({
    name: 'words',
    kind: 'property',
    ownContentHash: 'one',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"beta"', index: 1}),
    ],
  })
  const after = createSymbol({
    name: 'words',
    kind: 'property',
    ownContentHash: 'two',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"lezer"', index: 1}),
      createElement({hash: '"beta"', index: 2}),
    ],
  })

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

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
  const before = createSymbol({
    name: 'words',
    kind: 'property',
    ownContentHash: 'one',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"betas"', index: 1}),
    ],
  })
  const after = createSymbol({
    name: 'words',
    kind: 'property',
    ownContentHash: 'two',
    elements: [
      createElement({hash: '"alpha"', index: 0}),
      createElement({hash: '"beta"', index: 1}),
    ],
  })

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes[0].detail?.edits).toMatchObject([
    {type: 'deleted', index: 1, preview: '"betas"'},
    {type: 'inserted', index: 1, preview: '"beta"'},
  ])
})

test('stays quiet about an element edit that nested symbols already report', () => {
  const before = createSymbol({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'same',
    elements: [createElement({hash: 'objA', index: 0, hasSymbols: true})],
  })
  const after = createSymbol({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'same',
    elements: [createElement({hash: 'objB', index: 0, hasSymbols: true})],
  })

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after]})

  expect(changes).toEqual([])
})

test('reports an inserted object element once, not once per key inside it', () => {
  const before = createSymbol({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'one',
    span: {from: 0, to: 200},
    elements: [createElement({hash: 'objA', hasSymbols: true, span: {from: 100, to: 199}})],
  })
  const after = createSymbol({
    name: 'defs',
    kind: 'property',
    ownContentHash: 'two',
    span: {from: 0, to: 300},
    elements: [
      createElement({hash: 'objNew', hasSymbols: true, span: {from: 10, to: 99}}),
      createElement({hash: 'objA', hasSymbols: true, span: {from: 100, to: 199}}),
    ],
  })
  const insertedKey = createSymbol({
    name: 'name',
    qualifiedName: 'defs.name',
    kind: 'property',
    tokens: ['"name"', '"lezer"'],
    span: {from: 20, to: 40},
  })

  const changes = matchSymbols({oldSymbols: [before], newSymbols: [after, insertedKey]})

  expect(changes).toMatchObject([
    {
      type: 'modified',
      qualifiedName: 'defs',
      detail: {lengthBefore: 1, lengthAfter: 2, edits: [{type: 'inserted', index: 0}]},
    },
  ])
})
