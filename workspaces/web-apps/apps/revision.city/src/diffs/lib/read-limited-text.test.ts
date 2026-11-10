import {expect, test} from 'vitest'

import {isFileTooLargeError, readLimitedText} from './read-limited-text'

const FILE_NAME = 'src/big.ts'

// A body of `chunkCount` chunks of `chunkBytes` bytes with no Content-Length.
// `pulled` counts the chunks the reader asked for.
function createChunkedResponse(chunkCount: number, chunkBytes: number) {
  const counter = {pulled: 0}
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (counter.pulled === chunkCount) {
        controller.close()
        return
      }
      counter.pulled += 1
      controller.enqueue(new Uint8Array(chunkBytes).fill(0x61))
    },
  })
  return {counter, response: new Response(body)}
}

test('reads a body under the limit', async () => {
  const text = await readLimitedText({
    response: new Response('export const a = 1\n'),
    maxBytes: 100,
    fileName: FILE_NAME,
  })

  expect(text).toBe('export const a = 1\n')
})

test('reads the whole body when there is no limit', async () => {
  const {response} = createChunkedResponse(4, 10)

  await expect(readLimitedText({response, fileName: FILE_NAME})).resolves.toHaveLength(40)
})

test('refuses a body by its Content-Length before it reads it', async () => {
  const {counter, response} = createChunkedResponse(4, 10)
  const declared = new Response(response.body, {headers: {'Content-Length': '40'}})

  const error = await readLimitedText({
    response: declared,
    maxBytes: 39,
    fileName: FILE_NAME,
  }).catch((caught: unknown) => caught)

  expect(isFileTooLargeError(error)).toBe(true)
  expect(counter.pulled).toBeLessThanOrEqual(1)
})

test('stops reading a body with no Content-Length at the limit', async () => {
  const {counter, response} = createChunkedResponse(1000, 1000)

  const error = await readLimitedText({response, maxBytes: 2500, fileName: FILE_NAME}).catch(
    (caught: unknown) => caught,
  )

  expect(isFileTooLargeError(error)).toBe(true)
  expect(error).toHaveProperty('message', `${FILE_NAME} is larger than 2500 bytes.`)
  expect(counter.pulled).toBeLessThan(10)
})

test('counts bytes, not characters', async () => {
  // Each character is 3 bytes in UTF-8.
  const response = new Response('\u20ac'.repeat(10))

  const error = await readLimitedText({response, maxBytes: 20, fileName: FILE_NAME}).catch(
    (caught: unknown) => caught,
  )

  expect(isFileTooLargeError(error)).toBe(true)
})

test('decodes a character split across chunks', async () => {
  const bytes = new TextEncoder().encode('\u20ac')
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 1))
      controller.enqueue(bytes.slice(1))
      controller.close()
    },
  })

  await expect(
    readLimitedText({response: new Response(body), maxBytes: 3, fileName: FILE_NAME}),
  ).resolves.toBe('\u20ac')
})

test('reads an empty body', async () => {
  await expect(
    readLimitedText({response: new Response(null), maxBytes: 10, fileName: FILE_NAME}),
  ).resolves.toBe('')
})

test('other errors are not too-large errors', () => {
  expect(isFileTooLargeError(new Error('GitHub raw file failed (404).'))).toBe(false)
  expect(isFileTooLargeError('not an error')).toBe(false)
})
