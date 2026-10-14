import {expect, test} from 'vitest'
import type {RepositoryEntry, RepositorySnapshot} from './repository-snapshot'
import {createReviewTools, normalizePath} from './review-tools'

const SOURCE = `import {helper} from './helper'

export function total(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0)
}

export class Cart {
  add(item: number) {
    return item
  }
}
`

interface SnapshotFile {
  text?: string
  bytes?: Uint8Array
  size?: number
}

function createSnapshot(files: Record<string, SnapshotFile>): RepositorySnapshot {
  const entries = new Map<string, RepositoryEntry>([
    ['', {type: 'tree', sha: 'root'}],
    ['src', {type: 'tree', sha: 'src-tree'}],
    ['src/nested', {type: 'tree', sha: 'nested-tree'}],
    ['vendor', {type: 'commit', sha: 'vendor-commit'}],
  ])
  const blobs = new Map<string, Uint8Array>()
  for (const [path, {text = '', bytes = new TextEncoder().encode(text), size}] of Object.entries(
    files,
  )) {
    const sha = `sha-${path}`
    entries.set(path, {type: 'blob', sha, sizeBytes: size ?? bytes.length})
    blobs.set(sha, bytes)
  }
  return {entries, readBlob: async (sha) => blobs.get(sha) ?? new Uint8Array()}
}

const run = (snapshot: RepositorySnapshot, name: string, input: unknown) =>
  createReviewTools(snapshot).run({id: 'call', name, arguments: JSON.stringify(input)})

const snapshot = createSnapshot({
  'src/cart.ts': {text: SOURCE},
  'src/nested/deep.ts': {text: 'export const x = 1\n'},
  README: {text: 'hello\n'},
})

test('createReviewTools offers read_file, list_directory, and read_definition', () => {
  expect(createReviewTools(snapshot).definitions.map((tool) => tool.name)).toEqual([
    'read_file',
    'list_directory',
    'read_definition',
  ])
})

test('read_file numbers the lines and records the file it read', async () => {
  const output = await run(snapshot, 'read_file', {path: 'src/cart.ts', start_line: 3, end_line: 4})

  expect(output).toEqual({
    content: [
      'src/cart.ts, lines 3-4 of 11:',
      'L3: export function total(items: number[]): number {',
      'L4:   return items.reduce((sum, item) => sum + item, 0)',
      '(7 more lines.)',
    ].join('\n'),
    read: {path: 'src/cart.ts', sha: 'sha-src/cart.ts'},
  })
})

test('read_file reads from the first line to the end by default', async () => {
  const output = await run(snapshot, 'read_file', {path: 'src/nested/deep.ts'})

  expect(output.content).toBe('src/nested/deep.ts, lines 1-1 of 1:\nL1: export const x = 1')
})

test('read_file reads at most 300 lines and clips long lines', async () => {
  const longLine = 'x'.repeat(450)
  const text = [longLine, ...Array.from({length: 349}, (_, index) => `line ${index + 2}`)].join(
    '\n',
  )
  const output = await run(createSnapshot({'big.ts': {text}}), 'read_file', {path: 'big.ts'})
  const lines = output.content.split('\n')

  expect(lines[0]).toBe('big.ts, lines 1-300 of 350:')
  expect(lines[1]).toBe(`L1: ${'x'.repeat(400)}...`)
  expect(lines.at(-2)).toBe('L300: line 300')
  expect(lines.at(-1)).toBe('(50 more lines.)')
})

test('read_file does not cut a long line between the halves of a surrogate pair', async () => {
  const text = `${'x'.repeat(399)}\u{1f600} and more`
  const output = await run(createSnapshot({'emoji.ts': {text}}), 'read_file', {path: 'emoji.ts'})

  expect(output.content.split('\n')[1]).toBe(`L1: ${'x'.repeat(399)}...`)
})

test('read_file says how long the file is when the start is past its end', async () => {
  const output = await run(snapshot, 'read_file', {path: 'README', start_line: 5})

  expect(output.content).toBe('README has 1 lines.')
})

test('read_file reports an end_line before the start_line without a read', async () => {
  const output = await run(snapshot, 'read_file', {path: 'src/cart.ts', start_line: 4, end_line: 2})

  expect(output.content).toMatch(
    /^Invalid arguments for read_file: .*end_line is before start_line/,
  )
  expect(output.read).toBeUndefined()
})

