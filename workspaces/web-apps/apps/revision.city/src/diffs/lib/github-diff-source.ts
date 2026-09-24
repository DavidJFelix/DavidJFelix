import {isNullish} from './nullish'
export interface GitHubRepo {
  owner: string
  repo: string
}

export type GitHubDiffSource =
  | {kind: 'pull'; number: string; repo: GitHubRepo}
  | {kind: 'commit'; repo: GitHubRepo; sha: string}
  | {kind: 'compare'; range: string; repo: GitHubRepo}

export function parseGitHubDiffSource(path: string): GitHubDiffSource | undefined {
  const normalizedPath = path.replace(/\/+$/, '')
  const pullMatch = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\.(?:diff|patch))?$/i.exec(normalizedPath)
  if (!isNullish(pullMatch)) {
    return {
      kind: 'pull',
      number: pullMatch[3],
      repo: {owner: pullMatch[1], repo: pullMatch[2]},
    }
  }

  const commitMatch = /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{4,40})(?:\.(?:diff|patch))?$/i.exec(
    normalizedPath,
  )
  if (!isNullish(commitMatch)) {
    return {
      kind: 'commit',
      repo: {owner: commitMatch[1], repo: commitMatch[2]},
      sha: commitMatch[3],
    }
  }

  const compareMatch = /^\/([^/]+)\/([^/]+)\/compare\/(.+?)(?:\.(?:diff|patch))?$/i.exec(
    normalizedPath,
  )
  if (!isNullish(compareMatch)) {
    return {
      kind: 'compare',
      range: decodeRange(compareMatch[3]),
      repo: {owner: compareMatch[1], repo: compareMatch[2]},
    }
  }

  return undefined
}

// A range arrives percent-encoded from a URL but already decoded from a
// router param, and a ref may carry a percent sign of its own, so a range that
// does not decode is taken as written rather than thrown at the caller.
function decodeRange(range: string): string {
  try {
    return decodeURIComponent(range)
  } catch {
    return range
  }
}

export function encodeURLSegment(value: string): string {
  return encodeURIComponent(value)
}

export function encodePath(path: string): string {
  return path.split('/').map(encodeURLSegment).join('/')
}
