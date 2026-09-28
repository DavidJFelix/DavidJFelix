import {
  defaultResponseCache,
  GITHUB_CACHE_KEY_ROOT,
  noteAppBudgetAnswer,
  type ResponseCache,
  readAppBudgetHold,
} from './github-app-budget'
import type {GitHubAppCredentials} from './github-auth'
import {encodeURLSegment, type GitHubRepo} from './github-diff-source'
import {isNullish} from './nullish'

const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const USER_AGENT = 'revision-city-diffs'
// A human page load waits on this lookup for its title, so past this the page
// falls back to what the URL already says rather than holding the reader. One
// deadline covers the whole lookup: every attempt, and reading the body.
const DEFAULT_TIMEOUT_MS = 2_000
// A hit stays fresh for an hour: titles rarely change, and the point of the
// cache is one GitHub call per pull request per edge, not one per scraper. A
// miss is kept briefly, so a repository made public shows up without a wait.
const HIT_MAX_AGE_SECONDS = 60 * 60
const MISS_MAX_AGE_SECONDS = 5 * 60
const PULLS_CACHE_KEY_ROOT = `${GITHUB_CACHE_KEY_ROOT}pulls/`

type PullRequestFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

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
  cache = defaultResponseCache(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: FetchPublicPullRequestParams): Promise<PublicPullRequest | undefined> {
  const cacheKey = new Request(
    `${PULLS_CACHE_KEY_ROOT}${encodeURLSegment(repo.owner)}/${encodeURLSegment(repo.repo)}/${encodeURLSegment(number)}`,
  )
  const cached = await readCachedLookup(cache, cacheKey)
  if (!isNullish(cached)) {
    return cached.kind === 'found' ? cached.pull : undefined
  }

  const lookup = await lookupPullRequest({repo, number, fetcher, credentials, cache, timeoutMs})
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
  cache: ResponseCache | undefined
  timeoutMs: number
}

async function lookupPullRequest({
  repo,
  number,
  fetcher,
  credentials,
  cache,
  timeoutMs,
}: LookupPullRequestParams): Promise<PullRequestLookup> {
  const url = `${GITHUB_API_ROOT}/repos/${encodeURLSegment(repo.owner)}/${encodeURLSegment(repo.repo)}/pulls/${encodeURLSegment(number)}`
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    // A spent limit is GitHub's answer for everyone until the reset; rejected
    // credentials only take the app's name off the request.
    const hold = await readAppBudgetHold({cache})
    if (hold === 'rate-limited') {
      return {kind: 'unavailable'}
    }
    const offered =
      isNullish(credentials) || hold === 'credentials-rejected' ? undefined : credentials
    let answer = await fetchJSON({url, fetcher, credentials: offered, signal: controller.signal})
    let noted = await noteAnswer({cache, answer, offered: !isNullish(offered)})
    // GitHub rejecting the app's own credentials would otherwise take every
    // card down with it: one anonymous retry keeps public cards working at the
    // lower limit, and the rejection is remembered so later lookups skip the
    // attempt until the credentials are fixed.
    if (noted === 'credentials-rejected') {
      answer = await fetchJSON({url, fetcher, credentials: undefined, signal: controller.signal})
      noted = await noteAnswer({cache, answer, offered: false})
    }
    if (isNullish(answer)) {
      return {kind: 'unavailable'}
    }
    if (answer.response.status === 404) {
      return {kind: 'missing'}
    }
    if (noted === 'rate-limited' || !answer.response.ok) {
      return {kind: 'unavailable'}
    }

    const pull = parseGitHubPullRequest(answer.data)
    return isNullish(pull) ? {kind: 'unavailable'} : {kind: 'found', pull}
  } finally {
    clearTimeout(timer)
  }
}

interface NoteAnswerParams {
  cache: ResponseCache | undefined
  answer: JSONAnswer | undefined
  offered: boolean
}

// What an answer says about the app's budget, remembered for every later
// caller at this edge; nothing when GitHub gave no answer.
function noteAnswer({cache, answer, offered}: NoteAnswerParams) {
  return isNullish(answer)
    ? Promise.resolve(undefined)
    : noteAppBudgetAnswer({cache, response: answer.response, offered})
}

interface FetchJSONParams {
  url: string
  fetcher: PullRequestFetch
  credentials: GitHubAppCredentials | undefined
  signal: AbortSignal
}

interface JSONAnswer {
  response: Response
  // The parsed body of a successful answer; a failure's body is discarded.
  data: unknown
}

// The response and, for a successful answer, the parsed body -- read under the
// caller's deadline, since a body can stall after its headers arrive. Undefined
// for a network failure, an abort, or a body that is not JSON: all of them
// "GitHub had no answer", never "the pull request is missing".
async function fetchJSON({
  url,
  fetcher,
  credentials,
  signal,
}: FetchJSONParams): Promise<JSONAnswer | undefined> {
  try {
    const response = await fetcher(url, {
      cache: 'no-store',
      headers: createHeaders(credentials),
      signal,
    })
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined)
      return {response, data: undefined}
    }
    return {response, data: await response.json()}
  } catch {
    return undefined
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

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
