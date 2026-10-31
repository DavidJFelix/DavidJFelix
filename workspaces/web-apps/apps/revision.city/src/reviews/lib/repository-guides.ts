import type {GitHubRepository, GitHubRequest} from './github-api'
import {loadRepositorySnapshot, type RepositorySnapshot} from './repository-snapshot'
import {cutText} from './review-tools'

export const GUIDE_FILE_NAME = 'AGENTS.md'

// Each model call sends the guides again, so each guide stops at this many
// characters. The root guide of this repository has about 10,000.
export const MAX_GUIDE_CHARS = 12_000

// The guides are part of the same Workflow step result as the selected files,
// and Cloudflare keeps at most 1 MiB for each step result. V8 stores at most 2
// bytes for each character, so the guides use at most 100,000 bytes.
export const MAX_TOTAL_GUIDE_CHARS = 50_000

export interface Guide {
  path: string
  text: string
}

export interface GuidePathsParams {
  path: string
  exists: (path: string) => boolean
}

// The root guide and the guide nearest to the file, from the file's folder up.
export function guidePaths({path, exists}: GuidePathsParams): string[] {
  const folders = path.split('/').slice(0, -1)
  const nearest = folders
    .map((_, index) => `${folders.slice(0, folders.length - index).join('/')}/${GUIDE_FILE_NAME}`)
    .find(exists)
  return [GUIDE_FILE_NAME, ...(nearest === undefined ? [] : [nearest])].filter(exists)
}

export interface ReadGuidesParams {
  // Read at the base commit, so the pull request cannot change its own rules.
  snapshot: RepositorySnapshot | undefined
  paths: readonly string[]
}

// Returns the guide text by guide path, for each guide that applies to one of
// the paths. The root guide comes first, so the total limit never leaves it out.
export async function readGuides({
  snapshot,
  paths,
}: ReadGuidesParams): Promise<Record<string, string>> {
  if (snapshot === undefined) {
    return {}
  }
  const exists = (path: string) => snapshot.entries.get(path)?.type === 'blob'
  const guidePathSet = new Set(paths.flatMap((path) => guidePaths({path, exists})))
  const guides = await Promise.all(
    [...guidePathSet].map(async (path) => {
      const sha = snapshot.entries.get(path)?.sha ?? ''
      return [path, capGuide(new TextDecoder().decode(await snapshot.readBlob(sha)))] as const
    }),
  )
  let totalChars = 0
  return Object.fromEntries(
    guides.filter(([, text]) => {
      totalChars += text.length
      return totalChars <= MAX_TOTAL_GUIDE_CHARS
    }),
  )
}

export interface ReadBaseGuidesParams {
  request: GitHubRequest
  repository: GitHubRepository
  baseSha: string
  paths: readonly string[]
}

// The guides only add context. Without them the review still runs.
export async function readBaseGuides({
  request,
  repository,
  baseSha,
  paths,
}: ReadBaseGuidesParams): Promise<Record<string, string>> {
  return loadRepositorySnapshot({request, repository, commitSha: baseSha})
    .then((snapshot) => readGuides({snapshot, paths}))
    .catch((error: unknown) => {
      console.warn('Could not read the repository guides', {error: String(error)})
      return {}
    })
}

function capGuide(rawText: string): string {
  const text = rawText.trim()
  const shown = cutText(text, MAX_GUIDE_CHARS)
  const notShown = text.length - shown.length
  return notShown > 0 ? `${shown}\n(${notShown} more characters not shown)` : shown
}

export interface SelectGuidesParams {
  guides: Readonly<Record<string, string>>
  path: string
}

export function selectGuides({guides, path}: SelectGuidesParams): Guide[] {
  return guidePaths({path, exists: (guidePath) => Object.hasOwn(guides, guidePath)}).map(
    (guidePath) => ({path: guidePath, text: guides[guidePath]}),
  )
}
