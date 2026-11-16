import {type GitHubAuthOptions, resolveGitHubAuth, withSetCookieHeaders} from './github-auth'
import {loadGitHubCompareBehindBy} from './github-diff-file-server'
import {getLoaderErrorStatus} from './loader-error'
import {isNullish} from './nullish'

type GitHubCompareStatusRequestOptions = Pick<GitHubAuthOptions, 'credentials' | 'fetch'>

// Tells the viewer how many commits a compare's base branch gained after the
// merge base. Like file expansion, it requires a signed-in GitHub session, and
// the token comes from the HttpOnly session cookie.
export async function handleGitHubCompareStatusRequest(
  request: Request,
  options: GitHubCompareStatusRequestOptions = {},
): Promise<Response> {
  const path = new URL(request.url).searchParams.get('path')
  if (isNullish(path)) {
    return createJSONResponse({error: 'A path parameter is required.'}, 400)
  }

  const auth = await resolveGitHubAuth(request, options)
  const token = auth.session?.accessToken
  if (isNullish(token)) {
    return withSetCookieHeaders(
      createJSONResponse({error: 'The compare status requires signing in with GitHub.'}, 401),
      auth.setCookieHeaders,
    )
  }

  try {
    const behindBy = await loadGitHubCompareBehindBy({path, token, fetch: options.fetch})
    return withSetCookieHeaders(
      createJSONResponse({behindBy: behindBy ?? null}, 200),
      auth.setCookieHeaders,
    )
  } catch (error) {
    return withSetCookieHeaders(
      createJSONResponse(
        {error: error instanceof Error ? error.message : 'Unknown error'},
        getLoaderErrorStatus(error),
      ),
      auth.setCookieHeaders,
    )
  }
}

function createJSONResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {'Cache-Control': 'no-store', Vary: 'Cookie'},
  })
}
