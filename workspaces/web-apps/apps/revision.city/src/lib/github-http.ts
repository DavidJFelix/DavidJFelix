export const GITHUB_API_ROOT = 'https://api.github.com'
export const GITHUB_API_VERSION = '2022-11-28'
export const GITHUB_USER_AGENT = 'revision.city'

export type GitHubFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

// A token is sent as a bearer token. The app's client id and secret are sent as
// basic auth, which GitHub honors for public data only.
export type GitHubAuthorization =
  | {kind: 'token'; token: string}
  | {kind: 'app'; credentials: {clientId: string; clientSecret: string}}

const MEDIA_TYPES = {
  json: 'application/vnd.github+json',
  diff: 'application/vnd.github.diff',
  raw: 'application/vnd.github.raw',
} as const

export type GitHubMediaType = keyof typeof MEDIA_TYPES

export interface GitHubHeadersParams {
  // The API answer type. Leave it out for a request to a host other than the
  // API, which gets no Accept and no API version.
  media?: GitHubMediaType
  authorization?: GitHubAuthorization
}

export function createGitHubHeaders({
  media,
  authorization,
}: GitHubHeadersParams): Record<string, string> {
  return {
    ...(media === undefined
      ? {}
      : {Accept: MEDIA_TYPES[media], 'X-GitHub-Api-Version': GITHUB_API_VERSION}),
    ...(authorization === undefined ? {} : {Authorization: formatAuthorization(authorization)}),
    'User-Agent': GITHUB_USER_AGENT,
  }
}

function formatAuthorization(authorization: GitHubAuthorization): string {
  return authorization.kind === 'token'
    ? `Bearer ${authorization.token}`
    : `Basic ${btoa(`${authorization.credentials.clientId}:${authorization.credentials.clientSecret}`)}`
}

export interface GitHubApiUrlParams {
  path: string
  searchParams?: Record<string, string>
}

export function createGitHubApiUrl({path, searchParams = {}}: GitHubApiUrlParams): string {
  const url = new URL(path, GITHUB_API_ROOT)
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value)
  }
  return url.href
}