test.each([
  {
    name: 'a missing file',
    path: 'src/missing.ts',
    content: 'src/missing.ts does not exist at the pull request head.',
    sha: '',
  },
  {name: 'a directory', path: 'src', content: 'src is a directory.', sha: 'src-tree'},
  {name: 'a submodule', path: 'vendor', content: 'vendor is a submodule.', sha: 'vendor-commit'},
])('read_file reports $name and records the lookup', async ({path, content, sha}) => {
  expect(await run(snapshot, 'read_file', {path})).toEqual({content, read: {path, sha}})
})

test('read_file refuses a file over 1 MB without reading it', async () => {
  const large: RepositorySnapshot = {
    ...createSnapshot({'data.json': {text: '{}', size: 2_000_000}}),
    readBlob: () => Promise.reject(new Error('The tool read a file over the limit')),
  }

  expect((await run(large, 'read_file', {path: 'data.json'})).content).toBe(
    'data.json is too large to read (2000000 bytes).',
  )
})

test.each([
  {name: 'reads a file', bytes: new TextEncoder().encode('note\n'), content: 'L1: note'},
  {name: 'refuses a file over 1 MB', bytes: new Uint8Array(1_000_001), content: '1000001 bytes'},
])('read_file $name whose size the tree does not give', async ({bytes, content}) => {
  const unsized: RepositorySnapshot = {
    entries: new Map([['notes.txt', {type: 'blob', sha: 'notes-sha'}]]),
    readBlob: async () => bytes,
  }

  expect((await run(unsized, 'read_file', {path: 'notes.txt'})).content).toContain(content)
})

test.each([
  {name: 'invalid UTF-8', bytes: Uint8Array.from([0xff, 0x61])},
  {name: 'a NUL byte', bytes: Uint8Array.from([0x61, 0x00, 0x62])},
])('read_file reports a binary file with $name', async ({bytes}) => {
  const binary = createSnapshot({'image.png': {bytes}})

  expect((await run(binary, 'read_file', {path: 'image.png'})).content).toBe(
    'image.png is a binary file.',
  )
})

test('list_directory lists the root with directories marked', async () => {
  expect(await run(snapshot, 'list_directory', {path: '/'})).toEqual({
    content: '/:\nsrc/\nvendor\nREADME',
    read: {path: '', sha: 'root'},
  })
})

test('list_directory lists only the direct children of a directory', async () => {
  expect((await run(snapshot, 'list_directory', {path: './src/'})).content).toBe(
    'src:\nnested/\ncart.ts',
  )
})

test('list_directory shows at most 200 entries', async () => {
  const files = Object.fromEntries(
    Array.from({length: 205}, (_, index) => [`src/f${index}.ts`, {text: ''}]),
  )
  const lines = (await run(createSnapshot(files), 'list_directory', {path: 'src'})).content.split(
    '\n',
  )

  expect(lines).toHaveLength(1 + 200 + 1)
  // 205 files and the nested/ directory.
  expect(lines.at(-1)).toBe('(6 more entries.)')
})

test.each([
  {path: 'README', content: 'README is not a directory.', sha: 'sha-README'},
  {path: 'docs', content: 'docs does not exist at the pull request head.', sha: ''},
])('list_directory reports $path and records the lookup', async ({path, content, sha}) => {
  expect(await run(snapshot, 'list_directory', {path})).toEqual({content, read: {path, sha}})
})

test('read_definition returns the numbered lines of a named function', async () => {
  const output = await run(snapshot, 'read_definition', {path: 'src/cart.ts', name: 'total'})

  expect(output).toEqual({
    content: [
      'src/cart.ts: function total, lines 3-5:',
      'L3: export function total(items: number[]): number {',
      'L4:   return items.reduce((sum, item) => sum + item, 0)',
      'L5: }',
    ].join('\n'),
    read: {path: 'src/cart.ts', sha: 'sha-src/cart.ts'},
  })
})

test('read_definition finds a method by its dotted name', async () => {
  const output = await run(snapshot, 'read_definition', {path: 'src/cart.ts', name: 'Cart.add'})

  expect(output.content.split('\n')[0]).toBe('src/cart.ts: method Cart.add, lines 8-10:')
})

test('read_definition cuts a long definition', async () => {
  const body = Array.from({length: 250}, (_, index) => `  const v${index} = ${index}`).join('\n')
  const long = createSnapshot({'long.ts': {text: `function long() {\n${body}\n}\n`}})
  const lines = (await run(long, 'read_definition', {path: 'long.ts', name: 'long'})).content.split(
    '\n',
  )

  expect(lines[0]).toBe('long.ts: function long, lines 1-252:')
  expect(lines).toHaveLength(1 + 200 + 1)
  expect(lines.at(-1)).toBe('(52 more lines.)')
})

