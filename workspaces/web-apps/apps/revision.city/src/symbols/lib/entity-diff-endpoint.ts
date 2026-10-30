import type {ChangeTypes, FileContents} from '@pierre/diffs'

import {
  type CodebergDiffFileServerOptions,
  createCodebergFileReader,
} from '@/diffs/lib/codeberg-diff-file-server'
import {CODEBERG_HOST, canReadCodebergFiles} from '@/diffs/lib/codeberg-diff-source'
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

// How many files are read from GitHub or Codeberg at a time within one request.
// Results are streamed as each lands, so this bounds concurrency without delaying
// output.
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

export interface EntityDiffEndpointOptions {
  fetch?: CodebergDiffFileServerOptions['fetch']
}

interface DiffFiles {
  oldFile: FileContents | null
  newFile: FileContents | null
}

type ReadDiffFiles = (file: Omit<EntityDiffFileRequest, 'itemId'>) => Promise<DiffFiles>

// Streams one newline-delimited JSON result per file, in completion order, so
// the viewer can render each file's symbols the moment it is ready instead of
// waiting for the slowest one. Signing in is not required -- a public repo reads
// fine unauthenticated, the same way the viewer already loads its patch. A body
// with `domain: 'codeberg.org'` reads from Codeberg, which has no sign-in yet.
export async function handleEntityDiffRequest(
  request: Request,
  options: EntityDiffEndpointOptions = {},
): Promise<Response> {
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

  if (parsed.domain === CODEBERG_HOST) {
    if (!canReadCodebergFiles(parsed.path)) {
      return createErrorResponse('Symbols need a Codeberg pull request or commit.', 400)
    }
    const readFiles = createCodebergFileReader(parsed.path, options)
    return createStreamResponse(createResultStream({files: parsed.files, readFiles}))
  }
  if (!isNullish(parsed.domain)) {
    return createErrorResponse('Symbols read from GitHub and Codeberg only.', 400)
  }

  const auth = await resolveGitHubAuth(request)
  const token = auth.session?.accessToken
  const credentials = isNullish(token)
    ? ({tokenSource: 'anonymous'} as const)
    : ({token, tokenSource: 'request'} as const)
  const readFiles: ReadDiffFiles = (file) =>
    loadGitHubDiffFiles(
      {...file, path: parsed.path},
      {...credentials, fetch: options.fetch, hydrateSingleSided: true},
    )

  return withSetCookieHeaders(
    createStreamResponse(createResultStream({files: parsed.files, readFiles})),
    auth.setCookieHeaders,
  )
}

function createStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      Vary: 'Cookie',
    },
  })
}

interface CreateResultStreamParams {
  files: readonly EntityDiffFileRequest[]
  readFiles: ReadDiffFiles
}

function createResultStream({
  files,
  readFiles,
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
          const result = await computeResult({file, readFiles})
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
  file: EntityDiffFileRequest
  readFiles: ReadDiffFiles
}

// One file never fails the batch: a read that throws is reported on its own line
// so the other files still arrive.
async function computeResult({file, readFiles}: ComputeResultParams): Promise<EntityDiffResult> {
  // A pure rename moves a file without touching its contents, so both sides hold
  // the same entities. Answer without a request to GitHub or Codeberg.
  if (file.type === 'rename-pure') {
    return {itemId: file.itemId, name: file.name, diff: createEmptyEntityDiff(file.name)}
  }

  try {
    const {oldFile, newFile} = await readFiles({
      name: file.name,
      prevName: file.prevName,
      type: file.type,
    })
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
  domain?: string
  files: readonly EntityDiffFileRequest[]
  path: string
}

function parseRequestBody(body: unknown): ParsedRequestBody | undefined {
  if (!isRecord(body) || typeof body.path !== 'string' || !Array.isArray(body.files)) {
    return undefined
  }
  if (!isNullish(body.domain) && typeof body.domain !== 'string') {
    return undefined
  }

  const files = body.files.flatMap((file) => {
    const parsed = parseFileRequest(file)
    return parsed === undefined ? [] : [parsed]
  })
  if (files.length !== body.files.length) {
    return undefined
  }
  return isNullish(body.domain)
    ? {files, path: body.path}
    : {domain: body.domain, files, path: body.path}
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
