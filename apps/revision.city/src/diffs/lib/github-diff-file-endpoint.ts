import type {ChangeTypes} from '@pierre/diffs'

import {loadGitHubDiffFiles} from './github-diff-file-server'
import {isNullish} from './nullish'

const CACHE_CONTROL = 'no-store'
const CHANGE_TYPES = new Set<ChangeTypes>([
  'change',
  'deleted',
  'new',
  'rename-changed',
  'rename-pure',
])

// Expands a diff entry into full old/new file contents via the GitHub API so
// the viewer can show unchanged context lines. Requires a caller-supplied
// GitHub token; the endpoint never holds credentials of its own.
export async function handleGitHubDiffFileRequest(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const path = params.get('path')
  const name = params.get('name')
  const type = parseChangeType(params.get('type'))
  const prevName = params.get('prevName') ?? undefined
  const token = parseBearerToken(request.headers.get('authorization'))

  if (isNullish(path) || isNullish(name) || isNullish(type)) {
    return createJSONResponse(
      {error: 'path, name, and supported type parameters are required.'},
      {status: 400},
    )
  }

  if (isNullish(token)) {
    return createJSONResponse(
      {error: 'GitHub file expansion requires a configured token.'},
      {status: 401},
    )
  }

  try {
    return createJSONResponse(
      await loadGitHubDiffFiles({name, path, prevName, type}, {token, tokenSource: 'request'}),
    )
  } catch (error) {
    return createJSONResponse(
      {error: error instanceof Error ? error.message : 'Unknown error'},
      {status: 502},
    )
  }
}

function parseBearerToken(value: string | null): string | undefined {
  if (isNullish(value)) {
    return undefined
  }

  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  const token = match?.[1]?.trim()
  return isNullish(token) || token === '' ? undefined : token
}

function parseChangeType(value: string | null): ChangeTypes | undefined {
  if (isNullish(value)) {
    return undefined
  }
  return CHANGE_TYPES.has(value as ChangeTypes) ? (value as ChangeTypes) : undefined
}

function createJSONResponse(body: unknown, options: {status?: number} = {}): Response {
  return Response.json(body, {
    status: options.status ?? 200,
    headers: {
      'Cache-Control': CACHE_CONTROL,
      Vary: 'Authorization',
    },
  })
}
