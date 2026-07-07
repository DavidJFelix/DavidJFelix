import {expect, test} from 'bun:test'
import {collectBiomeFired, collectOxlintFired, findMisses, fixtureName} from './lint-parity.ts'

test('fixtureName strips everything up to the fixtures dir', () => {
  expect(fixtureName('.config/lint-parity/fixtures/suspicious__noVar.js')).toBe(
    'suspicious__noVar.js',
  )
  expect(fixtureName('C:\\repo\\fixtures\\a.css')).toBe('a.css')
  expect(fixtureName('no-marker.js')).toBe('no-marker.js')
})

test('collectOxlintFired groups rule codes per fixture', () => {
  const fired = collectOxlintFired([
    {filename: 'fixtures/a.js', code: 'eslint(no-var)'},
    {filename: 'fixtures/a.js', code: 'eslint(no-debugger)'},
    {filename: 'fixtures/b.js', code: 'eslint(no-var)'},
  ])
  expect(fired.get('a.js')).toEqual(new Set(['eslint(no-var)', 'eslint(no-debugger)']))
  expect(fired.get('b.js')).toEqual(new Set(['eslint(no-var)']))
})

test('collectBiomeFired reads both path shapes and skips null categories', () => {
  const fired = collectBiomeFired([
    {category: 'lint/suspicious/noVar', location: {path: {file: 'fixtures/a.js'}}},
    {category: 'lint/correctness/noUnknownUnit', location: {path: 'fixtures/b.css'}},
    {category: null, location: {path: {file: 'fixtures/a.js'}}},
    {category: 'parse', location: {path: null}},
  ])
  expect(fired.get('a.js')).toEqual(new Set(['lint/suspicious/noVar']))
  expect(fired.get('b.css')).toEqual(new Set(['lint/correctness/noUnknownUnit']))
})

test('findMisses reports entries whose expected code did not fire', () => {
  const manifest = {
    noVar: {file: 'a.js', engine: 'oxlint' as const, expect: 'eslint(no-var)'},
    noUnknownUnit: {
      file: 'b.css',
      engine: 'biome' as const,
      expect: 'lint/correctness/noUnknownUnit',
    },
  }
  const oxlint = collectOxlintFired([{filename: 'fixtures/a.js', code: 'eslint(no-var)'}])
  const biome = collectBiomeFired([])
  const misses = findMisses(manifest, {oxlint, biome})
  expect(misses).toHaveLength(1)
  expect(misses[0]?.rule).toBe('noUnknownUnit')
})
