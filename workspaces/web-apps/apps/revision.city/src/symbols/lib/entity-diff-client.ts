import type {EntityChange, EntityDiff, EntityDiffSummary} from './entity'

export interface EntityDiffRequest {
  itemId: string
  name: string
  prevName?: string
  type: string
}

// By call signature only: lib.dom types `typeof fetch` with a required static
// `preconnect`, which a test stub cannot (and need not) satisfy. Mirrors the
// diffs file loader's own fetch type.
type EntityDiffFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

export interface FetchEntityDiffParams {
  endpoint?: string
  fetcher?: EntityDiffFetch
  request: EntityDiffRequest
  signal?: AbortSignal
  sourcePath: string
}

const DEFAULT_ENDPOINT = '/api/diffs/entity-diff'

// Talks only to the same-origin route; GitHub auth rides along on the session
// cookie, so no token ever reaches the browser.
export async function fetchEntityDiff({
  endpoint = DEFAULT_ENDPOINT,
  fetcher = fetch,
  request,
  signal,
  sourcePath,
}: FetchEntityDiffParams): Promise<EntityDiff> {
  const searchParams = new URLSearchParams({
    path: sourcePath,
    name: request.name,
    type: request.type,
  })
  if (request.prevName !== undefined) {
    searchParams.set('prevName', request.prevName)
  }

  const response = await fetcher(`${endpoint}?${searchParams}`, {signal})
  if (!response.ok) {
    throw new Error(await readErrorDetail(response))
  }
  return normalizeEntityDiff(await response.json())
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

// The route is same-origin and typed, but the response still crosses a network
// boundary; normalizing keeps a malformed payload from reaching the renderer.
function normalizeEntityDiff(data: unknown): EntityDiff {
  if (!isRecord(data) || typeof data.path !== 'string' || !Array.isArray(data.changes)) {
    throw new TypeError('Symbol lookup returned an invalid response.')
  }

  const changes = data.changes.filter(isEntityChange)
  return {
    path: data.path,
    language: typeof data.language === 'string' ? data.language : null,
    changes,
    summary: isSummary(data.summary) ? data.summary : createSummary(changes),
  }
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
