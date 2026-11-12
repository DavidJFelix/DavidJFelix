import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, test, vi} from 'vitest'

import type {EntityChange} from '@/symbols/lib/entity'
import type * as SequenceEditRowsModule from './sequence-edit-rows'
import {SequenceEditRows} from './sequence-edit-rows'
import {SymbolChangesList, type SymbolSelection} from './symbol-changes-list'
import type {EntityDiffEntry} from './use-entity-diffs'

// @pierre/icons ships ESM whose relative imports omit file extensions, which
// Node's loader rejects, and its sourcemaps point at unpublished sources. The
// icon here is decorative, so stub the package rather than reconfigure Vitest
// to bundle it for every suite.
vi.mock('@pierre/icons', () => ({IconBraces: () => null}))
// The real rows, wrapped so a test can count how often a file draws them.
vi.mock('./sequence-edit-rows', async (importOriginal) => {
  const actual = await importOriginal<typeof SequenceEditRowsModule>()
  return {
    ...actual,
    SequenceEditRows: vi.fn<typeof actual.SequenceEditRows>(actual.SequenceEditRows),
  }
})
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

function createEntry(changes: readonly EntityChange[]): EntityDiffEntry {
  return {
    itemId: 'item-1',
    name: 'src/widget.ts',
    status: 'ready',
    diff: {
      path: 'src/widget.ts',
      language: 'typescript',
      changes,
      summary: {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0},
    },
  }
}

const MODIFIED_METHOD: EntityChange = {
  type: 'modified',
  kind: 'method',
  name: 'render',
  qualifiedName: 'Widget.render',
  oldRange: {startLine: 10, endLine: 14},
  newRange: {startLine: 12, endLine: 16},
}

interface ListHarness {
  container: HTMLElement
  rerender: (entries: readonly EntityDiffEntry[]) => void
  unmount: () => void
}

interface RenderListParams {
  entries?: readonly EntityDiffEntry[]
  onRetry?: () => void
  onSelectSymbol?: (selection: SymbolSelection) => void
  supported?: boolean
}

