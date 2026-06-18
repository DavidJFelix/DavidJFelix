import {expect, test} from 'vitest'
import {
  ATPROTO_DID,
  documentRkey,
  documentUri,
  PUBLICATION_RKEY,
  publicationUri,
} from './standard-site'

test('documentRkey returns a valid post slug unchanged', () => {
  expect(documentRkey('2025-12-07-on-running')).toBe('2025-12-07-on-running')
})

test('documentRkey accepts the full allowed rkey character set', () => {
  expect(documentRkey('aZ0.-_:~')).toBe('aZ0.-_:~')
})

test('documentRkey rejects an empty slug', () => {
  expect(() => documentRkey('')).toThrow()
})

test('documentRkey rejects characters outside the rkey charset', () => {
  expect(() => documentRkey('has space')).toThrow()
  expect(() => documentRkey('slash/slug')).toThrow()
})

test('documentRkey rejects the . and .. relative keys', () => {
  expect(() => documentRkey('.')).toThrow()
  expect(() => documentRkey('..')).toThrow()
})

test('documentRkey rejects slugs longer than 512 characters', () => {
  expect(() => documentRkey('a'.repeat(513))).toThrow()
})

test('publicationUri builds the at:// URI for the self publication record', () => {
  expect(publicationUri()).toBe(`at://${ATPROTO_DID}/site.standard.publication/${PUBLICATION_RKEY}`)
})

test('documentUri builds the at:// URI for a post slug', () => {
  expect(documentUri('2025-12-07-on-running')).toBe(
    `at://${ATPROTO_DID}/site.standard.document/2025-12-07-on-running`,
  )
})

test('documentUri propagates rkey validation for a malformed slug', () => {
  expect(() => documentUri('bad slug')).toThrow()
})
