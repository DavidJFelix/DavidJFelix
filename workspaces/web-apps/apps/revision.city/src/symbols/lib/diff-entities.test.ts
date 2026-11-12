import {expect, test} from 'vitest'

import {diffEntities} from './diff-entities'

test('names the changed function rather than the changed lines', async () => {
  const oldSource = 'export function greet(name) {\n  return name\n}\n'
  const newSource = "export function greet(name) {\n  return 'hi ' + name\n}\n"

  const diff = await diffEntities({path: 'src/greet.ts', oldSource, newSource})

  expect(diff.language).toBe('typescript')
  expect(diff.changes).toMatchObject([{type: 'modified', qualifiedName: 'greet'}])
  expect(diff.summary.modified).toBe(1)
})

test('reports a pure reformat as no semantic change', async () => {
  const oldSource = 'export function greet(name) {\n  return name\n}\n'
  const newSource = 'export function greet(name) {\n\n      return name\n\n}\n'

  const diff = await diffEntities({path: 'src/greet.ts', oldSource, newSource})

  expect(diff.changes).toEqual([])
})

test('reports a comment-only edit as no semantic change', async () => {
  const oldSource = 'export function greet() {\n  // old note\n  return 1\n}\n'
  const newSource = 'export function greet() {\n  // a completely different note\n  return 1\n}\n'

  const diff = await diffEntities({path: 'src/greet.ts', oldSource, newSource})

  expect(diff.changes).toEqual([])
})

test('follows a method renamed inside its class', async () => {
  const oldSource = 'export class Widget {\n  render() {\n    return 1\n  }\n}\n'
  const newSource = 'export class Widget {\n  draw() {\n    return 1\n  }\n}\n'

  const diff = await diffEntities({path: 'src/widget.ts', oldSource, newSource})

  expect(diff.changes).toMatchObject([
    {type: 'renamed', qualifiedName: 'Widget.draw', previousQualifiedName: 'Widget.render'},
  ])
})

test('reports a Java field value edit as a modified field, not a rename', async () => {
  const oldSource = 'class A {\n  static final int MAX = 1;\n}\n'
  const newSource = 'class A {\n  static final int MAX = 2;\n}\n'

  const diff = await diffEntities({path: 'src/A.java', oldSource, newSource})

  expect(diff.changes).toMatchObject([{type: 'modified', kind: 'field', qualifiedName: 'A.MAX'}])
})

test('names a Go method by its receiver type', async () => {
  const oldSource =
    'package m\n\nfunc (a A) String() string {\n\treturn "a"\n}\n\nfunc (b B) String() string {\n\treturn "b"\n}\n'
  const newSource = oldSource.replace('"b"', '"bee"')

  const diff = await diffEntities({path: 'm.go', oldSource, newSource})

  expect(diff.changes).toMatchObject([
    {type: 'modified', kind: 'method', qualifiedName: 'B.String'},
  ])
})

test.each([
  {
    change: 'prototype',
    oldSource: 'int add(int a, int b);\n',
    newSource: 'long add(long a, long b);\n',
    kind: 'function',
    qualifiedName: 'add',
  },
  {
    change: 'global',
    oldSource: 'static int counter = 0;\n',
    newSource: 'static int counter = 1;\n',
    kind: 'variable',
    qualifiedName: 'counter',
  },
  {
    change: 'macro',
    oldSource: '#define LIMIT 10\n',
    newSource: '#define LIMIT 20\n',
    kind: 'macro',
    qualifiedName: 'LIMIT',
  },
])(
  'reports a changed C $change as one modified row',
  async ({oldSource, newSource, kind, qualifiedName}) => {
    const diff = await diffEntities({path: 'limits.c', oldSource, newSource})

    expect(diff.changes).toMatchObject([{type: 'modified', kind, qualifiedName}])
    expect(diff.changes).toHaveLength(1)
  },
)

test('reports a changed C include as no row', async () => {
  const diff = await diffEntities({
    path: 'main.c',
    oldSource: '#include <stdio.h>\n',
    newSource: '#include <stdlib.h>\n',
  })

  expect(diff.changes).toEqual([])
})

test('reports a changed C local declaration against its function only', async () => {
  const oldSource = 'int main(void) {\n  int local = 1;\n  return local;\n}\n'
  const newSource = oldSource.replace('= 1', '= 2')

  const diff = await diffEntities({path: 'main.c', oldSource, newSource})

  expect(diff.changes).toMatchObject([{type: 'modified', kind: 'function', qualifiedName: 'main'}])
  expect(diff.changes).toHaveLength(1)
})

test('reports a body edit of a C function that has a prototype against the definition', async () => {
  const oldSource = 'int add(int a, int b);\n\nint add(int a, int b) {\n  return a + b;\n}\n'
  const newSource = oldSource.replace('a + b', 'b + a')

  const diff = await diffEntities({path: 'add.c', oldSource, newSource})

  expect(diff.changes).toMatchObject([{type: 'modified', kind: 'function', qualifiedName: 'add#2'}])
  expect(diff.changes).toHaveLength(1)
})

test('names the dependency that changed in a manifest', async () => {
  const oldSource = '{"dependencies": {"react": "18.0.0", "zod": "4.0.0"}}'
  const newSource = '{"dependencies": {"react": "19.0.0", "zod": "4.0.0"}}'

  const diff = await diffEntities({path: 'package.json', oldSource, newSource})

  expect(diff.changes).toMatchObject([{type: 'modified', qualifiedName: 'dependencies.react'}])
})

