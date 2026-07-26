import type {GitHubAccessRemedy} from './github-access-remedy'
import {encodeURLSegment, type GitHubDiffSource, type GitHubRepo} from './github-diff-source'
import {isNullish} from './nullish'

const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_APPS_ROOT = 'https://github.com/apps'
const GITHUB_INSTALLATION_SETTINGS_ROOT = 'https://github.com/settings/installations'
const GITHUB_ORGANIZATIONS_ROOT = 'https://github.com/organizations'
const USER_AGENT = 'revision-city-diffs'
// GitHub answers 404 rather than 403 for repositories a token cannot see, so
// all three statuses mean "look closer" rather than "the diff is missing".
const ACCESS_FAILURE_STATUSES = new Set([401, 403, 404])
const SIGN_IN_AGAIN_FAILURE: GitHubAccessFailure = {
  message: 'GitHub rejected the sign-in as expired or revoked.',
  remedy: {kind: 'sign-in-again'},
}

type AccessFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

export interface GitHubAccessFailure {
  message: string
  remedy?: GitHubAccessRemedy
}

export interface DiagnoseGitHubAccessParams {
  fetch?: AccessFetch
  // The signed-in login, used only to tell the visitor's own account apart from
  // someone else's, where granting access may be another person's call.
  login?: string
  source?: GitHubDiffSource
  status: number
  token?: string
}

// Turns an opaque GitHub failure into something the visitor can act on. GitHub
// hides repositories a token cannot see behind a plain 404, so the only way to
// tell "not signed in" from "app not installed" from "repository not granted"
// is to ask GitHub about the token, the repository, and the app's installations
// in turn. Returns undefined when the status is not access-shaped or nothing
// useful can be said, leaving the caller's own message in place.
export async function diagnoseGitHubAccess(
  params: DiagnoseGitHubAccessParams,
): Promise<GitHubAccessFailure | undefined> {
  if (!ACCESS_FAILURE_STATUSES.has(params.status)) {
    return undefined
  }

  const {source, token} = params
  if (isNullish(token)) {
    return isNullish(source)
      ? undefined
      : {
          message: `The revision.city GitHub App cannot see ${formatRepo(source.repo)}. If it is private, sign in with GitHub and grant the app access to it.`,
          remedy: {kind: 'sign-in'},
        }
  }

  return describeSignedInFailure({...params, token})
}

async function describeSignedInFailure({
  fetch: fetcher = fetch,
  login,
  source,
  token,
}: DiagnoseGitHubAccessParams & {token: string}): Promise<GitHubAccessFailure | undefined> {
  const tokenStatus = await fetchGitHubStatus('/user', token, fetcher)
  if (tokenStatus === 401) {
    return SIGN_IN_AGAIN_FAILURE
  }
  if (tokenStatus === 403) {
    return {
      message:
        'GitHub accepted the sign-in but blocked it. Check SSO authorization or rate limits.',
    }
  }
  if (tokenStatus !== 200) {
    return {message: 'GitHub could not confirm the sign-in.', remedy: {kind: 'sign-in-again'}}
  }

  if (isNullish(source)) {
    return {message: 'GitHub accepted the sign-in, but the patch endpoint was not accessible.'}
  }

  const repoName = formatRepo(source.repo)
  const repoStatus = await fetchGitHubStatus(
    `/repos/${encodeURLSegment(source.repo.owner)}/${encodeURLSegment(source.repo.repo)}`,
    token,
    fetcher,
  )
  if (repoStatus === 401) {
    return SIGN_IN_AGAIN_FAILURE
  }
  if (repoStatus === 403) {
    return {
      message: `GitHub accepted the sign-in but blocked access to ${repoName}. Check SSO authorization or rate limits.`,
    }
  }
  if (repoStatus === 404) {
    return describeMissingRepoAccess({login, repo: source.repo, token, fetcher})
  }
  if (source.kind === 'pull') {
    return {
      message: `${repoName} is readable, but pull request #${source.number} is not. Check that the pull request exists.`,
    }
  }
  return {message: `${repoName} is readable, but the requested diff is not.`}
}

interface DescribeMissingRepoAccessParams {
  fetcher: AccessFetch
  login?: string
  repo: GitHubRepo
  token: string
}

// The signed-in token works and the repository is invisible to it. Either the
// app is not installed on the owner at all, or it is installed with a
// repository selection this one is not part of -- different destinations on
// GitHub, so the installation list decides which.
async function describeMissingRepoAccess({
  fetcher,
  login,
  repo,
  token,
}: DescribeMissingRepoAccessParams): Promise<GitHubAccessFailure> {
  const repoName = formatRepo(repo)
  const {appSlug, installations} = await readGitHubAppInstallations(token, fetcher)
  const ownerInstallation = findInstallationForOwner(installations, repo.owner)
  const grantURL = ownerInstallation?.configureURL ?? createGitHubAppInstallURL(appSlug)
  // Granting access to someone else's account or organization may be a
  // permission the visitor does not hold; GitHub turns the same flow into a
  // request to an owner, which is worth saying before they click.
  const approvalNote =
    isNullish(login) || login.toLowerCase() === repo.owner.toLowerCase()
      ? ''
      : ` If you cannot grant it yourself, GitHub asks an owner of ${repo.owner} to approve.`
  const message = isNullish(ownerInstallation)
    ? `The revision.city GitHub App is not installed on ${repo.owner}, so it cannot see ${repoName}. Install it and grant access to the repository.${approvalNote}`
    : `The revision.city GitHub App is installed on ${repo.owner} but was not granted access to ${repoName}. Add the repository to the installation, or check the URL if the name is wrong.${approvalNote}`

  return isNullish(grantURL)
    ? {message}
    : {message, remedy: {kind: 'grant-repo-access', url: grantURL}}
}

