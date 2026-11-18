import {z} from 'zod'
import {listAllPages, type PullRequestParams, repositoryPath} from './github-api'
import {APP_BOT_LOGIN} from './publish-review'
import type {SummaryCommentLock} from './summary-comment-lock'

// The app's summary comment starts with this marker, so a run finds the
// comment again and edits it.
export const SUMMARY_MARKER = '<!-- revision-city:summary -->'

// Each run section starts with a marker line that holds the check run id, the
// head, and the cost of the run. `neutralizeMarkdown` puts a zero-width space after each "<" in
// model text and file paths, so they cannot add a marker.
const RUN_MARKER = /^<!-- revision-city:run (\d+) ([0-9a-f]{40}) (\d+\.\d{4}) -->$/gm

// A finding line ends with a marker that holds the fingerprint of the
// finding, so that a later edit can show it as resolved or open.
const FINDING_LINE =
  /^- (?:~~(.*)~~ \(resolved\)|(.*)) <!-- revision-city:finding ([0-9a-f]{16}) -->$/

// The header holds the number and the cost of the runs that a cut removed.
const OLDER_MARKER = /^<!-- revision-city:older (\d+) (\d+\.\d{4}) -->$/m

// GitHub accepts at most 65,536 characters in a comment.
export const MAX_COMMENT_CHARS = 65_000
const CUT_NOTE = '(Cut: the comment is longer than GitHub accepts.)'

// Reads at most 3000 comments. On a pull request with more, a run can post a
// second summary comment.
const MAX_COMMENT_PAGES = 30

export interface SectionFinding {
  fingerprint: string
  // The neutralized summary line of the finding, without its status.
  text: string
}

export interface RunSection {
  // The id of the run's check run. A rerun on the same head has a new one.
  checkRunId: number
  headSha: string
  costUsd: number
  // The marker line and the heading. A cut keeps them until it removes the whole run.
  head: string
  // The reported findings of the run.
  findings: SectionFinding[]
  // The text after the findings, as the comment shows it.
  details: string
}

export interface FormatRunSectionParams {
  checkRunId: number
  headSha: string
  costUsd: number
  title: string
  findings: SectionFinding[]
  // The check run text without its findings, already neutralized.
  details?: string
}

export function formatRunSection({
  checkRunId,
  headSha,
  costUsd,
  title,
  findings,
  details,
}: FormatRunSectionParams): RunSection {
  const cost = costUsd.toFixed(4)
  return {
    checkRunId,
    headSha,
    costUsd: Number(cost),
    head: [
      `<!-- revision-city:run ${checkRunId} ${headSha} ${cost} -->`,
      `### \`${headSha.slice(0, 7)}\`: ${title}, cost $${cost}`,
    ].join('\n'),
    findings,
    details: details === undefined ? '' : `<details>\n\n${details}\n\n</details>`,
  }
}

// Reads the run sections of an earlier summary comment. A section runs from its
// marker to the next marker.
export function readRunSections(body: string): RunSection[] {
  const markers = Array.from(body.matchAll(RUN_MARKER))
  return markers.map((marker, index) => {
    const lines = body.slice(marker.index, markers[index + 1]?.index).split('\n')
    const rest = lines.slice(2)
    return {
      checkRunId: Number(marker[1]),
      headSha: marker[2],
      costUsd: Number(marker[3]),
      head: lines.slice(0, 2).join('\n'),
      findings: rest.flatMap((line): SectionFinding[] => {
        const match = FINDING_LINE.exec(line)
        return match === null ? [] : [{fingerprint: match[3], text: match[1] ?? match[2]}]
      }),
      details: rest
        .filter((line) => !FINDING_LINE.test(line))
        .join('\n')
        .trim(),
    }
  })
}

export interface RunTotals {
  count: number
  costUsd: number
}

const NO_RUNS: RunTotals = {count: 0, costUsd: 0}

// Reads the marker only from the header, before the first run, so that the
// text of a run cannot add one.
export function readOlderRuns(body: string): RunTotals {
  const firstRun = body.search(RUN_MARKER)
  const match = OLDER_MARKER.exec(firstRun === -1 ? body : body.slice(0, firstRun))
  return match === null ? NO_RUNS : {count: Number(match[1]), costUsd: Number(match[2])}
}

export interface FormatSummaryCommentOptions {
  resolved?: ReadonlySet<string>
  // The runs that an earlier cut removed from the comment.
  older?: RunTotals
}

type SectionLevel = 'full' | 'no-details' | 'head-only'

// The newest run goes last. A finding whose fingerprint is in `resolved` shows
// as resolved. When the comment is too long, a cut removes text, oldest run
// first: the details of each run, then the findings of each older run, then
// each older run. The header still counts each run and its cost.
export function formatSummaryComment(
  sections: readonly RunSection[],
  {resolved = new Set(), older = NO_RUNS}: FormatSummaryCommentOptions = {},
): string {
  const total = addRuns(older, sections)
  // A section adds its text and the blank line before it.
  const measure = (section: RunSection, level: SectionLevel | 'removed') =>
    level === 'removed' ? 0 : formatSection({section, level, resolved}).length + 2
  const levels = sections.map((): SectionLevel | 'removed' => 'full')
  const olderSections = sections.slice(0, -1)
  const cuts = [
    ...sections.map((section, index) => ({section, index, level: 'no-details' as const})),
    ...olderSections.map((section, index) => ({section, index, level: 'head-only' as const})),
    ...olderSections.map((section, index) => ({section, index, level: 'removed' as const})),
  ]
  let length = sections.reduce((sum, section) => sum + measure(section, 'full'), 0)
  let removedRuns = older
  for (const {section, index, level} of cuts) {
    if (formatHeader({total, removedRuns}).length + length <= MAX_COMMENT_CHARS) {
      break
    }
    length += measure(section, level) - measure(section, levels[index])
    levels[index] = level
    removedRuns = level === 'removed' ? addRuns(removedRuns, [section]) : removedRuns
  }
  const body = [
    formatHeader({total, removedRuns}),
    ...sections.flatMap((section, index) => {
      const level = levels[index]
      return level === 'removed' ? [] : [formatSection({section, level, resolved})]
    }),
  ].join('\n\n')
  // Only the newest run is left, and it is too long alone. The cut keeps whole lines.
  return body.length <= MAX_COMMENT_CHARS
    ? body
    : body.slice(0, body.lastIndexOf('\n', MAX_COMMENT_CHARS))
}