test('names the default export of a config file when its options change', async () => {
  const oldSource = 'export default defineConfig({server: {port: 3000}})\n'
  const newSource = 'export default defineConfig({server: {port: 4000}})\n'

  const diff = await diffEntities({path: 'vite.config.ts', oldSource, newSource})

  expect(diff.changes).toMatchObject([
    {type: 'modified', kind: 'constant', qualifiedName: 'default'},
  ])
})

test('reports only the entity that changed, not the ones enclosing it', async () => {
  const oldSource = 'export class Widget {\n  render() {\n    return 1\n  }\n}\n'
  const newSource = 'export class Widget {\n  render() {\n    return 2\n  }\n}\n'

  const diff = await diffEntities({path: 'src/widget.ts', oldSource, newSource})

  expect(diff.changes).toMatchObject([{type: 'modified', qualifiedName: 'Widget.render'}])
})

test('reports a new struct parameter as a change to its function only', async () => {
  const oldSource = 'void handle(int code) {\n  use(code);\n}\n'
  const newSource = 'void handle(int code, struct request *req) {\n  use(code);\n}\n'

  const diff = await diffEntities({path: 'src/handle.c', oldSource, newSource})

  expect(diff.changes).toMatchObject([
    {type: 'modified', kind: 'function', qualifiedName: 'handle'},
  ])
})

// The cspell.jsonc shape that once cascaded: objects in an array all carry the
// same keys, so their entities collide on qualified name and an insertion used
// to shift every later sibling's ordinal into a bogus modified row.
test('reports an array insertion as one edit per array, not a cascade', async () => {
  const oldSource = `{
  "dictionaries": ["dns", "ics", "licenses"],
  "dictionaryDefinitions": [
    {"name": "dns", "path": "dns.txt"},
    {"name": "licenses", "path": "licenses.txt"},
    {"name": "pierre", "path": "pierre.txt"}
  ],
  "words": ["burndown", "codegen", "frontmatter"]
}`
  const newSource = `{
  "dictionaries": ["dns", "ics", "lezer", "licenses"],
  "dictionaryDefinitions": [
    {"name": "dns", "path": "dns.txt"},
    {"name": "lezer", "path": "lezer.txt"},
    {"name": "licenses", "path": "licenses.txt"},
    {"name": "pierre", "path": "pierre.txt"}
  ],
  "words": ["burndown", "ciphertext", "codegen", "frontmatter"]
}`

  const diff = await diffEntities({path: '.config/cspell.json', oldSource, newSource})

  expect(diff.changes.map((change) => `${change.type}:${change.qualifiedName}`)).toEqual([
    'modified:dictionaries',
    'modified:dictionaryDefinitions',
    'modified:words',
  ])
  const definitions = diff.changes.find(
    (change) => change.qualifiedName === 'dictionaryDefinitions',
  )
  expect(definitions?.detail).toMatchObject({
    lengthBefore: 3,
    lengthAfter: 4,
    edits: [{type: 'inserted', index: 1, preview: '{"name": "lezer", "path": "lezer.txt"}'}],
  })
  const words = diff.changes.find((change) => change.qualifiedName === 'words')
  expect(words?.detail?.edits).toMatchObject([
    {type: 'inserted', index: 1, preview: '"ciphertext"'},
  ])
})

test('reports an added test once, not once per local inside its callback', async () => {
  const oldSource = "test('first', () => {\n  const value = 1\n  expect(value).toBe(1)\n})\n"
  const newSource = `${oldSource}test('second', () => {\n  const other = 2\n  expect(other).toBe(2)\n})\n`

  const diff = await diffEntities({path: 'src/example.test.ts', oldSource, newSource})

  expect(diff.changes).toMatchObject([
    {type: 'added', kind: 'call', qualifiedName: "test('second')"},
  ])
})

test('reports an unknown extension as an unsupported language', async () => {
  const diff = await diffEntities({path: 'notes.bin', oldSource: 'a', newSource: 'b'})

  expect(diff).toEqual({
    path: 'notes.bin',
    language: null,
    changes: [],
    summary: {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0},
  })
})

test('declines to report on a file with more entities than the cap', async () => {
  const entries = Array.from({length: 2500}, (_, index) => `"key${index}": ${index}`).join(',')
  const oldSource = `{${entries}}`
  const newSource = `{${entries.replace('"key0": 0', '"key0": 99')}}`

  const diff = await diffEntities({path: 'generated.json', oldSource, newSource})

  expect(diff.language).toBe('json')
  expect(diff.changes).toEqual([])
})

test('orders changes by bucket then by position in the new file', async () => {
  const oldSource =
    'export function stays() {\n  return 1\n}\nexport function goes() {\n  return 2\n}\n'
  const newSource =
    'export function stays() {\n  return 100\n}\nexport function arrives() {\n  return 3\n}\n'

  const diff = await diffEntities({path: 'src/order.ts', oldSource, newSource})

  expect(diff.changes.map((change) => `${change.type}:${change.qualifiedName}`)).toEqual([
    'added:arrives',
    'modified:stays',
    'deleted:goes',
  ])
})
