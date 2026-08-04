import type {ChangeTypes} from '@pierre/diffs'

import {resolveGitHubAuth, withSetCookieHeaders} from '@/diffs/lib/github-auth'
import {loadGitHubDiffFiles} from '@/diffs/lib/github-diff-file-server'
import {isNullish} from '@/diffs/lib/nullish'
import {diffEntities} from './diff-entities'
import type {EntityDiff} from './entity'

const CHANGE_TYPES: readonly ChangeTypes[] = [
  'change',
  'deleted',
  'new',
  'rename-changed',
  'rename-pure',
]

// Entity diffs are keyed by immutable content: for a given pair of revisions of
// a file the answer never changes, so a long shared cache is safe. `private`
// because the contents behind it came from the caller's GitHub token.
const CACHE_CONTROL = 'private, max-age=3600'

// Names the functions, classes and config keys that changed in one file of a
// diff. Requires a signed-in GitHub session; the token comes from the HttpOnly
// session cookie, never from the client request.
export async function handleEntityDiffRequest(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const path = params.get('path')
  const name = params.get('name')
  const type = parseChangeType(params.get('type'))
  const prevName = params.get('prevName') ?? undefined

  if (isNullish(path) || isNullish(name) || isNullish(type)) {
    return createJSONResponse(
      {error: 'path, name, and supported type parameters are required.'},
      {status: 400},
    )
  }

  // A pure rename moves a file without touching its contents, so both sides
  // hold the same entities. Answer without spending a GitHub request.
  if (type === 'rename-pure') {
    return createJSONResponse(createEmptyEntityDiff(name))
  }

  const auth = await resolveGitHubAuth(request)
  const token = auth.session?.accessToken
  if (isNullish(token)) {
    return withSetCookieHeaders(
      createJSONResponse(
        {error: 'Symbol tracking requires signing in with GitHub.'},
        {status: 401},
      ),
      auth.setCookieHeaders,
    )
  }

  try {
    const {oldFile, newFile} = await loadGitHubDiffFiles(
      {name, path, prevName, type},
      {token, tokenSource: 'request', hydrateSingleSided: true},
    )
    return withSetCookieHeaders(
      createJSONResponse(
        await diffEntities({
          path: name,
          oldSource: oldFile?.contents ?? '',
          newSource: newFile?.contents ?? '',
        }),
      ),
      auth.setCookieHeaders,
    )
  } catch (error) {
    return withSetCookieHeaders(
      createJSONResponse(
        {error: error instanceof Error ? error.message : 'Unknown error'},
        {status: 502},
      ),
      auth.setCookieHeaders,
    )
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

function parseChangeType(value: string | null): ChangeTypes | undefined {
  if (isNullish(value)) {
    return undefined
  }
  return CHANGE_TYPES.find((candidate) => candidate === value)
}

function createJSONResponse(body: unknown, options: {status?: number} = {}): Response {
  return Response.json(body, {
    status: options.status ?? 200,
    headers: {'Cache-Control': CACHE_CONTROL, Vary: 'Cookie'},
  })
}
