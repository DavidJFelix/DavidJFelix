import {expect, test} from 'bun:test'
import {toNpmCompatName} from './registry.ts'

test('toNpmCompatName mangles a scoped JSR name the way npm.jsr.io expects', () => {
  expect(toNpmCompatName('@std/collections')).toBe('@jsr/std__collections')
  expect(toNpmCompatName('@dog/park')).toBe('@jsr/dog__park')
})

test('toNpmCompatName rejects unscoped names instead of guessing', () => {
  expect(() => toNpmCompatName('lodash')).toThrow('not a scoped JSR name')
})
