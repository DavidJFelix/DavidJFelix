const FILE_TOO_LARGE = 'file-too-large'

export interface ReadLimitedTextParams {
  response: Response
  // With no limit, the whole body is read.
  maxBytes?: number
  fileName: string
}

// Reads a response body as text and stops at `maxBytes`, so a large body never
// gets into memory. The Content-Length check refuses a body without a read. The
// byte count covers a body with no Content-Length.
export async function readLimitedText({
  response,
  maxBytes,
  fileName,
}: ReadLimitedTextParams): Promise<string> {
  if (maxBytes === undefined) {
    return response.text()
  }
  const tooLarge = new Error(`${fileName} is larger than ${maxBytes} bytes.`, {
    cause: FILE_TOO_LARGE,
  })
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel()
    throw tooLarge
  }
  if (response.body === null) {
    return ''
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let text = ''
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    byteCount += chunk.value.byteLength
    if (byteCount > maxBytes) {
      await reader.cancel()
      throw tooLarge
    }
    text += decoder.decode(chunk.value, {stream: true})
  }
  return text + decoder.decode()
}

export function isFileTooLargeError(error: unknown): boolean {
  return error instanceof Error && error.cause === FILE_TOO_LARGE
}
