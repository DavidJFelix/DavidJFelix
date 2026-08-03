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

test('names the dependency that changed in a manifest', async () => {
  const oldSource = '{"dependencies": {"react": "18.0.0", "zod": "4.0.0"}}'
  const newSource = '{"dependencies": {"react": "19.0.0", "zod": "4.0.0"}}'

  const diff = await diffEntities({path: 'package.json', oldSource, newSource})

  expect(diff.changes).toMatchObject([{type: 'modified', qualifiedName: 'dependencies.react'}])
})

test('reports only the entity that changed, not the ones enclosing it', async () => {
  const oldSource = 'export class Widget {\n  render() {\n    return 1\n  }\n}\n'
  const newSource = 'export class Widget {\n  render() {\n    return 2\n  }\n}\n'

  const diff = await diffEntities({path: 'src/widget.ts', oldSource, newSource})

  expect(diff.changes).toMatchObject([{type: 'modified', qualifiedName: 'Widget.render'}])
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