function renderList({
  entries = [createEntry([MODIFIED_METHOD])],
  onRetry,
  onSelectSymbol,
  supported = true,
}: RenderListParams = {}): ListHarness {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const render = (nextEntries: readonly EntityDiffEntry[]) => {
    act(() => {
      root.render(
        <SymbolChangesList
          entries={nextEntries}
          onRetry={onRetry}
          onSelectSymbol={onSelectSymbol}
          supported={supported}
        />,
      )
    })
  }
  render(entries)
  return {
    container,
    rerender: render,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function findRow(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(label),
  )
}

test('names the changed symbol and its file', () => {
  const harness = renderList()

  expect(harness.container.textContent).toContain('Widget.render')
  expect(harness.container.textContent).toContain('src/widget.ts')
  harness.unmount()
})

test('scrolls to the new location of a changed symbol', () => {
  const onSelectSymbol = vi.fn<(selection: SymbolSelection) => void>()
  const harness = renderList({onSelectSymbol})

  act(() => {
    findRow(harness.container, 'Widget.render')?.click()
  })

  expect(onSelectSymbol).toHaveBeenCalledWith({
    itemId: 'item-1',
    lineNumber: 12,
    side: 'additions',
  })
  harness.unmount()
})

test('scrolls to the old location of a deleted symbol', () => {
  const onSelectSymbol = vi.fn<(selection: SymbolSelection) => void>()
  const harness = renderList({
    entries: [
      createEntry([
        {
          type: 'deleted',
          kind: 'function',
          name: 'gone',
          qualifiedName: 'gone',
          oldRange: {startLine: 30, endLine: 34},
        },
      ]),
    ],
    onSelectSymbol,
  })

  act(() => {
    findRow(harness.container, 'gone')?.click()
  })

  expect(onSelectSymbol).toHaveBeenCalledWith({itemId: 'item-1', lineNumber: 30, side: 'deletions'})
  harness.unmount()
})

test('shows what a renamed symbol used to be called', () => {
  const harness = renderList({
    entries: [
      createEntry([
        {
          type: 'renamed',
          kind: 'function',
          name: 'welcome',
          qualifiedName: 'welcome',
          previousQualifiedName: 'greet',
          newRange: {startLine: 3, endLine: 8},
        },
      ]),
    ],
  })

  expect(harness.container.textContent).toContain('welcome')
  expect(harness.container.textContent).toContain('was greet')
  harness.unmount()
})

test('explains itself on a diff source it cannot read', () => {
  const harness = renderList({entries: [], supported: false})

  expect(harness.container.textContent).toContain('No symbols for this diff')
  harness.unmount()
})

test('passes along why a diff could not be read', () => {
  const harness = renderList({
    entries: [
      {
        itemId: 'item-1',
        name: 'src/widget.ts',
        status: 'error',
        error: 'GitHub rate limit exceeded. Sign in with GitHub to raise the limit.',
      },
    ],
  })

  expect(harness.container.textContent).toContain('Could not read this diff')
  expect(harness.container.textContent).toContain('Sign in with GitHub to raise the limit')
  harness.unmount()
})

test('says so when a diff changed no nameable symbol', () => {
  const harness = renderList({entries: [createEntry([])]})

  expect(harness.container.textContent).toContain('No symbol changes')
  harness.unmount()
})

const TOO_LARGE_FILE: EntityDiffEntry = {
  itemId: 'item-2',
  name: 'src/generated.ts',
  status: 'ready',
  diff: {
    path: 'src/generated.ts',
    language: 'typescript',
    changes: [],
    summary: {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0},
    skipped: 'too-large',
  },
}

const FAILED_FILE: EntityDiffEntry = {
  itemId: 'item-3',
  name: 'src/failed.ts',
  status: 'error',
  error: 'GitHub rate limit exceeded.',
}

test('names a file too large to read beside the files that changed', () => {
  const harness = renderList({entries: [createEntry([MODIFIED_METHOD]), TOO_LARGE_FILE]})

  const note = harness.container.querySelector('details')
  expect(note?.querySelector('summary')?.textContent).toBe('1 file not read')
  expect(note?.textContent).toContain('src/generated.ts: too large')
  expect(harness.container.textContent).toContain('Widget.render')
  harness.unmount()
})

test('offers to read a failed file again', () => {
  const onRetry = vi.fn<() => void>()
  const harness = renderList({entries: [createEntry([MODIFIED_METHOD]), FAILED_FILE], onRetry})

  const note = harness.container.querySelector('details')
  expect(note?.textContent).toContain('src/failed.ts: GitHub rate limit exceeded.')
  act(() => {
    findRow(harness.container, 'Retry')?.click()
  })

  expect(onRetry).toHaveBeenCalledTimes(1)
  harness.unmount()
})

test('does not claim no changes for a file it did not read', () => {
  const harness = renderList({entries: [TOO_LARGE_FILE]})

  expect(harness.container.textContent).toContain('No symbol changes in the files that were read')
  expect(harness.container.querySelector('summary')?.textContent).toBe('1 file not read')
  expect(findRow(harness.container, 'Retry')).toBeUndefined()
  harness.unmount()
})

const MODIFIED_ARRAY: EntityChange = {
  type: 'modified',
  kind: 'property',
  name: 'words',
  qualifiedName: 'words',
  oldRange: {startLine: 8, endLine: 20},
  newRange: {startLine: 8, endLine: 21},
  detail: {
    lengthBefore: 3,
    lengthAfter: 4,
    edits: [
      {type: 'inserted', index: 1, preview: '"ciphertext"', range: {startLine: 10, endLine: 10}},
    ],
  },
}

test('summarizes how a sequence-valued key changed', () => {
  const harness = renderList({entries: [createEntry([MODIFIED_ARRAY])]})

  expect(harness.container.textContent).toContain('3 → 4 elements')
  expect(harness.container.textContent).toContain('"ciphertext"')
  expect(harness.container.textContent).toContain('at 1')
  harness.unmount()
})

test('scrolls to the element an edit inserted', () => {
  const onSelectSymbol = vi.fn<(selection: SymbolSelection) => void>()
  const harness = renderList({entries: [createEntry([MODIFIED_ARRAY])], onSelectSymbol})

  act(() => {
    findRow(harness.container, '"ciphertext"')?.click()
  })

  expect(onSelectSymbol).toHaveBeenCalledWith({itemId: 'item-1', lineNumber: 10, side: 'additions'})
  harness.unmount()
})

test('caps the element edits it shows behind a count', () => {
  const edits = Array.from({length: 12}, (_, index) => ({
    type: 'inserted' as const,
    index,
    preview: `"word${index}"`,
    range: {startLine: index + 1, endLine: index + 1},
  }))
  const harness = renderList({
    entries: [
      createEntry([{...MODIFIED_ARRAY, detail: {lengthBefore: 0, lengthAfter: 12, edits}}]),
    ],
  })

  expect(harness.container.textContent).toContain('"word7"')
  expect(harness.container.textContent).not.toContain('"word8"')
  expect(harness.container.textContent).toContain('and 4 more')
  harness.unmount()
})

test('does not draw a finished file again when a later file arrives', () => {
  vi.mocked(SequenceEditRows).mockClear()
  const firstFile = createEntry([MODIFIED_ARRAY])
  const harness = renderList({entries: [firstFile]})

  harness.rerender([
    firstFile,
    {...createEntry([MODIFIED_METHOD]), itemId: 'item-2', name: 'src/b.ts'},
  ])

  expect(harness.container.textContent).toContain('src/b.ts')
  expect(SequenceEditRows).toHaveBeenCalledTimes(1)
  harness.unmount()
})

test('reports progress while files are still being read', () => {
  const harness = renderList({
    entries: [
      createEntry([MODIFIED_METHOD]),
      {itemId: 'item-2', name: 'src/b.ts', status: 'loading'},
    ],
  })

  expect(harness.container.textContent).toContain('Reading 1 more file')
  harness.unmount()
})
