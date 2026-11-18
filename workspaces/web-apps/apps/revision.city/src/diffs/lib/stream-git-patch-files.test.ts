import {array, assert, asyncProperty, constantFrom, nat, stringMatching} from 'fast-check'
import {expect, test} from 'vitest'

import {getStreamedPatchMetadata, streamGitPatchFiles} from './stream-git-patch-files'

const FIRST_HASH = `${'0123456789abcdef'.repeat(2)}01234567`
const SECOND_HASH = `${'fedcba9876543210'.repeat(2)}fedcba98`

function fileDiff(path: string, addedLine = `export const value = '${path}'`): string {
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1 +1 @@',
    '-export const value = 0',
    `+${addedLine}`,
    '',
  ].join('\n')
}

function commitHeader(hash: string, subject: string): string {
  return [
    `From ${hash} Mon Sep 17 00:00:00 2001`,
    'From: Example Author <author@example.com>',
    `Subject: [PATCH] ${subject}`,
    '',
    '---',
    '',
  ].join('\n')
}

const ALPHA = fileDiff('src/alpha.ts')
const BETA = fileDiff('src/beta.ts')
const GAMMA = fileDiff('src/gamma.ts')
const SINGLE_COMMIT_PATCH = ALPHA + BETA + GAMMA

const FIRST_COMMIT = commitHeader(FIRST_HASH, 'Add alpha and beta')
const SECOND_COMMIT = commitHeader(SECOND_HASH, 'Add gamma')
const MULTI_COMMIT_PATCH = FIRST_COMMIT + ALPHA + BETA + SECOND_COMMIT + GAMMA

const encoder = new TextEncoder()

function streamOfBytes(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  return streamOfBytes(chunks.map((chunk) => encoder.encode(chunk)))
}

function splitAt(bytes: Uint8Array, cuts: readonly number[]): Uint8Array[] {
  const points = [...new Set(cuts)].toSorted((left, right) => left - right)
  const edges = [0, ...points, bytes.length]
  return edges.slice(1).map((end, index) => bytes.slice(edges[index], end))
}

async function collectFiles(
  body: ReadableStream<Uint8Array>,
): Promise<{fallback: string | undefined; files: string[]}> {
  const files: string[] = []
  const fallback = await streamGitPatchFiles(body, async (fileText) => {
    files.push(fileText)
  })
  return {fallback, files}
}

test.each([
  {name: 'one chunk', chunks: [SINGLE_COMMIT_PATCH]},
  {
    name: 'a file boundary cut inside the diff --git word',
    chunks: [`${ALPHA}diff --`, BETA.slice('diff --'.length) + GAMMA],
  },
  {
    name: 'a file boundary cut on the newline before diff --git',
    chunks: [ALPHA.slice(0, -1), `\n${BETA}${GAMMA}`],
  },
  {name: 'one character per chunk', chunks: SINGLE_COMMIT_PATCH.split('')},
  {name: 'empty chunks between the files', chunks: ['', ALPHA, '', BETA, '', GAMMA, '']},
])('a single-commit patch gives one complete file text per file: $name', async ({chunks}) => {
  const result = await collectFiles(streamOf(chunks))

  expect(result).toEqual({fallback: undefined, files: [ALPHA, BETA, GAMMA]})
})

test('a multi-commit patch puts each commit header on the first file of that commit', async () => {
  const result = await collectFiles(streamOf([MULTI_COMMIT_PATCH]))

  expect(result).toEqual({
    fallback: undefined,
    files: [FIRST_COMMIT + ALPHA, BETA, SECOND_COMMIT + GAMMA],
  })
})

test('the metadata of a streamed file is its commit header, when it has one', async () => {
  const {files} = await collectFiles(streamOf([MULTI_COMMIT_PATCH]))

  expect(files.map(getStreamedPatchMetadata)).toEqual([FIRST_COMMIT, undefined, SECOND_COMMIT])
})

test('text before the first file without a commit hash is not metadata', () => {
  const fileText = `Notes about the change\n${ALPHA}`

  expect(getStreamedPatchMetadata(fileText)).toBeUndefined()
})

test('a file text with no diff --git line has no metadata', () => {
  expect(getStreamedPatchMetadata(FIRST_COMMIT)).toBeUndefined()
})

