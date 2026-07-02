import {expect, test} from 'bun:test'
import {
  moduleSlug,
  pkgdogSpecifier,
  planDecomposition,
  sanitizeBase,
  subpathSlug,
} from './decompose.ts'
import {buildModuleGraph, type SourceFile} from './module-graph.ts'

const upstream = {jsrName: '@std/collections', version: '1.3.0'}

function planOf(files: SourceFile[], exportEntries: [string, string][]) {
  const graph = buildModuleGraph(files, new Map())
  return planDecomposition({
    graph,
    exports: new Map(exportEntries.map(([subpath, runtime]) => [subpath, {runtime}])),
    upstream,
  })
}

test('independent entries become independent single-module parts', () => {
  const plan = planOf(
    [
      {path: 'a.js', text: 'export const a = 1\n'},
      {path: 'b.js', text: 'export const b = 2\n'},
    ],
    [
      ['./a', 'a.js'],
      ['./b', 'b.js'],
    ],
  )
  expect(plan.parts.map((p) => p.name)).toEqual([
    '@pkgdog/std__collections__a',
    '@pkgdog/std__collections__b',
  ])
  expect(plan.parts.every((p) => p.partDeps.length === 0)).toBe(true)
})

test('a barrel entry is skipped, not turned into a part', () => {
  const plan = planOf(
    [
      {path: 'mod.js', text: 'export * from "./a.js"\nexport * from "./b.js"\n'},
      {path: 'a.js', text: 'export const a = 1\n'},
      {path: 'b.js', text: 'export const b = 2\n'},
    ],
    [
      ['.', 'mod.js'],
      ['./a', 'a.js'],
      ['./b', 'b.js'],
    ],
  )
  expect(plan.skipped).toEqual([{subpath: '.', reason: 'barrel (re-export aggregator)'}])
  expect(plan.parts).toHaveLength(2)
})

test('importing another entry becomes a part dependency, not a bundled copy', () => {
  const plan = planOf(
    [
      {path: 'agg.js', text: 'import {m} from "./map.js"\nexport const agg = m\n'},
      {path: 'map.js', text: 'export const m = 1\n'},
    ],
    [
      ['./agg', 'agg.js'],
      ['./map', 'map.js'],
    ],
  )
  const agg = plan.parts.find((p) => p.name.endsWith('__agg'))
  expect(agg?.modules).toEqual(['agg.js'])
  expect(agg?.partDeps).toEqual(['@pkgdog/std__collections__map'])
})

test('an internal module used by one entry is bundled into that part', () => {
  const plan = planOf(
    [
      {path: 'a.js', text: 'import {h} from "./_helper.js"\nexport const a = h\n'},
      {path: '_helper.js', text: 'export const h = 1\n'},
    ],
    [['./a', 'a.js']],
  )
  expect(plan.parts).toHaveLength(1)
  expect(plan.parts[0]?.modules).toEqual(['_helper.js', 'a.js'])
})

test('an internal module shared by two entries moves to a shared internal part', () => {
  const plan = planOf(
    [
      {path: 'a.js', text: 'import {h} from "./_shared.js"\nexport const a = h\n'},
      {path: 'b.js', text: 'import {h} from "./_shared.js"\nexport const b = h\n'},
      {path: '_shared.js', text: 'export const h = 1\n'},
    ],
    [
      ['./a', 'a.js'],
      ['./b', 'b.js'],
    ],
  )
  const internal = plan.parts.find((p) => p.kind === 'internal')
  expect(internal?.name).toBe('@pkgdog/std__collections__-internal-shared')
  expect(internal?.modules).toEqual(['_shared.js'])
  const partA = plan.parts.find((p) => p.name.endsWith('__a'))
  expect(partA?.modules).toEqual(['a.js'])
  expect(partA?.partDeps).toEqual(['@pkgdog/std__collections__-internal-shared'])
})

test('mutually-cyclic entries merge into one part', () => {
  const plan = planOf(
    [
      {path: 'a.js', text: 'import {b} from "./b.js"\nexport const a = () => b\n'},
      {path: 'b.js', text: 'import {a} from "./a.js"\nexport const b = () => a\n'},
    ],
    [
      ['./a', 'a.js'],
      ['./b', 'b.js'],
    ],
  )
  expect(plan.parts).toHaveLength(1)
  expect(plan.parts[0]?.name).toBe('@pkgdog/std__collections__a--b')
  expect(plan.parts[0]?.modules).toEqual(['a.js', 'b.js'])
  expect(plan.parts[0]?.subpaths).toEqual(['./a', './b'])
})

