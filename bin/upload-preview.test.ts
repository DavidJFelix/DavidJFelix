import {expect, test} from 'bun:test'
import {parsePreviewUrl} from './upload-preview'

test('constructs the deterministic alias URL from the subdomain wrangler printed', () => {
  const stdout = [
    'Total Upload: 12.34 KiB / gzip: 4.56 KiB',
    'Worker Version ID: 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    'Version Preview URL: https://1a2b3c4d-calendar-visualizer.felixdj.workers.dev',
    '',
  ].join('\n')

  expect(parsePreviewUrl(stdout, {prNumber: '42', workerName: 'calendar-visualizer'})).toBe(
    'https://pr-42-calendar-visualizer.felixdj.workers.dev/',
  )
})

test('uses the requested worker name, not the one in the printed version URL', () => {
  // The printed URL carries a version-id prefix; we always rebuild from the
  // alias + the worker name we were given, so a different worker name wins.
  const stdout = 'Version Preview URL: https://deadbeef-djf-io.felixdj.workers.dev\n'
  expect(parsePreviewUrl(stdout, {prNumber: '7', workerName: 'djf-io'})).toBe(
    'https://pr-7-djf-io.felixdj.workers.dev/',
  )
})

test('reads the subdomain from any workers.dev URL in the output', () => {
  const stdout = 'deployed at https://ravrun.someacct.workers.dev among other lines\n'
  expect(parsePreviewUrl(stdout, {prNumber: '1', workerName: 'ravrun'})).toBe(
    'https://pr-1-ravrun.someacct.workers.dev/',
  )
})

test('throws when no preview URL is present (preview URLs not enabled)', () => {
  const stdout = 'Uploaded version but no preview URL was generated.\n'
  expect(() => parsePreviewUrl(stdout, {prNumber: '3', workerName: 'onvibes'})).toThrow(
    /preview_urls/,
  )
})