function addRuns(runs: RunTotals, sections: readonly RunSection[]): RunTotals {
  return {
    count: runs.count + sections.length,
    costUsd: sections.reduce((sum, {costUsd}) => sum + costUsd, runs.costUsd),
  }
}

interface FormatHeaderParams {
  total: RunTotals
  removedRuns: RunTotals
}

function formatHeader({total, removedRuns}: FormatHeaderParams): string {
  const removedNote =
    removedRuns.count === 0
      ? ''
      : ` The oldest ${removedRuns.count === 1 ? 'run is' : `${removedRuns.count} runs are`} not shown.`
  return [
    SUMMARY_MARKER,
    ...(removedRuns.count === 0
      ? []
      : [`<!-- revision-city:older ${removedRuns.count} ${removedRuns.costUsd.toFixed(4)} -->`]),
    '## Revision City',
    '',
    `${total.count} ${total.count === 1 ? 'run' : 'runs'} on this pull request, total cost $${total.costUsd.toFixed(4)}.${removedNote}`,
  ].join('\n')
}

interface FormatSectionParams {
  section: RunSection
  level: SectionLevel
  resolved: ReadonlySet<string>
}

function formatSection({
  section: {head, findings, details},
  level,
  resolved,
}: FormatSectionParams): string {
  const lines = findings.map((finding) => findingLine(finding, resolved)).join('\n')
  const rest = {
    full: [lines, details],
    'no-details': [lines, details === '' ? '' : CUT_NOTE],
    'head-only': [lines === '' && details === '' ? '' : CUT_NOTE],
  }[level]
  return [head, ...rest.filter((text) => text !== '')].join('\n\n')
}

function findingLine({fingerprint, text}: SectionFinding, resolved: ReadonlySet<string>): string {
  const shown = resolved.has(fingerprint) ? `~~${text}~~ (resolved)` : text
  return `- ${shown} <!-- revision-city:finding ${fingerprint} -->`
}

const issueCommentSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  user: z.object({login: z.string()}).nullable(),
})

const ignoredResponse = z.unknown()

export interface UpdateSummaryCommentParams extends PullRequestParams {
  section: RunSection
  // The fingerprints of the findings to show as resolved, in every run.
  resolvedFingerprints: readonly string[]
  lock: SummaryCommentLock
}

// Adds the run to the app's summary comment, or posts the comment when the
// pull request has none yet. The lock keeps two runs from editing the comment
// at the same time. When it is held, this throws, so that the step tries again
// later. When the comment has the run already, it does not change the comment,
// so a retry after a lost response does not add the run again.
export async function updateSummaryComment({
  lock,
  ...params
}: UpdateSummaryCommentParams): Promise<void> {
  const lockParams = {
    pullRequest: `${params.repository.owner}/${params.repository.name}#${params.pullNumber}`,
    holder: `check-run:${params.section.checkRunId}`,
  }
  if (!(await lock.acquire(lockParams))) {
    throw new Error('Another run is editing the summary comment')
  }
  try {
    await writeSummaryComment(params)
  } finally {
    // A failed release only delays the next run until the lease expires.
    await lock.release(lockParams).catch(() => undefined)
  }
}

async function writeSummaryComment({
  request,
  repository,
  pullNumber,
  section,
  resolvedFingerprints,
}: Omit<UpdateSummaryCommentParams, 'lock'>): Promise<void> {
  const resolved = new Set(resolvedFingerprints)
  const issuePath = `${repositoryPath(repository)}/issues/${pullNumber}/comments`
  const comments = await listAllPages({
    request,
    path: issuePath,
    schema: issueCommentSchema,
    maxPages: MAX_COMMENT_PAGES,
  })
  const existing = comments.find(
    ({body, user}) => user?.login === APP_BOT_LOGIN && body?.startsWith(SUMMARY_MARKER) === true,
  )
  if (existing === undefined) {
    await request({
      method: 'POST',
      path: issuePath,
      body: {body: formatSummaryComment([section], {resolved})},
      schema: ignoredResponse,
    })
    return
  }
  const sections = readRunSections(existing.body ?? '')
  if (sections.some(({checkRunId}) => checkRunId === section.checkRunId)) {
    return
  }
  await request({
    method: 'PATCH',
    path: `${repositoryPath(repository)}/issues/comments/${existing.id}`,
    body: {
      body: formatSummaryComment([...sections, section], {
        resolved,
        older: readOlderRuns(existing.body ?? ''),
      }),
    },
    schema: ignoredResponse,
  })
}