test('a dependency boundary is not traversed: the dep part keeps its own internals', () => {
  const plan = planOf(
    [
      {path: 'a.js', text: 'import {b} from "./b.js"\nexport const a = b\n'},
      {path: 'b.js', text: 'import {h} from "./_h.js"\nexport const b = h\n'},
      {path: '_h.js', text: 'export const h = 1\n'},
    ],
    [
      ['./a', 'a.js'],
      ['./b', 'b.js'],
    ],
  )
  const partA = plan.parts.find((p) => p.name.endsWith('__a'))
  const partB = plan.parts.find((p) => p.name.endsWith('__b'))
  // a must not bundle b's private helper just because it reaches it through b.
  expect(partA?.modules).toEqual(['a.js'])
  expect(partA?.partDeps).toEqual(['@pkgdog/std__collections__b'])
  expect(partB?.modules).toEqual(['_h.js', 'b.js'])
})

test('a merged cyclic part is addressable per original subpath by its dependents', () => {
  const plan = planOf(
    [
      {path: 'a.js', text: 'import {b} from "./b.js"\nexport const a = () => b\n'},
      {path: 'b.js', text: 'import {a} from "./a.js"\nexport const b = () => a\n'},
      {path: 'd.js', text: 'import {a} from "./a.js"\nexport const d = a\n'},
    ],
    [
      ['./a', 'a.js'],
      ['./b', 'b.js'],
      ['./d', 'd.js'],
    ],
  )
  // d imports a, which lives inside the merged a--b part; the rewrite target
  // must address that specific entry via its subpath alias.
  expect(plan.moduleSpecifier['a.js']).toBe('@pkgdog/std__collections__a--b/a')
  const partD = plan.parts.find((p) => p.name.endsWith('__d'))
  expect(partD?.partDeps).toEqual(['@pkgdog/std__collections__a--b'])
})

test('a root entry with its own exports becomes the bare package part, not a skipped barrel', () => {
  const plan = planOf([{path: 'mod.js', text: 'export const solo = 1\n'}], [['.', 'mod.js']])
  expect(plan.skipped).toEqual([])
  expect(plan.parts[0]?.name).toBe('@pkgdog/std__collections')
  expect(Object.keys(plan.parts[0]?.exportsMap ?? {})).toEqual(['.'])
})

test('a module that re-exports two entries but also exports its own code is not a barrel', () => {
  const plan = planOf(
    [
      {
        path: 'mix.js',
        text: 'export * from "./a.js"\nexport * from "./b.js"\nexport const own = 1\n',
      },
      {path: 'a.js', text: 'export const a = 1\n'},
      {path: 'b.js', text: 'export const b = 2\n'},
    ],
    [
      ['./mix', 'mix.js'],
      ['./a', 'a.js'],
      ['./b', 'b.js'],
    ],
  )
  expect(plan.skipped).toEqual([])
  const mix = plan.parts.find((p) => p.name.endsWith('__mix'))
  expect(mix?.partDeps).toEqual(['@pkgdog/std__collections__a', '@pkgdog/std__collections__b'])
})

test('single-subpath parts expose both dot and the original subpath alias', () => {
  const plan = planOf([{path: 'a.js', text: 'export const a = 1\n'}], [['./a', 'a.js']])
  expect(
    Object.keys(plan.parts[0]?.exportsMap ?? {}).toSorted((x, y) => x.localeCompare(y, 'en')),
  ).toEqual(['.', './a'])
})

test('external bare imports are carried onto the part', () => {
  const plan = planOf(
    [{path: 'a.js', text: 'import {eq} from "@std/assert"\nexport const a = eq\n'}],
    [['./a', 'a.js']],
  )
  expect(plan.parts[0]?.externals).toEqual(['@std/assert'])
})

test('name and slug helpers normalize JSR names and paths', () => {
  expect(sanitizeBase('@std/collections')).toBe('std__collections')
  expect(subpathSlug('.')).toBe('')
  expect(subpathSlug('./drop-while')).toBe('drop-while')
  expect(subpathSlug('./x/y')).toBe('x__y')
  expect(moduleSlug('_dist/map_entries.js')).toBe('map-entries')
  expect(moduleSlug('_utils.js')).toBe('utils')
})

test('mangled npm-compat names reverse into pkgdog: specifiers', () => {
  expect(pkgdogSpecifier('@pkgdog/std__collections__chunk')).toBe('pkgdog:@std/collections/chunk')
  expect(pkgdogSpecifier('@pkgdog/std__collections')).toBe('pkgdog:@std/collections')
  expect(pkgdogSpecifier('@pkgdog/std__collections__x__y')).toBe('pkgdog:@std/collections/x/y')
})
