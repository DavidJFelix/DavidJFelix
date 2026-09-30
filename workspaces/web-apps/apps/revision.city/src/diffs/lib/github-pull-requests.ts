import {type GitHubAuthOptions, resolveGitHubAuth, withSetCookieHeaders} from './github-auth'
import {
  fetchGitHubJSON,
  isRecord,
  type PullRequestFetch,
  type PullRequestSearchResult,
  type PullRequestSummary,
  SEARCH_PAGE_SIZE,
  searchChunkedPullRequests,
  searchPullRequests,
} from './github-pull-request-search'
import {isNullish} from './nullish'

export type {PullRequestSummary} from './github-pull-request-search'

// Search is limited to 30 requests per minute per user, so the chunked groups
// are bounded rather than exhaustive: two fixed queries (assigned, owned) plus
// at most these many per chunked group keeps a page load well inside it.
const MEMBER_SEARCH_CHUNK_LIMIT = 2
const WATCHED_SEARCH_CHUNK_LIMIT = 3
// One page of watch subscriptions; a full page means the list was cut there.
const WATCHED_REPO_PAGE_SIZE = 100
// One page each of the app's installations and of a selected-repository
// installation's grants; anything past a page reads as not searchable.
const INSTALLATION_PAGE_SIZE = 100

// Why the signed-in visitor can see a pull request, in the order the groups
// are reported: assigned to them, in a repository they own, in one they are a
// member of, or in one they watch.
export type PullRequestGroupKind = 'assigned' | 'owned' | 'member' | 'watched'

export interface PullRequestGroup {
  kind: PullRequestGroupKind
  pullRequests: PullRequestSummary[]
  // Open pull requests matching the group on GitHub's side, which can exceed
  // the rows carried here (the page is capped, and rows already claimed by an
  // earlier group are dropped).
  totalCount: number
  // True when the group's repository list was cut before searching, so
  // totalCount may miss pull requests past the cut.
  truncated?: boolean
}

export interface PullRequestListBody {
  groups: PullRequestGroup[]
}

// Lists open pull requests the signed-in visitor can reach, grouped by why
// they can reach them. Each pull request is reported once, under the first
// group that claims it. Answers 401 signed out and 502 when GitHub's search
// is unavailable, so the client can tell "sign in" from "try again later". A
// visitor with nothing searchable (no pull requests, or no repositories
// granted to the app) gets 200 with empty groups, not an error.
export async function handlePullRequestListRequest(
  request: Request,
  options: GitHubAuthOptions = {},
): Promise<Response> {
  const auth = await resolveGitHubAuth(request, options)
  if (isNullish(auth.session)) {
    return withSetCookieHeaders(
      createJSONResponse({message: 'Sign in with GitHub to list pull requests.'}, 401),
      auth.setCookieHeaders,
    )
  }

  const fetcher = options.fetch ?? fetch
  try {
    const groups = await listPullRequestGroups({
      fetcher,
      login: auth.session.login,
      token: auth.session.accessToken,
    })
    return withSetCookieHeaders(createJSONResponse({groups}, 200), auth.setCookieHeaders)
  } catch {
    return withSetCookieHeaders(
      createJSONResponse({message: 'GitHub could not list pull requests right now.'}, 502),
      auth.setCookieHeaders,
    )
  }
}

interface ListPullRequestGroupsParams {
  fetcher: PullRequestFetch
  login: string
  token: string
}

