import type {EntityChange, EntityDiff, EntityDiffSummary} from './entity'

export interface EntityDiffRequest {
  itemId: string
  name: string
  prevName?: string
  type: string
}

export interface EntityDiffStreamResult {
  itemId: string
  name: string
  diff?: EntityDiff
  error?: string
}

// By call signature only: lib.dom types `typeof fetch` with a required static
// `preconnect`, which a test stub cannot (and need not) satisfy. Mirrors the
// diffs file loader's own fetch type.
type EntityDiffFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

export interface StreamEntityDiffsParams {
  endpoint?: string
  fetcher?: EntityDiffFetch
  files: readonly EntityDiffRequest[]
  onResult: (result: EntityDiffStreamResult) => void
  signal?: AbortSignal
  sourcePath: string
}

const DEFAULT_ENDPOINT = '/api/diffs/entity-diff'

// A worker request has a bounded subrequest budget and each file costs up to two
// blob fetches, so a caller sends its file list in batches. Declared here rather
// than in the endpoint so the browser can read it without pulling the server
// module -- and with it every grammar -- into the client bundle.
export const MAX_FILES_PER_REQUEST = 20

// Reads one newline-delimited JSON result per file and hands each to `onResult`
// as it arrives, so the panel fills in progressively rather than at the end.
// Talks only to the same-origin route; GitHub auth, when there is any, rides
// along on the session cookie and never reaches the browser.
export async function streamEntityDiffs({
  endpoint = DEFAULT_ENDPOINT,
  fetcher = fetch,
  files,
  onResult,
  signal,
  sourcePath,
}: StreamEntityDiffsParams): Promise<void> {
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({path: sourcePath, files}),
    signal,
  })

  if (!response.ok) {
    throw new Error(await readErrorDetail(response))
  }
  if (response.body === null) {
    throw new Error('Symbol lookup returned no results.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const {done, value} = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, {stream: true})

    // A chunk can split a line, so only whole lines are parsed; the remainder
    // stays buffered for the next read.
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      emitLine(buffer.slice(0, newline), onResult)
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  emitLine(buffer, onResult)
}

function emitLine(line: string, onResult: (result: EntityDiffStreamResult) => void): void {
  const trimmed = line.trim()
  if (trimmed === '') {
    return
  }

  try {
    const result = normalizeResult(JSON.parse(trimmed))
    if (result !== undefined) {
      onResult(result)
    }
  } catch {
    // A truncated or malformed line loses one file, not the whole stream.
  }
}

// The route is same-origin and typed, but the response still crosses a network
// boundary; normalizing keeps a malformed payload from reaching the renderer.
function normalizeResult(data: unknown): EntityDiffStreamResult | undefined {
  if (!isRecord(data) || typeof data.itemId !== 'string' || typeof data.name !== 'string') {
    return undefined
  }
  if (typeof data.error === 'string') {
    return {itemId: data.itemId, name: data.name, error: data.error}
  }
  const diff = normalizeEntityDiff(data.diff)
  return diff === undefined
    ? {itemId: data.itemId, name: data.name, error: 'Symbol lookup returned an invalid result.'}
    : {itemId: data.itemId, name: data.name, diff}
}

function normalizeEntityDiff(data: unknown): EntityDiff | undefined {
  if (!isRecord(data) || typeof data.path !== 'string' || !Array.isArray(data.changes)) {
    return undefined
  }

  const changes = data.changes.filter(isEntityChange)
  return {
    path: data.path,
    language: typeof data.language === 'string' ? data.language : null,
    changes,
    summary: isSummary(data.summary) ? data.summary : createSummary(changes),
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  const text = (await response.text()).trim()
  if (text !== '') {
    try {
      const data: unknown = JSON.parse(text)
      if (isRecord(data) && typeof data.error === 'string') {
        return data.error
      }
    } catch {
      // Fall through to the status-only message below.
    }
  }
  return `Symbol lookup failed (${response.status}).`
}

function isEntityChange(value: unknown): value is EntityChange {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.name === 'string' &&
    typeof value.qualifiedName === 'string'
  )
}

function isSummary(value: unknown): value is EntityDiffSummary {
  return (
    isRecord(value) &&
    typeof value.added === 'number' &&
    typeof value.deleted === 'number' &&
    typeof value.modified === 'number' &&
    typeof value.moved === 'number' &&
    typeof value.renamed === 'number'
  )
}

function createSummary(changes: readonly EntityChange[]): EntityDiffSummary {
  return {
    added: countOf(changes, 'added'),
    deleted: countOf(changes, 'deleted'),
    modified: countOf(changes, 'modified'),
    moved: countOf(changes, 'moved'),
    renamed: countOf(changes, 'renamed'),
  }
}

function countOf(changes: readonly EntityChange[], type: EntityChange['type']): number {
  return changes.filter((change) => change.type === type).length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
