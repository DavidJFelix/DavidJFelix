import {encodeURLSegment} from './github-diff-source'
import {fetchGitHubJSON, isRecord, type PullRequestFetch} from './github-pull-request-search'

const GITHUB_INSTALLATION_SETTINGS_ROOT = 'https://github.com/settings/installations'
const GITHUB_ORGANIZATIONS_ROOT = 'https://github.com/organizations'
// GitHub's largest page. Without it the list stops at 30, and an installation
// past that point reads as missing. Anything past one page is not read.
const INSTALLATION_PAGE_SIZE = 100

export interface AppInstallation {
  id: number
  accountLogin: string
  // Anything but an explicit "all" is read as a selection, which costs one
  // more request but never searches a repository the app was not granted.
  repositorySelection: 'all' | 'selected'
  // The page where the installation's repository selection is edited.
  settingsURL: string
}

export interface ReadAppInstallationsParams {
  fetcher: PullRequestFetch
  token: string
}

// The app's installations this token can see, one page of them. A failure
// reads as no installations.
export async function readAppInstallations({
  fetcher,
  token,
}: ReadAppInstallationsParams): Promise<AppInstallation[]> {
  const data = await fetchGitHubJSON(
    `/user/installations?per_page=${INSTALLATION_PAGE_SIZE}`,
    token,
    fetcher,
  )
  const entries = isRecord(data) && Array.isArray(data.installations) ? data.installations : []
  return entries
    .map((entry) => parseInstallation(entry))
    .filter((installation): installation is AppInstallation => installation !== undefined)
}

function parseInstallation(entry: unknown): AppInstallation | undefined {
  if (!isRecord(entry) || typeof entry.id !== 'number' || !isRecord(entry.account)) {
    return undefined
  }
  const accountLogin = entry.account.login
  if (typeof accountLogin !== 'string' || accountLogin === '') {
    return undefined
  }
  return {
    id: entry.id,
    accountLogin,
    repositorySelection: entry.repository_selection === 'all' ? 'all' : 'selected',
    settingsURL: readSettingsURL({accountLogin, entry, id: entry.id}),
  }
}

interface ReadSettingsURLParams {
  accountLogin: string
  entry: Record<string, unknown>
  id: number
}

// GitHub reports the installation's own settings page. The URL is made again
// only if that field is missing, since the personal and organization forms
// differ.
function readSettingsURL({accountLogin, entry, id}: ReadSettingsURLParams): string {
  const htmlURL = entry.html_url
  if (typeof htmlURL === 'string' && htmlURL !== '') {
    return htmlURL
  }
  return entry.target_type === 'Organization'
    ? `${GITHUB_ORGANIZATIONS_ROOT}/${encodeURLSegment(accountLogin)}/settings/installations/${id}`
    : `${GITHUB_INSTALLATION_SETTINGS_ROOT}/${id}`
}
