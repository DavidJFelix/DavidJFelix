const GITHUB_ORIGIN = 'https://github.com'

// The single action that unblocks a visitor who cannot read a diff. The server
// works out which one applies while diagnosing a GitHub failure; the viewer's
// error panel renders it as the primary button.
export type GitHubAccessRemedy =
  | {kind: 'sign-in'}
  | {kind: 'sign-in-again'}
  | {kind: 'grant-repo-access'; url: string}

// Reads a remedy off an error response body. The URL is re-checked against
// github.com rather than trusted, so a malformed or tampered payload cannot
// turn the panel's primary button into an arbitrary link.
export function parseGitHubAccessRemedy(value: unknown): GitHubAccessRemedy | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  if (value.kind === 'sign-in' || value.kind === 'sign-in-again') {
    return {kind: value.kind}
  }

  if (
    value.kind === 'grant-repo-access' &&
    typeof value.url === 'string' &&
    isGitHubURL(value.url)
  ) {
    return {kind: 'grant-repo-access', url: value.url}
  }

  return undefined
}

function isGitHubURL(value: string): boolean {
  try {
    return new URL(value).origin === GITHUB_ORIGIN
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