async function listPullRequestGroups({
  fetcher,
  login,
  token,
}: ListPullRequestGroupsParams): Promise<PullRequestGroup[]> {
  // The org, subscription, and installation lists gate the member and watched
  // searches, so the fixed searches run alongside them and the dependent ones
  // follow.
  const [assigned, owned, orgLogins, watchedRepos, installations] = await Promise.all([
    searchPullRequests({fetcher, qualifiers: ['assignee:@me'], token}),
    searchPullRequests({fetcher, qualifiers: ['user:@me'], token}),
    fetchOrganizationLogins(token, fetcher),
    fetchWatchedRepositories(token, fetcher),
    fetchAppInstallations(token, fetcher),
  ])

  // The search API reaches only repositories the app is installed on, and
  // rejects a whole query when any `org:` or `repo:` qualifier names one it is
  // not, so both groups are narrowed to installed accounts before searching
  // rather than losing a group to one organization or repository not granted.
  const installationsByAccount = new Map(
    installations.map((installation) => [installation.accountLogin.toLowerCase(), installation]),
  )
  const memberOrgs = orgLogins.filter((org) => installationsByAccount.has(org.toLowerCase()))

  // Watched repositories owned by the visitor or one of their organizations
  // are already covered by the owned and member groups.
  const coveredOwners = new Set([login, ...orgLogins].map((owner) => owner.toLowerCase()))
  const uncoveredWatchedRepos = watchedRepos.filter(
    (repo) => !coveredOwners.has(repo.owner.toLowerCase()),
  )

  const [member, watched] = await Promise.all([
    searchChunkedPullRequests({
      chunkLimit: MEMBER_SEARCH_CHUNK_LIMIT,
      fetcher,
      qualifiers: memberOrgs.map((org) => `org:${org}`),
      token,
    }),
    searchWatchedPullRequests({fetcher, installationsByAccount, token, uncoveredWatchedRepos}),
  ])
  const watchedListTruncated = watchedRepos.length === WATCHED_REPO_PAGE_SIZE

  const seen = new Set<string>()
  return [
    createPullRequestGroup('assigned', assigned, seen),
    createPullRequestGroup('owned', owned, seen),
    createPullRequestGroup('member', member, seen),
    createPullRequestGroup(
      'watched',
      {...watched, truncated: watched.truncated || watchedListTruncated},
      seen,
    ),
  ]
}

interface SearchWatchedPullRequestsParams {
  fetcher: PullRequestFetch
  installationsByAccount: ReadonlyMap<string, GitHubAppInstallation>
  token: string
  uncoveredWatchedRepos: readonly WatchedRepo[]
}

// Searches the watched repositories the app can actually reach: those whose
// owner has an installation, and, where the installation grants selected
// repositories only, those it lists. The grant lists are one page each, so a
// longer one leaves the group truncated.
async function searchWatchedPullRequests({
  fetcher,
  installationsByAccount,
  token,
  uncoveredWatchedRepos,
}: SearchWatchedPullRequestsParams): Promise<PullRequestSearchResult> {
  const candidates = uncoveredWatchedRepos.flatMap((repo) => {
    const installation = installationsByAccount.get(repo.owner.toLowerCase())
    return isNullish(installation) ? [] : [{installation, repo}]
  })
  const selectedInstallations = [
    ...new Set(
      candidates
        .map(({installation}) => installation)
        .filter((installation) => installation.repositorySelection === 'selected'),
    ),
  ]
  const grants = await Promise.all(
    selectedInstallations.map((installation) =>
      fetchInstallationRepositoryNames(installation.id, token, fetcher),
    ),
  )
  const grantedNames = new Set(grants.flatMap((grant) => grant.names))

  const qualifiers = candidates
    .filter(
      ({installation, repo}) =>
        installation.repositorySelection === 'all' ||
        grantedNames.has(`${repo.owner}/${repo.repo}`.toLowerCase()),
    )
    .map(({repo}) => `repo:${repo.owner}/${repo.repo}`)
  const result = await searchChunkedPullRequests({
    chunkLimit: WATCHED_SEARCH_CHUNK_LIMIT,
    fetcher,
    qualifiers,
    token,
  })
  return {...result, truncated: result.truncated || grants.some((grant) => grant.truncated)}
}