test('a diff --git line inside hunk content does not start a new file', async () => {
  const quoted = fileDiff('docs/patches.md', 'diff --git a/quoted b/quoted')
  const result = await collectFiles(streamOf([quoted + BETA]))

  expect(result.files).toEqual([quoted, BETA])
})

test('a From line without a commit hash stays inside the file', async () => {
  const fromLine = fileDiff('docs/mail.md', 'From the start')
  const withContextLine = fromLine.replace('-export', 'From nowhere\n-export')
  const result = await collectFiles(streamOf([withContextLine + BETA]))

  expect(result.files).toEqual([withContextLine, BETA])
})

test('a body with no diff --git line comes back as the fallback patch', async () => {
  const body = 'Binary files differ\nnothing to stream\n'
  const result = await collectFiles(streamOf([body.slice(0, 7), body.slice(7)]))

  expect(result).toEqual({fallback: body, files: []})
})

test.each([
  {name: 'an empty body', chunks: []},
  {name: 'a whitespace body', chunks: ['\n', '  \n\t']},
])('$name gives no files and no fallback', async ({chunks}) => {
  const result = await collectFiles(streamOf(chunks))

  expect(result).toEqual({fallback: undefined, files: []})
})

test('a multi-byte character cut between two byte chunks decodes once', async () => {
  const unicodeFile = fileDiff('src/greeting.ts', "export const greeting = 'caf\u00e9 \u{1f600}'")
  const bytes = encoder.encode(unicodeFile + BETA)
  const emojiStart = encoder.encode(unicodeFile.slice(0, unicodeFile.indexOf('\u{1f600}'))).length
  const result = await collectFiles(streamOfBytes(splitAt(bytes, [emojiStart + 1, emojiStart + 3])))

  expect(result.files).toEqual([unicodeFile, BETA])
})

test('a body cut inside a multi-byte character ends its last file with a replacement character', async () => {
  const bytes = encoder.encode(`${ALPHA}${BETA}\u{1f600}`)
  const result = await collectFiles(streamOfBytes([bytes.slice(0, -2)]))

  expect(result.files).toEqual([ALPHA, `${BETA}\ufffd`])
})

test('any byte chunking gives the same files as one chunk', async () => {
  await assert(
    asyncProperty(
      constantFrom(SINGLE_COMMIT_PATCH, MULTI_COMMIT_PATCH),
      array(nat(), {maxLength: 12}),
      async (patch, rawCuts) => {
        const bytes = encoder.encode(patch)
        const cuts = rawCuts.map((cut) => cut % (bytes.length + 1))
        const whole = await collectFiles(streamOfBytes([bytes]))
        const chunked = await collectFiles(streamOfBytes(splitAt(bytes, cuts)))

        expect(chunked).toEqual(whole)
        expect(chunked.files.join('')).toBe(patch)
      },
    ),
  )
})

test('a large file sent in many small chunks gives the same files as one chunk', async () => {
  const largeLines = Array.from(
    {length: 8000},
    (_, index) => `export const line${index} = ${index}`,
  )
  const patch = fileDiff('src/large.ts', largeLines.join('\n+')) + BETA
  const chunkSize = 997
  const chunks = Array.from({length: Math.ceil(patch.length / chunkSize)}, (_, index) =>
    patch.slice(index * chunkSize, (index + 1) * chunkSize),
  )

  const chunked = await collectFiles(streamOf(chunks))

  expect(chunked).toEqual(await collectFiles(streamOf([patch])))
  expect(chunked.files).toHaveLength(2)
})

test('the files of a patch are its text cut at each file start, with nothing lost', async () => {
  await assert(
    asyncProperty(
      array(stringMatching(/^[a-z]{1,8}$/), {minLength: 1, maxLength: 6}),
      async (names) => {
        const fileTexts = names.map((name, index) => fileDiff(`src/${name}-${index}.ts`))
        const result = await collectFiles(streamOf([fileTexts.join('')]))

        expect(result.files).toEqual(fileTexts)
      },
    ),
  )
})

test('the reader lock is released when the file callback throws', async () => {
  const body = streamOf([SINGLE_COMMIT_PATCH])
  const failure = new Error('viewer rejected the file')

  await expect(
    streamGitPatchFiles(body, async () => {
      throw failure
    }),
  ).rejects.toBe(failure)
  expect(body.locked).toBe(false)
})
