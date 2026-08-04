import type {ChangeTypes} from '@pierre/diffs'

import {resolveGitHubAuth, withSetCookieHeaders} from '@/diffs/lib/github-auth'
import {loadGitHubDiffFiles} from '@/diffs/lib/github-diff-file-server'
import {isNullish} from '@/diffs/lib/nullish'
import {diffEntities} from './diff-entities'
import type {EntityDiff} from './entity'
import {MAX_FILES_PER_REQUEST} from './entity-diff-client'

const CHANGE_TYPES: readonly ChangeTypes[] = [
  'change',
  'deleted',
  'new',
  'rename-changed',
  'rename-pure',
]

// How many files are read from GitHub at a time within one request. Results are
// streamed as each lands, so this bounds concurrency without delaying output.
const MAX_CONCURRENT_READS = 4

// Entity diffs are immutable per revision pair, but the content behind them came
// from the caller's own credentials.
const CACHE_CONTROL = 'private, no-store'

export interface EntityDiffFileRequest {
  itemId: string
  name: string
  prevName?: string
  type: ChangeTypes
}

export interface EntityDiffResult {
  itemId: string
  name: string
  diff?: EntityDiff
  error?: string
}

// Streams one newline-delimited JSON result per file, in completion order, so
// the viewer can render each file's symbols the moment it is ready instead of
// waiting for the slowest one. Signing in is not required -- a public repo reads
// fine unauthenticated, the same way the viewer already loads its patch.
export async function handleEntityDiffRequest(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('A JSON body with path and files is required.', 400)
  }

  const parsed = parseRequestBody(body)
  if (parsed === undefined) {
    return createErrorResponse('A JSON body with path and files is required.', 400)
  }
  if (parsed.files.length > MAX_FILES_PER_REQUEST) {
    return createErrorResponse(`At most ${MAX_FILES_PER_REQUEST} files per request.`, 400)
  }

  const auth = await resolveGitHubAuth(request)
  const token = auth.session?.accessToken
  const credentials = isNullish(token)
    ? ({tokenSource: 'anonymous'} as const)
    : ({token, tokenSource: 'request'} as const)

  const stream = createResultStream({files: parsed.files, path: parsed.path, credentials})
  return withSetCookieHeaders(
    new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': CACHE_CONTROL,
        Vary: 'Cookie',
      },
    }),
    auth.setCookieHeaders,
  )
}

type Credentials =
  | {readonly tokenSource: 'anonymous'}
  | {readonly token: string; readonly tokenSource: 'request'}

interface CreateResultStreamParams {
  credentials: Credentials
  files: readonly EntityDiffFileRequest[]
  path: string
}

function createResultStream({
  credentials,
  files,
  path,
}: CreateResultStreamParams): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const queue = [...files]

  return new ReadableStream({
    async start(controller) {
      const readNext = async (): Promise<void> => {
        while (queue.length > 0) {
          const file = queue.shift()
          if (file === undefined) {
            return
          }
          const result = await computeResult({file, path, credentials})
          controller.enqueue(encoder.encode(`${JSON.stringify(result)}\n`))
        }
      }

      await Promise.all(
        Array.from({length: Math.min(MAX_CONCURRENT_READS, queue.length)}, readNext),
      )
      controller.close()
    },
  })
}

interface ComputeResultParams {
  credentials: Credentials
  file: EntityDiffFileRequest
  path: string
}

// One file never fails the batch: a read that throws is reported on its own line
// so the other files still arrive.
async function computeResult({
  credentials,
  file,
  path,
}: ComputeResultParams): Promise<EntityDiffResult> {
  // A pure rename moves a file without touching its contents, so both sides hold
  // the same entities. Answer without spending a GitHub request.
  if (file.type === 'rename-pure') {
    return {itemId: file.itemId, name: file.name, diff: createEmptyEntityDiff(file.name)}
  }

  try {
    const {oldFile, newFile} = await loadGitHubDiffFiles(
      {name: file.name, path, prevName: file.prevName, type: file.type},
      {...credentials, hydrateSingleSided: true},
    )
    return {
      itemId: file.itemId,
      name: file.name,
      diff: await diffEntities({
        path: file.name,
        oldSource: oldFile?.contents ?? '',
        newSource: newFile?.contents ?? '',
      }),
    }
  } catch (error) {
    return {
      itemId: file.itemId,
      name: file.name,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

interface ParsedRequestBody {
  files: readonly EntityDiffFileRequest[]
  path: string
}

function parseRequestBody(body: unknown): ParsedRequestBody | undefined {
  if (!isRecord(body) || typeof body.path !== 'string' || !Array.isArray(body.files)) {
    return undefined
  }

  const files = body.files.flatMap((file) => {
    const parsed = parseFileRequest(file)
    return parsed === undefined ? [] : [parsed]
  })
  return files.length === body.files.length ? {files, path: body.path} : undefined
}

function parseFileRequest(value: unknown): EntityDiffFileRequest | undefined {
  if (!isRecord(value) || typeof value.itemId !== 'string' || typeof value.name !== 'string') {
    return undefined
  }
  const type = CHANGE_TYPES.find((candidate) => candidate === value.type)
  if (type === undefined) {
    return undefined
  }
  return {
    itemId: value.itemId,
    name: value.name,
    prevName: typeof value.prevName === 'string' ? value.prevName : undefined,
    type,
  }
}

function createEmptyEntityDiff(path: string): EntityDiff {
  return {
    path,
    language: null,
    changes: [],
    summary: {added: 0, deleted: 0, modified: 0, moved: 0, renamed: 0},
  }
}

function createErrorResponse(error: string, status: number): Response {
  return Response.json({error}, {status, headers: {'Cache-Control': CACHE_CONTROL}})
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