test('read_definition ends a Python definition on its last line', async () => {
  const text = 'def add(a, b):\n    return a + b\n\n\ndef sub(a, b):\n    return a - b\n'
  const python = createSnapshot({'tools.py': {text}})

  expect((await run(python, 'read_definition', {path: 'tools.py', name: 'sub'})).content).toBe(
    'tools.py: function sub, lines 5-6:\nL5: def sub(a, b):\nL6:     return a - b',
  )
})

test('read_definition shows 3 definitions with one name and lists the others', async () => {
  const text = [
    'export function pick(value: string): string',
    'export function pick(value: number): number',
    'export function pick(value: boolean): boolean',
    'export function pick(value: unknown): unknown {',
    '  return value',
    '}',
  ].join('\n')
  const overloads = createSnapshot({'pick.ts': {text}})
  const output = await run(overloads, 'read_definition', {path: 'pick.ts', name: 'pick'})

  expect(output.content.split('\n\n')).toEqual([
    'pick.ts: function pick, lines 1-1:\nL1: export function pick(value: string): string',
    'pick.ts: function pick#2, lines 2-2:\nL2: export function pick(value: number): number',
    'pick.ts: function pick#3, lines 3-3:\nL3: export function pick(value: boolean): boolean',
    '(1 more: pick#4 at lines 4-6.)',
  ])
})

test('read_definition lists the names in the file when none matches', async () => {
  const output = await run(snapshot, 'read_definition', {path: 'src/cart.ts', name: 'missing'})

  expect(output.content).toBe(
    'src/cart.ts has no definition named "missing". Names in the file: total, Cart, Cart.add',
  )
})

test('read_definition cuts a long name in the list of names', async () => {
  const name = 'a'.repeat(250)
  const long = createSnapshot({'long.ts': {text: `export function ${name}() {}\n`}})

  expect((await run(long, 'read_definition', {path: 'long.ts', name: 'missing'})).content).toBe(
    `long.ts has no definition named "missing". Names in the file: ${'a'.repeat(200)}...`,
  )
})

test('read_definition sends a file without a grammar to read_file', async () => {
  const output = await run(snapshot, 'read_definition', {path: 'README', name: 'hello'})

  expect(output).toEqual({
    content: 'read_definition does not support README. Use read_file.',
    read: {path: 'README', sha: 'sha-README'},
  })
})

test('read_definition sends a file too large to extract to read_file', async () => {
  const keys = Array.from({length: 2001}, (_, index) => `"k${index}": 0`)
  const large = createSnapshot({'large.json': {text: `{${keys.join(', ')}}`}})

  expect(await run(large, 'read_definition', {path: 'large.json', name: 'k0'})).toEqual({
    content: 'large.json is too large for read_definition. Use read_file.',
    read: {path: 'large.json', sha: 'sha-large.json'},
  })
})

test('read_definition reports a missing file', async () => {
  expect(await run(snapshot, 'read_definition', {path: 'src/gone.ts', name: 'x'})).toEqual({
    content: 'src/gone.ts does not exist at the pull request head.',
    read: {path: 'src/gone.ts', sha: ''},
  })
})

test.each([
  {name: 'read_file', input: {start_line: 1}},
  {name: 'list_directory', input: {}},
  {name: 'read_definition', input: {path: 'src/cart.ts', name: ''}},
])('$name reports invalid arguments without a read', async ({name, input}) => {
  const output = await run(snapshot, name, input)

  expect(output.content).toMatch(new RegExp(`^Invalid arguments for ${name}:`))
  expect(output.read).toBeUndefined()
})

test('a call with arguments that are not JSON reports invalid arguments', async () => {
  const output = await createReviewTools(snapshot).run({
    id: 'call',
    name: 'read_file',
    arguments: '{path:',
  })

  expect(output.content).toMatch(/^Invalid arguments for read_file:/)
})

test('a call to an unknown tool says that the tool does not exist', async () => {
  expect(await run(snapshot, 'delete_file', {path: 'src/cart.ts'})).toEqual({
    content: 'There is no tool named delete_file.',
  })
})

test.each([
  ['src/a.ts', 'src/a.ts'],
  ['/src/a.ts', 'src/a.ts'],
  ['./src/a.ts', 'src/a.ts'],
  [' src/ ', 'src'],
  ['.', ''],
  ['/', ''],
  ['', ''],
])('normalizePath(%j) is %j', (path, expected) => {
  expect(normalizePath(path)).toBe(expected)
})
