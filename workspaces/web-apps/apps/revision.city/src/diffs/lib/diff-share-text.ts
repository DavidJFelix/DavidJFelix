import {encodeURLSegment, type GitHubDiffSource, parseGitHubDiffSource} from './github-diff-source'
import type {PublicPullRequest} from './github-public-pull-request'
import {isNullish} from './nullish'

// Where the per-diff share cards are served; the path below it mirrors the
// viewer's own, with the card's extension.
export const DIFF_CARD_BASE_PATH = '/og/diffs'
const DIFF_CARD_EXTENSION = '.png'
const SHORT_SHA_LENGTH = 7
// Satori wraps a long title but only ever picks between two sizes, so past
// this length a pull request title would push the card's footer off the canvas.
const CARD_TITLE_MAX_LENGTH = 90
const SITE_SUFFIX = 'in the revision.city diff viewer.'

// The share card's own lines: the label is the big text, the description the
// muted line under it, the author the footer byline.
export interface DiffShareCard {
  title: string
  description: string
  author?: string
}

export interface DiffShareText {
  // og:title, and the leading part of the document title.
  title: string
  description: string
  card: DiffShareCard
  // The card's path on this origin, and the alt text for it.
  imagePath: string
  imageAlt: string
}

export interface GetDiffShareTextParams {
  source: GitHubDiffSource
  // GitHub's public view of the pull request, when the source is one and
  // GitHub shows it to anyone; absent, the text says only what the URL says.
  pull?: PublicPullRequest
}

// What a shared diff link says about itself: the text behind its og: tags and
// the lines drawn on its card. Everything here is derived from the URL and
// from GitHub's public view of a pull request, so a private diff unfurls with
// the same repository and number its link already carries, and nothing more.
export function getDiffShareText({source, pull}: GetDiffShareTextParams): DiffShareText {
  const label = getSourceLabel(source)
  const repo = `${source.repo.owner}/${source.repo.repo}`
  const base = {imagePath: getDiffCardPath(source), imageAlt: `Title card for ${label}`}
  if (source.kind === 'pull') {
    return isNullish(pull)
      ? {
          ...base,
          title: label,
          description: `Pull request #${source.number} in ${repo}, ${SITE_SUFFIX}`,
          card: {title: label, description: 'Pull request'},
        }
      : describePullRequest({label, number: source.number, pull, repo, ...base})
  }
  if (source.kind === 'commit') {
    return {
      ...base,
      title: label,
      description: `Commit ${shortenSha(source.sha)} in ${repo}, ${SITE_SUFFIX}`,
      card: {title: label, description: 'Commit'},
    }
  }
  return {
    ...base,
    title: label,
    description: `Comparing ${source.range} in ${repo}, ${SITE_SUFFIX}`,
    card: {title: label, description: 'Compare'},
  }
}

interface DescribePullRequestParams {
  label: string
  number: string
  pull: PublicPullRequest
  repo: string
  imagePath: string
  imageAlt: string
}

function describePullRequest({
  label,
  number,
  pull,
  repo,
  imagePath,
  imageAlt,
}: DescribePullRequestParams): DiffShareText {
  const stats = formatPullRequestStats(pull)
  const byline = isNullish(pull.author) ? undefined : `by ${pull.author}`
  const sentence = [`${describePullRequestKind(pull)} #${number}`, byline, `in ${repo}`]
    .filter((part) => !isNullish(part))
    .join(' ')
  return {
    imagePath,
    imageAlt,
    title: `${pull.title} · ${label}`,
    description: isNullish(stats) ? `${sentence}.` : `${sentence}: ${stats}.`,
    card: {
      title: truncate(pull.title, CARD_TITLE_MAX_LENGTH),
      description: isNullish(stats) ? label : `${label} · ${stats}`,
      author: byline,
    },
  }
}

// The state a reviewer would want to know before opening the link. Merged
// outranks the rest, and a closed draft reads as closed rather than a draft.
function describePullRequestKind(pull: PublicPullRequest): string {
  if (pull.state === 'merged') {
    return 'Merged pull request'
  }
  if (pull.state === 'closed') {
    return 'Closed pull request'
  }
  return pull.draft ? 'Draft pull request' : 'Pull request'
}

function formatPullRequestStats(pull: PublicPullRequest): string | undefined {
  if (isNullish(pull.changedFiles) || isNullish(pull.additions) || isNullish(pull.deletions)) {
    return undefined
  }
  const files = pull.changedFiles === 1 ? '1 file changed' : `${pull.changedFiles} files changed`
  return `${files}, +${pull.additions} -${pull.deletions}`
}

// How the viewer names each kind of diff: the repository, then what in it.
function getSourceLabel(source: GitHubDiffSource): string {
  const repo = `${source.repo.owner}/${source.repo.repo}`
  if (source.kind === 'pull') {
    return `${repo} #${source.number}`
  }
  if (source.kind === 'commit') {
    return `${repo} @ ${shortenSha(source.sha)}`
  }
  return `${repo} ${source.range}`
}

// The card's path mirrors the viewer's, so a link and its card read the same:
// /diffs/owner/repo/pull/1 shares /og/diffs/owner/repo/pull/1.png.
export function getDiffCardPath(source: GitHubDiffSource): string {
  const repo = `${encodeURLSegment(source.repo.owner)}/${encodeURLSegment(source.repo.repo)}`
  const tail =
    source.kind === 'pull'
      ? `pull/${encodeURLSegment(source.number)}`
      : source.kind === 'commit'
        ? `commit/${encodeURLSegment(source.sha)}`
        : `compare/${encodeURLSegment(source.range)}`
  return `${DIFF_CARD_BASE_PATH}/${repo}/${tail}${DIFF_CARD_EXTENSION}`
}

// The inverse of getDiffCardPath for the card route: the diff a card path
// names, or undefined when the path is not one the viewer would render.
export function parseDiffCardPath(pathname: string): GitHubDiffSource | undefined {
  if (!pathname.startsWith(`${DIFF_CARD_BASE_PATH}/`) || !pathname.endsWith(DIFF_CARD_EXTENSION)) {
    return undefined
  }
  const path = pathname.slice(DIFF_CARD_BASE_PATH.length, -DIFF_CARD_EXTENSION.length)
  try {
    return parseGitHubDiffSource(path)
  } catch {
    // A compare range that does not decode is not a diff the viewer serves.
    return undefined
  }
}

function shortenSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH)
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`
}
