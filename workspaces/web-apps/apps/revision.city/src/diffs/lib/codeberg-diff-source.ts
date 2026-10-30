import {decodeRange, encodeURLSegment} from './github-diff-source'
import {isNullish} from './nullish'

export const CODEBERG_HOST = 'codeberg.org'
export const CODEBERG_API_ROOT = `https://${CODEBERG_HOST}/api/v1`

export interface CodebergRepo {
  owner: string
  repo: string
}

export type CodebergDiffSource =
  | {kind: 'pull'; number: string; repo: CodebergRepo}
  | {kind: 'commit'; repo: CodebergRepo; sha: string}
  | {kind: 'compare'; range: string; repo: CodebergRepo}

// Forgejo writes `pulls` where GitHub writes `pull`, and the `/files` tab
// shows the diff of the pull request.
const PULL_PATTERN = /^\/([^/]+)\/([^/]+)\/pulls\/(\d+)(?:\/files)?(?:\.(?:diff|patch))?$/i
const COMMIT_PATTERN = /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{4,64})(?:\.(?:diff|patch))?$/i
const COMPARE_PATTERN = /^\/([^/]+)\/([^/]+)\/compare\/(.+?)(?:\.(?:diff|patch))?$/i

// `new URL` resolves `.` and `..` segments, so a path with one can leave the
// repository and reach another Codeberg API route.
export function hasDotSegment(path: string): boolean {
  return path.split('/').some((segment) => segment === '.' || segment === '..')
}

export function parseCodebergDiffSource(path: string): CodebergDiffSource | undefined {
  const normalizedPath = path.replace(/\/+$/, '')
  if (hasDotSegment(normalizedPath)) {
    return undefined
  }

  const pullMatch = PULL_PATTERN.exec(normalizedPath)
  if (!isNullish(pullMatch)) {
    return {kind: 'pull', number: pullMatch[3], repo: {owner: pullMatch[1], repo: pullMatch[2]}}
  }

  const commitMatch = COMMIT_PATTERN.exec(normalizedPath)
  if (!isNullish(commitMatch)) {
    return {
      kind: 'commit',
      repo: {owner: commitMatch[1], repo: commitMatch[2]},
      sha: commitMatch[3],
    }
  }

  const compareMatch = COMPARE_PATTERN.exec(normalizedPath)
  if (!isNullish(compareMatch)) {
    return {
      kind: 'compare',
      range: decodeRange(compareMatch[3]),
      repo: {owner: compareMatch[1], repo: compareMatch[2]},
    }
  }

  return undefined
}

// Pull requests and commits use the API. The API has no diff form of a
// compare, so a compare uses the `.diff` form of the compare page.
export function createCodebergPatchURL(source: CodebergDiffSource): string {
  const repoPath = `${encodeURLSegment(source.repo.owner)}/${encodeURLSegment(source.repo.repo)}`
  switch (source.kind) {
    case 'pull':
      return `${CODEBERG_API_ROOT}/repos/${repoPath}/pulls/${encodeURLSegment(source.number)}.diff`
    case 'commit':
      return `${CODEBERG_API_ROOT}/repos/${repoPath}/git/commits/${encodeURLSegment(source.sha)}.diff`
    case 'compare':
      return `https://${CODEBERG_HOST}/${repoPath}/compare/${encodeURLSegment(source.range)}.diff`
  }
}

export function createCodebergPageURL(source: CodebergDiffSource): string {
  const repoPath = `https://${CODEBERG_HOST}/${encodeURLSegment(source.repo.owner)}/${encodeURLSegment(source.repo.repo)}`
  switch (source.kind) {
    case 'pull':
      return `${repoPath}/pulls/${encodeURLSegment(source.number)}`
    case 'commit':
      return `${repoPath}/commit/${encodeURLSegment(source.sha)}`
    case 'compare':
      return `${repoPath}/compare/${encodeURLSegment(source.range)}`
  }
}
