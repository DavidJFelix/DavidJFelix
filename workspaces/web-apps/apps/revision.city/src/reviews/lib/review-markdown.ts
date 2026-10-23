import type {Finding, ReviewOutcome} from './findings'
import type {PullRequestReview} from './review-pull-request'
import {sha256Hex} from './sha256'

const ZERO_WIDTH_SPACE = '\u200B'

// GitHub shows each link to an issue or pull request in the timeline of that
// issue, but not a link through redirect.github.com. Markdown removes a
// backslash before "." or "/", so the pattern allows one there. GFM also links
// "www." after "_".
const GITHUB_HOST = /(?:(?<![\w.-])|(?<=_)(?=www))(?:www\\?\.)?github\\?\.com(?=\\?\/)/gi

// A zero-width space after "@", "#", "GH-", and "<" stops mentions, issue
// references, and HTML. One after the "&" of an entity stops an entity that
// decodes to one of those characters. The space is invisible, but it also goes
// into code spans and code blocks, and code that a reader copies keeps it.
const UNSAFE_MARKDOWN = /@(?=[a-z0-9])|#(?=\d)|GH\\?-(?=\d)|<(?=[a-z/!?])|&(?=#?[a-z0-9]+;)/gi

// GitHub shows a code block whose info string is "suggestion" as a change that
// a reader can commit. The app adds a suggestion only after it checks the
// finding's lines, so model text must not add one.
const SUGGESTION_INFO = /(?<=(?:`{3,}|~{3,})[ \t]*)(?=suggestion)/gi

// The pull request's author can steer the model, so model text and file paths
// are untrusted. Do not neutralize a suggestion: GitHub commits its text as it
// is.
export function neutralizeMarkdown(text: string): string {
  return text
    .replaceAll(GITHUB_HOST, 'redirect.github.com')
    .replaceAll(SUGGESTION_INFO, ZERO_WIDTH_SPACE)
    .replaceAll(UNSAFE_MARKDOWN, (match) => `${match}${ZERO_WIDTH_SPACE}`)
}

export function oneLine(text: string): string {
  return text.replaceAll(/\s*[\r\n]\s*/g, ' ')
}

const FINGERPRINT_PATTERN = /^<!-- revision-city:([0-9a-f]{16}) -->/

// Identifies a finding across runs, so that a run does not post a comment that
// an earlier run posted. The line is not part of it, because a push can move
// the code that a comment is on.
export async function fingerprintFinding(finding: Finding): Promise<string> {
  const hash = await sha256Hex(
    JSON.stringify([finding.reviewerId, finding.path, finding.title, finding.body]),
  )
  return hash.slice(0, 16)
}

// Reads the fingerprint only from the start of a comment, where the app puts
// it. Then model text later in the comment cannot add another one.
export function readFingerprint(commentBody: string): string | undefined {
  return FINGERPRINT_PATTERN.exec(commentBody)?.[1]
}

// The body goes last, so that a code block that it leaves open cannot take in
// the suggestion.
export function formatFindingComment(finding: Finding, fingerprint: string): string {
  return [
    `<!-- revision-city:${fingerprint} -->`,
    `**${finding.severity}** (${finding.reviewerId}): ${neutralizeMarkdown(oneLine(finding.title))}`,
    ...(finding.suggestion === undefined ? [] : [suggestionBlock(finding.suggestion)]),
    neutralizeMarkdown(finding.body),
  ].join('\n\n')
}

// The fence is longer than each run of backticks in the suggestion, so that the
// suggestion cannot close it. An empty suggestion deletes the lines.
function suggestionBlock(suggestion: string): string {
  const fence = '`'.repeat(Math.max(2, longestBacktickRun(suggestion)) + 1)
  const code = suggestion.replace(/\n$/, '')
  return code === '' ? `${fence}suggestion\n${fence}` : `${fence}suggestion\n${code}\n${fence}`
}

// The fence is longer than each run of backticks in the text, so that the text
// cannot close the code span. A space keeps a backtick at an end of the text
// apart from the fence. Markdown does not show the space.
function codeSpan(text: string): string {
  const fence = '`'.repeat(longestBacktickRun(text) + 1)
  const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${fence}${padding}${text}${padding}${fence}`
}

function longestBacktickRun(text: string): number {
  return Math.max(0, ...Array.from(text.matchAll(/`+/g), ([run]) => run.length))
}