function createPullRequestGroup(
  kind: PullRequestGroupKind,
  search: PullRequestSearchResult,
  seen: Set<string>,
): PullRequestGroup {
  const pullRequests: PullRequestSummary[] = []
  for (const item of search.items) {
    const key = `${item.owner.toLowerCase()}/${item.repo.toLowerCase()}#${item.number}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    pullRequests.push(item)
    if (pullRequests.length === SEARCH_PAGE_SIZE) {
      break
    }
  }

  const group: PullRequestGroup = {kind, pullRequests, totalCount: search.totalCount}
  return search.truncated === true ? {...group, truncated: true} : group
}

// A failure here means the app was not granted organization visibility (or the
// account has none), which reads as "no member repositories" rather than an
// error worth failing the whole list over.
async function fetchOrganizationLogins(
  token: string,
  fetcher: PullRequestFetch,
): Promise<string[]> {
  const data = await fetchGitHubJSON('/user/orgs?per_page=100', token, fetcher)
  if (!Array.isArray(data)) {
    return []
  }
  return data
    .map((org) => (isRecord(org) ? org.login : undefined))
    .filter((login): login is string => typeof login === 'string' && login !== '')
}

interface WatchedRepo {
  owner: string
  repo: string
}

// Same forgiving read as organizations: an app without watching visibility
// simply reports no watched repositories.
async function fetchWatchedRepositories(
  token: string,
  fetcher: PullRequestFetch,
): Promise<WatchedRepo[]> {
  const data = await fetchGitHubJSON(
    `/user/subscriptions?per_page=${WATCHED_REPO_PAGE_SIZE}`,
    token,
    fetcher,
  )
  if (!Array.isArray(data)) {
    return []
  }
  return data
    .map((repo) => (isRecord(repo) ? parseFullName(repo.full_name) : undefined))
    .filter((repo): repo is WatchedRepo => repo !== undefined)
}

interface GitHubAppInstallation {
  id: number
  accountLogin: string
  repositorySelection: 'all' | 'selected'
}

// The app's installations this token can see, each naming the account it is
// installed on and whether it reaches every repository there or a selection.
// A failure reads as no installations, which leaves the member and watched
// groups empty rather than failing the list.
async function fetchAppInstallations(
  token: string,
  fetcher: PullRequestFetch,
): Promise<GitHubAppInstallation[]> {
  const data = await fetchGitHubJSON(
    `/user/installations?per_page=${INSTALLATION_PAGE_SIZE}`,
    token,
    fetcher,
  )
  const entries = isRecord(data) && Array.isArray(data.installations) ? data.installations : []
  return entries
    .map((entry) => parseInstallation(entry))
    .filter((installation): installation is GitHubAppInstallation => installation !== undefined)
}

function parseInstallation(entry: unknown): GitHubAppInstallation | undefined {
  if (!isRecord(entry) || typeof entry.id !== 'number' || !isRecord(entry.account)) {
    return undefined
  }
  const accountLogin = entry.account.login
  if (typeof accountLogin !== 'string' || accountLogin === '') {
    return undefined
  }
  // Anything but an explicit "all" is read as a selection, which costs one
  // more request but never searches a repository the app was not granted.
  return {
    id: entry.id,
    accountLogin,
    repositorySelection: entry.repository_selection === 'all' ? 'all' : 'selected',
  }
}

interface InstallationRepositoryNames {
  // Lowercased owner/repo names, for a case-insensitive match.
  names: string[]
  truncated: boolean
}

// One page of the repositories a selected-repository installation grants. A
// read that fails is not an empty grant list: the repositories under it are
// unknown rather than absent, so the result reads as truncated.
async function fetchInstallationRepositoryNames(
  installationId: number,
  token: string,
  fetcher: PullRequestFetch,
): Promise<InstallationRepositoryNames> {
  const data = await fetchGitHubJSON(
    `/user/installations/${installationId}/repositories?per_page=${INSTALLATION_PAGE_SIZE}`,
    token,
    fetcher,
  )
  if (!isRecord(data) || !Array.isArray(data.repositories)) {
    return {names: [], truncated: true}
  }
  const entries = data.repositories
  const names = entries
    .map((repo) => (isRecord(repo) && typeof repo.full_name === 'string' ? repo.full_name : ''))
    .filter((name) => name !== '')
    .map((name) => name.toLowerCase())
  const totalCount = typeof data.total_count === 'number' ? data.total_count : names.length
  return {names, truncated: totalCount > names.length}
}

function parseFullName(value: unknown): WatchedRepo | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const separatorIndex = value.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return undefined
  }
  return {owner: value.slice(0, separatorIndex), repo: value.slice(separatorIndex + 1)}
}

function createJSONResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {'Cache-Control': 'no-store', Vary: 'Cookie'},
  })
}
