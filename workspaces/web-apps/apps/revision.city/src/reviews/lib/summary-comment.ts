import {z} from 'zod'
import {listAllPages, type PullRequestParams, repositoryPath} from './github-api'
import {APP_BOT_LOGIN} from './publish-review'
import type {CheckRunOutput} from './review-markdown'
import type {SummaryCommentLock} from './summary-comment-lock'

// The app's summary comment starts with this marker, so a run finds the
// comment again and edits it.
export const SUMMARY_MARKER = '<!-- revision-city:summary -->'

// Each run section starts with a marker line that holds the check run id, the
// head, and the cost of the run. `neutralizeMarkdown` puts a zero-width space after each "<" in
// model text and file paths, so they cannot add a marker.
const RUN_MARKER = /^<!-- revision-city:run (\d+) ([0-9a-f]{40}) (\d+\.\d{4}) -->$/gm

// GitHub accepts at most 65,536 characters in a comment.
export const MAX_COMMENT_CHARS = 65_000
const CUT_NOTE = '(Details cut: the comment is longer than GitHub accepts.)'

// Reads at most 3000 comments. On a pull request with more, a run can post a
// second summary comment.
const MAX_COMMENT_PAGES = 30

export interface RunSection {
  // The id of the run's check run. A rerun on the same head has a new one.
  checkRunId: number
  headSha: string
  costUsd: number
  // The marker line and the heading. A cut keeps them.
  head: string
  // The text after the heading, as the comment shows it.
  details: string
}

export interface FormatRunSectionParams {
  checkRunId: number
  headSha: string
  costUsd: number
  output: CheckRunOutput
}

export function formatRunSection({
  checkRunId,
  headSha,
  costUsd,
  output,
}: FormatRunSectionParams): RunSection {
  const cost = costUsd.toFixed(4)
  return {
    checkRunId,
    headSha,
    costUsd: Number(cost),
    head: [
      `<!-- revision-city:run ${checkRunId} ${headSha} ${cost} -->`,
      `### \`${headSha.slice(0, 7)}\`: ${output.title}, cost $${cost}`,
    ].join('\n'),
    details: output.text === undefined ? '' : `<details>\n\n${output.text}\n\n</details>`,
  }
}

// Reads the run sections of an earlier summary comment. A section runs from its
// marker to the next marker.
export function readRunSections(body: string): RunSection[] {
  const markers = Array.from(body.matchAll(RUN_MARKER))
  return markers.map((marker, index) => {
    const lines = body.slice(marker.index, markers[index + 1]?.index).split('\n')
    return {
      checkRunId: Number(marker[1]),
      headSha: marker[2],
      costUsd: Number(marker[3]),
      head: lines.slice(0, 2).join('\n'),
      details: lines.slice(2).join('\n').trim(),
    }
  })
}

// The newest run goes last. When the comment is too long, older runs lose
// their details first, and keep their heading and cost.
export function formatSummaryComment(sections: readonly RunSection[]): string {
  const total = sections.reduce((sum, {costUsd}) => sum + costUsd, 0)
  const header = [
    SUMMARY_MARKER,
    '## Revision City',
    '',
    `${sections.length} ${sections.length === 1 ? 'run' : 'runs'} on this pull request, total cost $${total.toFixed(4)}.`,
  ].join('\n')
  const render = (cutCount: number) =>
    [
      header,
      ...sections.map(({head, details}, index) =>
        index < cutCount
          ? `${head}\n\n${CUT_NOTE}`
          : details === ''
            ? head
            : `${head}\n\n${details}`,
      ),
    ].join('\n\n')
  const fitting = Array.from({length: sections.length + 1}, (_, cutCount) => cutCount).find(
    (cutCount) => render(cutCount).length <= MAX_COMMENT_CHARS,
  )
  return fitting === undefined
    ? render(sections.length).slice(0, MAX_COMMENT_CHARS)
    : render(fitting)
}

const issueCommentSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  user: z.object({login: z.string()}).nullable(),
})

const ignoredResponse = z.unknown()

export interface UpdateSummaryCommentParams extends PullRequestParams {
  section: RunSection
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
}: Omit<UpdateSummaryCommentParams, 'lock'>): Promise<void> {
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
      body: {body: formatSummaryComment([section])},
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
    body: {body: formatSummaryComment([...sections, section])},
    schema: ignoredResponse,
  })
}
