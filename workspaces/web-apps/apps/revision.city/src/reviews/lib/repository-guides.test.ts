import {expect, test} from 'vitest'
import {
  GUIDE_FILE_NAME,
  guidePaths,
  MAX_GUIDE_CHARS,
  readGuides,
  selectGuides,
} from './repository-guides'
import type {RepositoryEntry, RepositorySnapshot} from './repository-snapshot'

const fakeSnapshot = (files: Record<string, string>): RepositorySnapshot => ({
  entries: new Map<string, RepositoryEntry>([
    ['', {type: 'tree', sha: 'root'}],
    ['src', {type: 'tree', sha: 'src'}],
    ...Object.keys(files).map((path): [string, RepositoryEntry] => [
      path,
      {type: 'blob', sha: path},
    ]),
  ]),
  readBlob: async (sha) => new TextEncoder().encode(files[sha]),
})

test('guidePaths gives the root guide and only the nearest folder guide', () => {
  const existing = new Set(['AGENTS.md', 'apps/AGENTS.md', 'apps/web/AGENTS.md'])
  const exists = (path: string) => existing.has(path)

  expect(guidePaths({path: 'apps/web/src/a.ts', exists})).toEqual([
    'AGENTS.md',
    'apps/web/AGENTS.md',
  ])
  expect(guidePaths({path: 'apps/b.ts', exists})).toEqual(['AGENTS.md', 'apps/AGENTS.md'])
  expect(guidePaths({path: 'a.ts', exists})).toEqual(['AGENTS.md'])
})

test('guidePaths gives the nearest folder guide when the root has none', () => {
  expect(guidePaths({path: 'apps/b.ts', exists: (path) => path === 'apps/AGENTS.md'})).toEqual([
    'apps/AGENTS.md',
  ])
})

test('readGuides reads each guide that applies to a path once', async () => {
  const snapshot = fakeSnapshot({
    'AGENTS.md': ' Use bun.\n',
    'src/AGENTS.md': 'Test each export.',
    'docs/AGENTS.md': 'Not read.',
  })

  const guides = await readGuides({snapshot, paths: ['src/a.ts', 'src/b.ts', 'c.ts']})

  expect(guides).toEqual({'AGENTS.md': 'Use bun.', 'src/AGENTS.md': 'Test each export.'})
})

test('readGuides does not take a folder named like a guide', async () => {
  const snapshot = fakeSnapshot({})
  const entries = new Map(snapshot.entries).set(GUIDE_FILE_NAME, {type: 'tree', sha: 'folder'})

  expect(await readGuides({snapshot: {...snapshot, entries}, paths: ['a.ts']})).toEqual({})
})

test('readGuides gives no guides without a snapshot', async () => {
  expect(await readGuides({snapshot: undefined, paths: ['a.ts']})).toEqual({})
})

test('readGuides stops a guide at the character limit and counts what it leaves out', async () => {
  const snapshot = fakeSnapshot({'AGENTS.md': 'a'.repeat(MAX_GUIDE_CHARS + 5)})

  const guides = await readGuides({snapshot, paths: ['a.ts']})

  expect(guides['AGENTS.md']).toBe(`${'a'.repeat(MAX_GUIDE_CHARS)}\n(5 more characters not shown)`)
})

test('selectGuides gives the guides of a path in order, root first', () => {
  const guides = {'src/AGENTS.md': 'Test each export.', 'AGENTS.md': 'Use bun.'}

  expect(selectGuides({guides, path: 'src/a.ts'})).toEqual([
    {path: 'AGENTS.md', text: 'Use bun.'},
    {path: 'src/AGENTS.md', text: 'Test each export.'},
  ])
  expect(selectGuides({guides: {}, path: 'src/a.ts'})).toEqual([])
})
