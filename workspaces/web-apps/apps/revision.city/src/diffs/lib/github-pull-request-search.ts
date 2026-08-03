import {isNullish} from './nullish'

const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const USER_AGENT = 'revision-city-diffs'
// GitHub rejects search queries longer than 256 characters, so repository
// qualifiers are packed into as few queries as fit.
const SEARCH_QUERY_MAX_LENGTH = 256
const SEARCH_BASE_QUERY = 'is:pr is:open archived:false'
export const SEARCH_PAGE_SIZE = 20

export type PullRequestFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

export interface PullRequestSummary {
  owner: string
  repo: string
  number: number
  title: string
  author?: string
  updatedAt?: string
  draft: boolean
}

export interface PullRequestSearchResult {
  items: PullRequestSummary[]
  totalCount: number
  truncated?: boolean
}

export interface SearchPullRequestsParams {
  fetcher: PullRequestFetch
  qualifiers: readonly string[]
  token: string
}

// One search API call: open pull requests matching the qualifiers (all OR-ed
// by GitHub), newest activity first. Throws on a non-ok answer so the caller
// can tell "GitHub is unavailable" from "nothing matched".
export async function searchPullRequests({
  fetcher,
  qualifiers,
  token,
}: SearchPullRequestsParams): Promise<PullRequestSearchResult> {
  const url = new URL('/search/issues', GITHUB_API_ROOT)
  url.searchParams.set('q', [SEARCH_BASE_QUERY, ...qualifiers].join(' '))
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', String(SEARCH_PAGE_SIZE))

  const response = await fetcher(url.href, {
    cache: 'no-store',
    headers: createGitHubJSONHeaders(token),
  })
  if (!response.ok) {
    throw new Error(`GitHub search answered ${response.status}`)
  }

  const data: unknown = await response.json()
  const items =
    isRecord(data) && Array.isArray(data.items)
      ? data.items
          .map((item) => parsePullRequestSummary(item))
          .filter((item): item is PullRequestSummary => item !== undefined)
      : []
  const totalCount =
    isRecord(data) && typeof data.total_count === 'number' ? data.total_count : items.length
  return {items, totalCount}
}

export interface SearchChunkedPullRequestsParams extends SearchPullRequestsParams {
  chunkLimit: number
}

// Searches a qualifier list too long for one query, merging the chunked
// answers back into one newest-first page.
export async function searchChunkedPullRequests({
  chunkLimit,
  fetcher,
  qualifiers,
  token,
}: SearchChunkedPullRequestsParams): Promise<PullRequestSearchResult> {
  if (qualifiers.length === 0) {
    return {items: [], totalCount: 0}
  }

  const {chunks, truncated} = chunkSearchQualifiers(qualifiers, chunkLimit)
  const results = await Promise.all(
    chunks.map((chunk) => searchPullRequests({fetcher, qualifiers: chunk, token})),
  )

  const items = results
    .flatMap((result) => result.items)
    .toSorted((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, SEARCH_PAGE_SIZE)
  const totalCount = results.reduce((sum, result) => sum + result.totalCount, 0)
  return {items, totalCount, truncated}
}

export interface QualifierChunks {
  chunks: string[][]
  truncated: boolean
}

// Packs qualifiers into as few queries as fit the query length limit, dropping
// the tail once the chunk budget is spent.
export function chunkSearchQualifiers(
  qualifiers: readonly string[],
  chunkLimit: number,
): QualifierChunks {
  const chunks: string[][] = []
  let current: string[] = []
  let currentLength = SEARCH_BASE_QUERY.length
  let truncated = false

  for (const qualifier of qualifiers) {
    if (SEARCH_BASE_QUERY.length + 1 + qualifier.length > SEARCH_QUERY_MAX_LENGTH) {
      truncated = true
      continue
    }
    if (currentLength + 1 + qualifier.length > SEARCH_QUERY_MAX_LENGTH) {
      if (chunks.length + 1 === chunkLimit) {
        truncated = true
        break
      }
      chunks.push(current)
      current = []
      currentLength = SEARCH_BASE_QUERY.length
    }
    current.push(qualifier)
    currentLength += 1 + qualifier.length
  }
  if (current.length > 0) {
    chunks.push(current)
  }

  return {chunks, truncated}
}

function parsePullRequestSummary(item: unknown): PullRequestSummary | undefined {
  if (!isRecord(item) || typeof item.number !== 'number' || typeof item.title !== 'string') {
    return undefined
  }

  const repo = parseRepositoryURL(item.repository_url)
  if (isNullish(repo)) {
    return undefined
  }

  const user = item.user
  return {
    ...repo,
    number: item.number,
    title: item.title,
    author: isRecord(user) ? readOptionalString(user.login) : undefined,
    updatedAt: readOptionalString(item.updated_at),
    draft: item.draft === true,
  }
}

// Search items name their repository as an API URL:
// https://api.github.com/repos/{owner}/{repo}
function parseRepositoryURL(value: unknown): {owner: string; repo: string} | undefined {
  const prefix = `${GITHUB_API_ROOT}/repos/`
  if (typeof value !== 'string' || !value.startsWith(prefix)) {
    return undefined
  }

  const [owner, repo, ...rest] = value.slice(prefix.length).split('/')
  if (isNullish(owner) || owner === '' || isNullish(repo) || repo === '' || rest.length > 0) {
    return undefined
  }
  return {owner, repo}
}

// A quiet read for the endpoints that gate optional groups: any failure reads
// as "nothing there" rather than an error.
export async function fetchGitHubJSON(
  path: string,
  token: string,
  fetcher: PullRequestFetch,
): Promise<unknown> {
  try {
    const response = await fetcher(new URL(path, GITHUB_API_ROOT).href, {
      cache: 'no-store',
      headers: createGitHubJSONHeaders(token),
    })
    return response.ok ? await response.json() : undefined
  } catch {
    return undefined
  }
}

function createGitHubJSONHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