export interface ResolveGitHubManageAccessURLParams {
  fetch?: AccessFetch
  token: string
}

// Where a signed-in visitor goes to change which repositories the app may read,
// with no particular repository in mind. One installation has one obvious page;
// none or several means letting GitHub ask which account they meant. The list of
// every app they have installed is the last resort, for a deploy that has not
// been told the app's slug and cannot name the install page.
export async function resolveGitHubManageAccessURL({
  fetch: fetcher = fetch,
  token,
}: ResolveGitHubManageAccessURLParams): Promise<string> {
  const {appSlug, installations} = await readGitHubAppInstallations(token, fetcher)
  const soleInstallation = installations.length === 1 ? installations[0] : undefined
  return (
    soleInstallation?.configureURL ??
    createGitHubAppInstallURL(appSlug) ??
    GITHUB_INSTALLATION_SETTINGS_ROOT
  )
}

interface GitHubAppInstallation {
  accountLogin?: string
  configureURL: string
}

interface GitHubAppInstallations {
  appSlug?: string
  installations: GitHubAppInstallation[]
}

// Lists the app's installations this token can see. Any of them names the app's
// slug, which builds the install URL for accounts with no installation at all.
async function readGitHubAppInstallations(
  token: string,
  fetcher: AccessFetch,
): Promise<GitHubAppInstallations> {
  const data = await fetchGitHubJSON('/user/installations', token, fetcher)
  const entries = isRecord(data) && Array.isArray(data.installations) ? data.installations : []

  let appSlug: string | undefined
  const installations: GitHubAppInstallation[] = []
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue
    }
    appSlug ??= readOptionalString(entry.app_slug)
    const accountLogin = readAccountLogin(entry)
    installations.push({accountLogin, configureURL: readInstallationConfigureURL(entry)})
  }

  return {appSlug, installations}
}

function findInstallationForOwner(
  installations: readonly GitHubAppInstallation[],
  owner: string,
): GitHubAppInstallation | undefined {
  return installations.find(
    (installation) => installation.accountLogin?.toLowerCase() === owner.toLowerCase(),
  )
}

function readAccountLogin(installation: Record<string, unknown>): string | undefined {
  const account = installation.account
  return isRecord(account) ? readOptionalString(account.login) : undefined
}

// GitHub reports the installation's own settings page, which is where
// repository selection is edited. The URL is reconstructed only if that field
// is missing, since the personal and organization forms differ.
function readInstallationConfigureURL(installation: Record<string, unknown>): string {
  const htmlURL = readOptionalString(installation.html_url)
  if (!isNullish(htmlURL)) {
    return htmlURL
  }

  const id = typeof installation.id === 'number' ? String(installation.id) : ''
  const account = readAccountLogin(installation) ?? ''
  return installation.target_type === 'Organization'
    ? `${GITHUB_ORGANIZATIONS_ROOT}/${encodeURLSegment(account)}/settings/installations/${id}`
    : `${GITHUB_INSTALLATION_SETTINGS_ROOT}/${id}`
}

// The slug is public (it is the app's own github.com URL), so it is a plain
// worker var rather than a secret. A discovered slug wins because it comes from
// GitHub for this exact app; the var covers visitors with no installation yet.
function createGitHubAppInstallURL(discoveredSlug: string | undefined): string | undefined {
  const slug = discoveredSlug ?? readOptionalString(process.env.GITHUB_APP_SLUG)
  return isNullish(slug)
    ? undefined
    : `${GITHUB_APPS_ROOT}/${encodeURLSegment(slug)}/installations/new`
}

async function fetchGitHubStatus(
  path: string,
  token: string,
  fetcher: AccessFetch,
): Promise<number> {
  try {
    const response = await fetchGitHub(path, token, fetcher)
    return response.status
  } catch {
    return 0
  }
}

async function fetchGitHubJSON(
  path: string,
  token: string,
  fetcher: AccessFetch,
): Promise<unknown> {
  try {
    const response = await fetchGitHub(path, token, fetcher)
    return response.ok ? await response.json() : undefined
  } catch {
    return undefined
  }
}

function fetchGitHub(path: string, token: string, fetcher: AccessFetch): Promise<Response> {
  return fetcher(new URL(path, GITHUB_API_ROOT).href, {
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  })
}

function formatRepo(repo: GitHubRepo): string {
  return `${repo.owner}/${repo.repo}`
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
