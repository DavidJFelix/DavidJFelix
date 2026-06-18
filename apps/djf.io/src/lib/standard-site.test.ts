import {expect, test} from 'vitest'
import {
  ATPROTO_DID,
  atUri,
  DOCUMENT_COLLECTION,
  documentPath,
  type ExistingRecord,
  isTid,
  PUBLICATION_COLLECTION,
  PUBLICATION_RKEY,
  planDocumentActions,
  publicationUri,
  rkeyFromUri,
} from './standard-site'

const TID_A = '3moldv46oucwc'
const TID_B = '3jzfcijpj2z2a'

test('isTid accepts a 13-char base32-sortable TID', () => {
  expect(isTid(TID_A)).toBe(true)
  expect(isTid(TID_B)).toBe(true)
})

test('isTid rejects non-TID record keys', () => {
  // Derived from TID_A so no new opaque fragments enter the spell dictionary.
  expect(isTid('self')).toBe(false) // the legacy publication rkey
  expect(isTid('2024-04-26-on-positivity')).toBe(false) // the legacy slug rkey
  expect(isTid(TID_A.slice(1))).toBe(false) // 12 chars, too short
  expect(isTid(`${TID_A}2`)).toBe(false) // 14 chars, too long
  expect(isTid(`1${TID_A.slice(1)}`)).toBe(false) // leading char outside the charset
  expect(isTid(TID_A.toUpperCase())).toBe(false) // uppercase
})

test('documentPath builds the /blog/<slug>/ path', () => {
  expect(documentPath('2025-12-07-on-running')).toBe('/blog/2025-12-07-on-running/')
})

test('rkeyFromUri extracts the trailing record key', () => {
  expect(rkeyFromUri(`at://${ATPROTO_DID}/${DOCUMENT_COLLECTION}/${TID_A}`)).toBe(TID_A)
})

test('atUri assembles an at:// URI from collection and rkey', () => {
  expect(atUri(DOCUMENT_COLLECTION, TID_A)).toBe(
    `at://${ATPROTO_DID}/site.standard.document/${TID_A}`,
  )
})

test('publicationUri uses the committed publication TID constant', () => {
  expect(publicationUri()).toBe(`at://${ATPROTO_DID}/${PUBLICATION_COLLECTION}/${PUBLICATION_RKEY}`)
})

const docA = {slug: 'a', path: '/blog/a/', record: {title: 'A'}}
const docB = {slug: 'b', path: '/blog/b/', record: {title: 'B'}}

test('planDocumentActions creates a record for a post with none', () => {
  expect(planDocumentActions([], [docA])).toEqual([
    {kind: 'create', slug: 'a', record: {title: 'A'}},
  ])
})

test('planDocumentActions updates an existing TID record matched by path', () => {
  const existing: Array<ExistingRecord> = [{rkey: TID_A, path: '/blog/a/'}]
  expect(planDocumentActions(existing, [docA])).toEqual([
    {kind: 'update', rkey: TID_A, slug: 'a', record: {title: 'A'}},
  ])
})

test('planDocumentActions ignores a legacy slug-keyed record and creates a TID one', () => {
  const existing: Array<ExistingRecord> = [{rkey: 'a', path: '/blog/a/'}] // old non-TID rkey
  expect(planDocumentActions(existing, [docA])).toEqual([
    {kind: 'create', slug: 'a', record: {title: 'A'}},
  ])
})

test('planDocumentActions reuses the first valid TID when a path has duplicates', () => {
  const existing: Array<ExistingRecord> = [
    {rkey: TID_A, path: '/blog/a/'},
    {rkey: TID_B, path: '/blog/a/'},
  ]
  expect(planDocumentActions(existing, [docA])).toEqual([
    {kind: 'update', rkey: TID_A, slug: 'a', record: {title: 'A'}},
  ])
})

test('planDocumentActions ignores records whose path matches no post (no deletes)', () => {
  const existing: Array<ExistingRecord> = [
    {rkey: TID_B, path: '/blog/gone/'},
    {rkey: 'legacy', path: undefined},
  ]
  expect(planDocumentActions(existing, [docA])).toEqual([
    {kind: 'create', slug: 'a', record: {title: 'A'}},
  ])
})

test('planDocumentActions handles a mix across posts', () => {
  const existing: Array<ExistingRecord> = [
    {rkey: TID_A, path: '/blog/a/'}, // valid TID -> update
    {rkey: 'b', path: '/blog/b/'}, // legacy -> create
  ]
  expect(planDocumentActions(existing, [docA, docB])).toEqual([
    {kind: 'update', rkey: TID_A, slug: 'a', record: {title: 'A'}},
    {kind: 'create', slug: 'b', record: {title: 'B'}},
  ])
})
