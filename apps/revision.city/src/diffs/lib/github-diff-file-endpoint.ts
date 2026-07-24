import type {ChangeTypes} from '@pierre/diffs'

import {resolveGitHubAuth, withSetCookieHeaders} from './github-auth'
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
// the viewer can show unchanged context lines. Requires a signed-in GitHub
// session; the token comes from the HttpOnly session cookie, never from the
// client request itself.
export async function handleGitHubDiffFileRequest(request: Request): Promise<Response> {
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

  const auth = await resolveGitHubAuth(request)
  const token = auth.session?.accessToken
  if (isNullish(token)) {
    return withSetCookieHeaders(
      createJSONResponse(
        {error: 'GitHub file expansion requires signing in with GitHub.'},
        {status: 401},
      ),
      auth.setCookieHeaders,
    )
  }

  try {
    return withSetCookieHeaders(
      createJSONResponse(
        await loadGitHubDiffFiles({name, path, prevName, type}, {token, tokenSource: 'request'}),
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
      Vary: 'Cookie',
    },
  })
}
