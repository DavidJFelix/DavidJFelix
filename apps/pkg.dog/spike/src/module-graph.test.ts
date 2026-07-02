import {expect, test} from 'bun:test'
import {
  buildModuleGraph,
  resolveRelative,
  scanRuntimeModule,
  scanTypesModule,
} from './module-graph.ts'

test('scanRuntimeModule reports imports, re-exports, and own exports', () => {
  const {specifiers, ownExports} = scanRuntimeModule(
    'import {a} from "./a.js"\nexport * from "./b.js"\nexport function mine() {}\n',
  )
  expect(specifiers.toSorted((x, y) => x.localeCompare(y, 'en'))).toEqual(['./a.js', './b.js'])
  expect(ownExports).toEqual(['mine'])
})

test('scanTypesModule keeps type-only imports that Bun would erase', () => {
  const specifiers = scanTypesModule(
    'import type {Foo} from "./foo.d.ts"\nexport declare function bar(f: Foo): void\n',
  )
  expect(specifiers).toEqual(['./foo.d.ts'])
})

test('scanTypesModule ignores imports inside JSDoc examples', () => {
  const specifiers = scanTypesModule(
    '/**\n * @example\n * ```ts\n * import {y} from "@std/collections/y"\n * ```\n */\nexport declare function x(): void\n',
  )
  expect(specifiers).toEqual([])
})

test('resolveRelative resolves against the importing file directory', () => {
  expect(resolveRelative('_dist/a.d.ts', './b.d.ts')).toBe('_dist/b.d.ts')
  expect(resolveRelative('_dist/a.d.ts', '../b.js')).toBe('b.js')
  expect(resolveRelative('a.js', './b.js')).toBe('b.js')
})

test('buildModuleGraph links runtime imports and pairs types files', () => {
  const graph = buildModuleGraph(
    [
      {path: 'a.js', text: 'import {b} from "./b.js"\nexport const a = () => b\n'},
      {path: 'b.js', text: 'export const b = 1\n'},
      {path: '_dist/a.d.ts', text: 'import type {B} from "./b.d.ts"\nexport declare const a: B\n'},
      {path: '_dist/b.d.ts', text: 'export declare type B = number\nexport declare const b: B\n'},
    ],
    new Map([
      ['a.js', '_dist/a.d.ts'],
      ['b.js', '_dist/b.d.ts'],
    ]),
  )
  const a = graph.modules.get('a.js')
  expect(a?.typesPath).toBe('_dist/a.d.ts')
  expect([...(a?.internalImports ?? [])]).toEqual(['b.js'])
  expect(graph.modules.get('b.js')?.internalImports.size).toBe(0)
})

test('buildModuleGraph flags re-export-only barrels', () => {
  const graph = buildModuleGraph(
    [
      {path: 'mod.js', text: 'export * from "./a.js"\nexport * from "./b.js"\n'},
      {path: 'a.js', text: 'export const a = 1\n'},
      {path: 'b.js', text: 'export const b = 2\n'},
    ],
    new Map(),
  )
  expect(graph.modules.get('mod.js')?.isBarrel).toBe(true)
  expect(graph.modules.get('a.js')?.isBarrel).toBe(false)
})

test('buildModuleGraph records bare specifiers as external imports', () => {
  const graph = buildModuleGraph(
    [{path: 'a.js', text: 'import {eq} from "@std/assert"\nexport const a = eq\n'}],
    new Map(),
  )
  expect([...(graph.modules.get('a.js')?.externalImports ?? [])]).toEqual(['@std/assert'])
})
