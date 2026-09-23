import type {GitHubAppCredentials} from './github-auth'
import {encodeURLSegment, type GitHubRepo} from './github-diff-source'
import {isNullish} from './nullish'

const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const USER_AGENT = 'revision-city-diffs'
// A human page load waits on this lookup for its title, so past this the page
// falls back to what the URL already says rather than holding the reader.
const DEFAULT_TIMEOUT_MS = 2_000
// A hit stays fresh for an hour: titles rarely change, and the point of the
// cache is one GitHub call per pull request per edge, not one per scraper. A
// miss is kept briefly, so a repository made public shows up without a wait.
const HIT_MAX_AGE_SECONDS = 60 * 60
const MISS_MAX_AGE_SECONDS = 5 * 60
// Lookups are keyed on the site's own origin, which is the zone the Workers
// cache belongs to in production; the path never resolves to a page.
const CACHE_KEY_ROOT = 'https://revision.city/.cache/github/pulls/'

type PullRequestFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

// The Workers Cache API's shape, so the default cache and a test double both fit.
export interface ResponseCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

export type PullRequestState = 'open' | 'closed' | 'merged'

export interface PublicPullRequest {
  title: string
  author?: string
  state: PullRequestState
  draft: boolean
  additions?: number
  deletions?: number
  changedFiles?: number
}

export interface FetchPublicPullRequestParams {
  repo: GitHubRepo
  number: string
  fetch?: PullRequestFetch
  // The app's own client id and secret, sent as basic auth. GitHub answers
  // such requests with public data only, at the app's rate limit instead of
  // the anonymous per-address one the Worker shares with every other Worker.
  credentials?: GitHubAppCredentials
  cache?: ResponseCache
  timeoutMs?: number
}

type PullRequestLookup =
  | {kind: 'found'; pull: PublicPullRequest}
  | {kind: 'missing'}
  | {kind: 'unavailable'}