function findingLine(finding: Finding): string {
  const lines =
    finding.startLine === finding.endLine
      ? `${finding.endLine}`
      : `${finding.startLine}-${finding.endLine}`
  return `- **${finding.severity}** ${codeSpan(`${oneLine(finding.path)}:${lines}`)} (${finding.reviewerId}): ${oneLine(finding.title)}`
}

export interface FormatReviewBodyParams {
  findings: readonly Finding[]
  inlineAccepted: boolean
}

export function formatReviewBody({findings, inlineAccepted}: FormatReviewBodyParams): string {
  const count = plural(findings.length, 'new finding')
  return inlineAccepted
    ? `Revision City posted ${count}. The Revision City check lists every finding.`
    : neutralizeMarkdown(
        [
          `Revision City posted ${count}. GitHub did not accept inline comments on these lines:`,
          '',
          ...findings.map(findingLine),
        ].join('\n'),
      )
}

// GitHub accepts at most 65,535 characters in each check run output field.
export const MAX_OUTPUT_CHARS = 65_000
const CUT_NOTE = '\n\n(Cut: the list is longer than a check run can show.)'
const MAX_FAILURE_CHARS = 300

export interface CheckRunOutput {
  title: string
  summary: string
  text?: string
}

export interface NotReviewedFile {
  path: string
  reason: string
}

export interface FormatCheckRunOutputParams {
  outcome: ReviewOutcome
  review: PullRequestReview
  notReviewed: readonly NotReviewedFile[]
  postedCount: number
}

export function formatCheckRunOutput({
  outcome,
  review,
  notReviewed,
  postedCount,
}: FormatCheckRunOutputParams): CheckRunOutput {
  const counts = [
    ...(outcome.reported.length > 0 ? [plural(outcome.reported.length, 'finding')] : []),
    ...(outcome.unchecked.length > 0
      ? [plural(outcome.unchecked.length, 'unchecked finding')]
      : []),
    ...(review.failures.length > 0 ? [plural(review.failures.length, 'failed chunk review')] : []),
  ]
  const sections = [
    section('Findings', outcome.reported.map(findingLine)),
    section(
      'Failed chunk reviews',
      review.failures.map(
        ({path, reviewerId, error}) =>
          `- ${codeSpan(oneLine(path))} (${reviewerId}): ${codeSpan(oneLine(error).slice(0, MAX_FAILURE_CHARS))}`,
      ),
    ),
    section(
      'Not reviewed',
      notReviewed.map(({path, reason}) => `- ${codeSpan(oneLine(path))}: ${reason}`),
    ),
    section('Not checked, so not posted', outcome.unchecked.map(findingLine)),
  ].filter((text) => text !== '')
  return {
    title: counts.length > 0 ? counts.join(', ') : 'No findings',
    summary: [
      `${plural(review.chunkReviewCount, 'chunk review')}, ${review.cachedCount} from saved results, cost $${review.usage.costUsd.toFixed(4)}.`,
      `${plural(postedCount, 'new finding')} posted.`,
      'This check fails on a checked finding at high or above, or on a failed chunk review.',
    ].join(' '),
    ...(sections.length > 0 ? {text: clip(neutralizeMarkdown(sections.join('\n\n')))} : {}),
  }
}

function section(heading: string, lines: readonly string[]): string {
  return lines.length === 0 ? '' : [`### ${heading}`, '', ...lines].join('\n')
}

function clip(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return text
  }
  const cut = text.slice(0, MAX_OUTPUT_CHARS - CUT_NOTE.length)
  return `${cut.slice(0, cut.lastIndexOf('\n'))}${CUT_NOTE}`
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
