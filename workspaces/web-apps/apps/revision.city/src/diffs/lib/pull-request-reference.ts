export interface PullRequestReference {
  owner: string
  repo: string
  number: string
}

// GitHub account and repository names: letters, digits, dots, dashes and
// underscores. A pull request number is digits.
const NAME_PATTERN = /^[\w.-]+$/u
const NUMBER_PATTERN = /^\d+$/u

// A reference arrives over the wire when the viewer loader runs in the
// browser, so it is checked rather than trusted from the route. Throws on
// anything that is not the three expected strings in their expected shapes.
export function validatePullRequestReference(input: unknown): PullRequestReference {
  const {owner, repo, number} = isRecord(input) ? input : {}
  if (
    !isName(owner) ||
    !isName(repo) ||
    typeof number !== 'string' ||
    !NUMBER_PATTERN.test(number)
  ) {
    throw new Error('Invalid pull request reference.')
  }
  return {owner, repo, number}
}

// GitHub allows no name that is only dots, and the API URL would fold one
// into its neighbors.
function isName(value: unknown): value is string {
  return typeof value === 'string' && NAME_PATTERN.test(value) && value !== '.' && value !== '..'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