// Reads what GitHub tells anyone about a pull request, for the share card and
// the page title. Deliberately never authenticates as the visitor or as an
// installation: a card is served to whoever holds the link, so it may carry
// only what the link already reveals to the public. A private or missing pull
// request reads as undefined, and so does GitHub being unreachable.
export async function fetchPublicPullRequest({
  repo,
  number,
  fetch: fetcher = fetch,
  credentials,
  cache = defaultCache(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: FetchPublicPullRequestParams): Promise<PublicPullRequest | undefined> {
  const cacheKey = new Request(
    `${CACHE_KEY_ROOT}${encodeURLSegment(repo.owner)}/${encodeURLSegment(repo.repo)}/${encodeURLSegment(number)}`,
  )
  const cached = await readCachedLookup(cache, cacheKey)
  if (!isNullish(cached)) {
    return cached.kind === 'found' ? cached.pull : undefined
  }

  const lookup = await lookupPullRequest({repo, number, fetcher, credentials, timeoutMs})
  if (lookup.kind === 'unavailable') {
    return undefined
  }
  await writeCachedLookup(cache, cacheKey, lookup)
  return lookup.kind === 'found' ? lookup.pull : undefined
}

interface LookupPullRequestParams {
  repo: GitHubRepo
  number: string
  fetcher: PullRequestFetch
  credentials: GitHubAppCredentials | undefined
  timeoutMs: number
}

async function lookupPullRequest({
  repo,
  number,
  fetcher,
  credentials,
  timeoutMs,
}: LookupPullRequestParams): Promise<PullRequestLookup> {
  const url = `${GITHUB_API_ROOT}/repos/${encodeURLSegment(repo.owner)}/${encodeURLSegment(repo.repo)}/pulls/${encodeURLSegment(number)}`
  let response = await fetchWithTimeout({url, fetcher, credentials, timeoutMs})
  // GitHub rejecting the app's own credentials would otherwise take every card
  // down with it; one anonymous retry keeps public cards working at the lower
  // limit until the credentials are fixed.
  if (response?.status === 401 && !isNullish(credentials)) {
    response = await fetchWithTimeout({url, fetcher, credentials: undefined, timeoutMs})
  }
  if (isNullish(response)) {
    return {kind: 'unavailable'}
  }
  if (response.status === 404) {
    return {kind: 'missing'}
  }
  if (!response.ok) {
    return {kind: 'unavailable'}
  }

  const pull = parseGitHubPullRequest(await response.json().catch(() => undefined))
  return isNullish(pull) ? {kind: 'unavailable'} : {kind: 'found', pull}
}

interface FetchWithTimeoutParams {
  url: string
  fetcher: PullRequestFetch
  credentials: GitHubAppCredentials | undefined
  timeoutMs: number
}

// Undefined for a network failure or a lookup that outlasts the timeout: both
// read as "GitHub had no answer", never as "the pull request is missing".
async function fetchWithTimeout({
  url,
  fetcher,
  credentials,
  timeoutMs,
}: FetchWithTimeoutParams): Promise<Response | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    return await fetcher(url, {
      cache: 'no-store',
      headers: createHeaders(credentials),
      signal: controller.signal,
    })
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

function createHeaders(credentials: GitHubAppCredentials | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
  if (!isNullish(credentials)) {
    headers.Authorization = `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`
  }
  return headers
}

function parseGitHubPullRequest(data: unknown): PublicPullRequest | undefined {
  if (!isRecord(data) || typeof data.title !== 'string') {
    return undefined
  }

  const user = data.user
  return {
    title: data.title,
    author: isRecord(user) ? readOptionalString(user.login) : undefined,
    state: data.merged === true ? 'merged' : data.state === 'closed' ? 'closed' : 'open',
    draft: data.draft === true,
    additions: readOptionalNumber(data.additions),
    deletions: readOptionalNumber(data.deletions),
    changedFiles: readOptionalNumber(data.changed_files),
  }
}

// A cached lookup is the summary as this module wrote it, so the shape check
// is only a guard against a stale or foreign entry under the same key.
function parseCachedPullRequest(data: unknown): PublicPullRequest | undefined {
  if (!isRecord(data) || typeof data.title !== 'string') {
    return undefined
  }
  return {
    title: data.title,
    author: readOptionalString(data.author),
    state: data.state === 'merged' || data.state === 'closed' ? data.state : 'open',
    draft: data.draft === true,
    additions: readOptionalNumber(data.additions),
    deletions: readOptionalNumber(data.deletions),
    changedFiles: readOptionalNumber(data.changedFiles),
  }
}

// The cache is a nicety, never a dependency: a cache that throws (an origin
// the edge will not key on, a runtime without one) reads as empty.
async function readCachedLookup(
  cache: ResponseCache | undefined,
  key: Request,
): Promise<Exclude<PullRequestLookup, {kind: 'unavailable'}> | undefined> {
  try {
    const cached = await cache?.match(key)
    if (isNullish(cached)) {
      return undefined
    }
    const data: unknown = await cached.json()
    if (!isRecord(data)) {
      return undefined
    }
    if (data.pull === null) {
      return {kind: 'missing'}
    }
    const pull = parseCachedPullRequest(data.pull)
    return isNullish(pull) ? undefined : {kind: 'found', pull}
  } catch {
    return undefined
  }
}

async function writeCachedLookup(
  cache: ResponseCache | undefined,
  key: Request,
  lookup: Exclude<PullRequestLookup, {kind: 'unavailable'}>,
): Promise<void> {
  const maxAge = lookup.kind === 'found' ? HIT_MAX_AGE_SECONDS : MISS_MAX_AGE_SECONDS
  const body = {pull: lookup.kind === 'found' ? lookup.pull : null}
  try {
    await cache?.put(
      key,
      Response.json(body, {headers: {'Cache-Control': `public, max-age=${maxAge}`}}),
    )
  } catch {
    // Nothing to do: the next lookup asks GitHub again.
  }
}

// `caches.default` is Cloudflare's addition to CacheStorage, absent from the
// standard type and from Node, so it is looked up rather than declared.
function defaultCache(): ResponseCache | undefined {
  const caches: unknown = Reflect.get(globalThis, 'caches')
  const store = isRecord(caches) ? caches.default : undefined
  return isResponseCache(store) ? store : undefined
}

function isResponseCache(value: unknown): value is ResponseCache {
  return isRecord(value) && typeof value.match === 'function' && typeof value.put === 'function'
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
