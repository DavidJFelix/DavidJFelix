import {expect, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {planDecomposition} from './decompose.ts'
import {emitParts, externalPackageName, rewriteCrossPartImports} from './emit.ts'
import {buildModuleGraph} from './module-graph.ts'
import type {UpstreamPackage} from './registry.ts'

test('externalPackageName strips subpaths but keeps scopes', () => {
  expect(externalPackageName('@std/assert/equals')).toBe('@std/assert')
  expect(externalPackageName('@std/assert')).toBe('@std/assert')
  expect(externalPackageName('foo/bar/baz')).toBe('foo')
  expect(externalPackageName('foo')).toBe('foo')
})

const rewritePlan = {
  parts: [],
  skipped: [],
  moduleToPart: {'a.js': '@pkgdog/x__y__a', 'b.js': '@pkgdog/x__y__b'},
  moduleSpecifier: {'a.js': '@pkgdog/x__y__a', 'b.js': '@pkgdog/x__y__b'},
}
const rewritePartA = {
  name: '@pkgdog/x__y__a',
  kind: 'export' as const,
  subpaths: ['./a'],
  modules: ['a.js'],
  partDeps: ['@pkgdog/x__y__b'],
  externals: [],
  exportsMap: {},
}

test('rewriteCrossPartImports rewrites cross-part specifiers in both quote styles', () => {
  const rewritten = rewriteCrossPartImports(
    `import {b} from "./b.js"\nimport {c} from './b.js'\nexport const a = [b, c]\n`,
    'a.js',
    rewritePartA,
    rewritePlan,
  )
  expect(rewritten).toContain('from "@pkgdog/x__y__b"')
  expect(rewritten).toContain(`from '@pkgdog/x__y__b'`)
  expect(rewritten).not.toContain('./b.js')
})

test('rewriteCrossPartImports leaves own-module and bare imports untouched', () => {
  const source = 'import {a2} from "./a.js"\nimport {eq} from "@std/assert"\nexport const a = 1\n'
  expect(rewriteCrossPartImports(source, 'other.js', rewritePartA, rewritePlan)).toBe(source)
})

test('rewriteCrossPartImports maps d.ts type imports back to the runtime module owner', () => {
  const rewritten = rewriteCrossPartImports(
    'import type {B} from "../b.d.ts"\nexport declare const a: B\n',
    '_dist/a.d.ts',
    rewritePartA,
    rewritePlan,
  )
  expect(rewritten).toContain('from "@pkgdog/x__y__b"')
})

async function emitFixture(): Promise<{dir: string; outDir: string; cleanup: () => Promise<void>}> {
  const dir = await mkdtemp(join(tmpdir(), 'pkgdog-emit-'))
  const upstreamDir = join(dir, 'package')
  await Bun.write(join(upstreamDir, 'a.js'), 'import {b} from "./b.js"\nexport const a = () => b\n')
  await Bun.write(join(upstreamDir, 'b.js'), 'export const b = 1\n')
  await Bun.write(join(upstreamDir, '_dist/a.d.ts'), 'export declare const a: () => number\n')
  await Bun.write(join(upstreamDir, 'LICENSE'), 'MIT-ish demo license\n')
  return {
    dir: upstreamDir,
    outDir: join(dir, 'out'),
    cleanup: () => rm(dir, {recursive: true, force: true}),
  }
}

function fixtureUpstream(dir: string): UpstreamPackage {
  return {
    jsrName: '@demo/pack',
    npmName: '@jsr/demo__pack',
    version: '2.0.0',
    dir,
    packageJson: {
      name: '@jsr/demo__pack',
      version: '2.0.0',
      license: 'MIT',
      exports: {
        './a': {types: './_dist/a.d.ts', default: './a.js'},
        './b': './b.js',
      },
    },
  }
}

async function emittedFixtureParts() {
  const fixture = await emitFixture()
  const files = []
  for (const path of ['a.js', 'b.js', '_dist/a.d.ts']) {
    files.push({path, text: await Bun.file(join(fixture.dir, path)).text()})
  }
  const graph = buildModuleGraph(files, new Map([['a.js', '_dist/a.d.ts']]))
  const plan = planDecomposition({
    graph,
    exports: new Map([
      ['./a', {runtime: 'a.js', types: '_dist/a.d.ts'}],
      ['./b', {runtime: 'b.js'}],
    ]),
    upstream: {jsrName: '@demo/pack', version: '2.0.0'},
  })
  const emitted = await emitParts(plan, fixtureUpstream(fixture.dir), fixture.outDir)
  return {fixture, emitted}
}

test('emitParts writes installable part packages with rewritten cross-part imports', async () => {
  const {fixture, emitted} = await emittedFixtureParts()

  const partA = emitted.find((e) => e.part.name === '@pkgdog/demo__pack__a')
  expect(partA).toBeDefined()
  const emittedA = await Bun.file(join(partA?.dir as string, 'a.js')).text()
  expect(emittedA).toContain('from "@pkgdog/demo__pack__b"')

  const packageJson = (await Bun.file(join(partA?.dir as string, 'package.json')).json()) as {
    name: string
    version: string
    type: string
    license: string
    exports: Record<string, {types?: string; default: string}>
    dependencies: Record<string, string>
    pkgdog: {upstream: {name: string; version: string}; subpaths: string[]}
  }
  expect(packageJson.name).toBe('@pkgdog/demo__pack__a')
  expect(packageJson.version).toBe('2.0.0')
  expect(packageJson.type).toBe('module')
  expect(packageJson.license).toBe('MIT')
  expect(packageJson.exports['.']).toEqual({types: './_dist/a.d.ts', default: './a.js'})
  expect(packageJson.exports['./a']).toEqual({types: './_dist/a.d.ts', default: './a.js'})
  expect(packageJson.dependencies).toEqual({'@pkgdog/demo__pack__b': '2.0.0'})
  expect(packageJson.pkgdog.upstream).toEqual({
    name: '@demo/pack',
    version: '2.0.0',
    registry: 'jsr',
  })
  expect(packageJson.pkgdog.subpaths).toEqual(['./a'])

  const typesEmitted = await Bun.file(join(partA?.dir as string, '_dist/a.d.ts')).exists()
  expect(typesEmitted).toBe(true)
  const licenseEmitted = await Bun.file(join(partA?.dir as string, 'LICENSE')).text()
  expect(licenseEmitted).toBe('MIT-ish demo license\n')

  await fixture.cleanup()
})

test('emitParts tolerates a module with no declaration file at all', async () => {
  const {fixture, emitted} = await emittedFixtureParts()

  // b.js has no d.ts anywhere -- emit must not invent or crash on one.
  const partB = emitted.find((e) => e.part.name === '@pkgdog/demo__pack__b')
  expect(await Bun.file(join(partB?.dir as string, 'b.js')).exists()).toBe(true)
  const packageJson = (await Bun.file(join(partB?.dir as string, 'package.json')).json()) as {
    exports: Record<string, {types?: string; default: string}>
    dependencies?: Record<string, string>
  }
  expect(packageJson.exports['.']).toEqual({default: './b.js'})
  expect(packageJson.dependencies).toBeUndefined()

  await fixture.cleanup()
})
