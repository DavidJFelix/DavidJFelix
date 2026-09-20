#!/usr/bin/env bun
// Keeps one sticky PR comment current with the latest Warden run: which head
// it reviewed, per skill how many findings it produced, how long it took, and
// what it cost, and then every finding in full -- title, severity, a link to
// the lines at that head, and the description. Warden itself posts inline
// review comments only for findings at or above `reportOn` that land on a
// diff line (the rest live in the Checks tab), and its `reportOnSuccess`
// option is inert in 0.48.0 (a body-only COMMENT review is dropped before
// posting), so without this a clean run is invisible in the PR conversation
// and a low-severity finding takes a trip to Checks to read. Reads the
// structured findings file the `warden analyze` step writes. Uses the
// Actions-provided GITHUB_TOKEN (needs `pull-requests: write`).

export const MARKER = '<!-- warden-run-summary -->'

export interface FindingLocation {
  readonly path: string
  readonly startLine: number
  readonly endLine?: number
}

export interface FindingDetail {
  readonly severity: string
  readonly title: string
  readonly description: string
  readonly location?: FindingLocation
}

export interface SkillSummary {
  readonly name: string
  readonly findings: readonly FindingDetail[]
  readonly durationMs?: number
  readonly costUsd?: number
  readonly checkRunUrl?: string
  readonly error?: string
}

export interface RunSummary {
  readonly totalFindings: number
  readonly skills: readonly SkillSummary[]
}

interface FindingsFileFinding {
  readonly severity?: string
  readonly title?: string
  readonly description?: string
  readonly location?: FindingLocation
}

interface FindingsFileSkill {
  readonly name: string
  readonly findings?: readonly FindingsFileFinding[]
  readonly durationMs?: number
  readonly usage?: {readonly costUSD?: number}
  readonly checkRunUrl?: string
  readonly error?: {readonly message: string}
}

interface FindingsFile {
  readonly summary?: {readonly totalFindings?: number}
  readonly skills?: readonly FindingsFileSkill[]
}

const toFindingDetail = (finding: FindingsFileFinding): FindingDetail => ({
  severity: finding.severity ?? 'unknown',
  title: finding.title ?? '(untitled)',
  description: finding.description ?? '',
  location: finding.location,
})

// The parts of Warden's findings file (FindingsOutputSchema, version 1) the
// comment needs. Tolerant of optional fields so a partial file -- a skill that
// errored before producing usage, say -- still yields a row.
export function summarizeFindingsFile(raw: unknown): RunSummary {
  const file = (raw ?? {}) as FindingsFile
  const skills = (file.skills ?? []).map((skill) => ({
    name: skill.name,
    findings: (skill.findings ?? []).map(toFindingDetail),
    durationMs: skill.durationMs,
    costUsd: skill.usage?.costUSD,
    checkRunUrl: skill.checkRunUrl,
    error: skill.error?.message,
  }))
  const totalFindings =
    file.summary?.totalFindings ?? skills.reduce((sum, skill) => sum + skill.findings.length, 0)
  return {totalFindings, skills}
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

const formatCost = (usd: number): string => `$${usd.toFixed(2)}`

// A table cell must stay on one line and must not split the row.
const escapeCell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

// Titles and paths land inside raw HTML (<summary>), where markup would render
// instead of the words.
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface CommentBodyParams {
  // owner/name exactly as GitHub reports it (GITHUB_REPOSITORY).
  readonly repo: string
  readonly headSha: string
  readonly summary: RunSummary
}

// `path:12-14`, linked to those lines of the file at the reviewed head. The
// path is model-reported, so it is percent-encoded for the URL and then
// HTML-escaped for the attribute, the same as the visible copy.
function renderLocation(repo: string, headSha: string, location: FindingLocation): string {
  const {path, startLine, endLine} = location
  const range = endLine !== undefined && endLine !== startLine ? `${startLine}-${endLine}` : `${startLine}`
  const anchor = endLine !== undefined && endLine !== startLine ? `L${startLine}-L${endLine}` : `L${startLine}`
  const url = `https://github.com/${repo}/blob/${headSha}/${encodeURI(path)}#${anchor}`
  return `<a href="${escapeHtml(url)}"><code>${escapeHtml(path)}:${range}</code></a>`
}

// One collapsible block per finding, the way Warden renders them in Checks:
// the title, severity, and location on the summary line, the description
// inside. The description is deliberately left as Markdown -- Warden posts the
// same text as Markdown in its own inline review comments and check summaries,
// and escaping it would turn every code span into literal backticks. Blank
// lines around it keep Markdown rendering inside the HTML block.
function renderFinding(repo: string, headSha: string, finding: FindingDetail): string {
  const where = finding.location ? ` · ${renderLocation(repo, headSha, finding.location)}` : ''
  return [
    '<details>',
    `<summary><strong>${escapeHtml(finding.title)}</strong> · ${escapeHtml(finding.severity)}${where}</summary>`,
    '',
    finding.description.trim(),
    '',
    '</details>',
  ].join('\n')
}

export function buildCommentBody(params: CommentBodyParams): string {
  const {repo, headSha, summary} = params
  const {totalFindings, skills} = summary
  const commitLink = `[\`${headSha.slice(0, 7)}\`](https://github.com/${repo}/commit/${headSha})`
  const verdict =
    totalFindings === 0
      ? 'no findings'
      : `${totalFindings} finding${totalFindings === 1 ? '' : 's'}`
  const table = [
    '| Skill | Findings | Duration | Cost |',
    '| --- | --- | --- | --- |',
    ...skills.map((skill) => {
      const name = skill.checkRunUrl ? `[${skill.name}](${skill.checkRunUrl})` : skill.name
      const findings = skill.error
        ? `error: ${escapeCell(skill.error)}`
        : String(skill.findings.length)
      const duration = skill.durationMs === undefined ? '' : formatDuration(skill.durationMs)
      const cost = skill.costUsd === undefined ? '' : formatCost(skill.costUsd)
      return `| ${name} | ${findings} | ${duration} | ${cost} |`
    }),
  ]
  const findings = skills
    .filter((skill) => skill.findings.length > 0)
    .flatMap((skill) => [
      '',
      `**${skill.name}**`,
      '',
      ...skill.findings.map((finding) => renderFinding(repo, headSha, finding)),
    ])
  return [MARKER, `Warden reviewed ${commitLink}: ${verdict}.`, '', ...table, ...findings].join('\n')
}

export interface GhResponse {
  readonly status: number
  readonly body: unknown
}

export type GhClient = (method: string, path: string, payload?: unknown) => Promise<GhResponse>

function makeGhClient(token: string): GhClient {
  return async (method, path, payload) => {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'warden-run-summary',
      },
      ...(payload === undefined ? {} : {body: JSON.stringify(payload)}),
    })
    // DELETE replies 204 No Content; error bodies are text. Keep both readable.
    const body = res.status === 204 ? undefined : res.ok ? await res.json() : await res.text()
    return {status: res.status, body}
  }
}

const PAGE_SIZE = 100

interface IssueComment {
  readonly id: number
  readonly body?: string
}

// Every summary comment on the PR, oldest first. The list endpoint has no
// filter and no sort option, so every page is walked: on a PR with more than
// a page of comments the summary falls off page one, and reading only that
// page would post a fresh duplicate on every run.
async function listMarkedComments(gh: GhClient, path: string): Promise<IssueComment[]> {
  const marked: IssueComment[] = []
  for (let page = 1; ; page++) {
    const res = await gh('GET', `${path}?per_page=${PAGE_SIZE}&page=${page}`)
    if (res.status !== 200) {
      throw new Error(`GitHub API GET ${path} -> HTTP ${res.status} ${res.body}`)
    }
    const comments = res.body as IssueComment[]
    marked.push(...comments.filter((comment) => comment.body?.startsWith(MARKER)))
    if (comments.length < PAGE_SIZE) return marked
  }
}

export interface UpsertParams {
  readonly gh: GhClient
  readonly repo: string
  readonly prNumber: string
  readonly body: string
}

export interface UpsertOutcome {
  readonly action: 'created' | 'updated'
  readonly removed: number
}

// Edits the oldest summary comment in place (stable position in the thread),
// or posts one when the PR has none yet, and deletes any other summary
// comments: the review job runs on every push with no concurrency group, so
// two overlapping runs can each post before either sees the other's, and
// without this the loser's comment would sit stale on the PR forever.
export async function upsertComment(params: UpsertParams): Promise<UpsertOutcome> {
  const {gh, repo, prNumber, body} = params
  const listPath = `/repos/${repo}/issues/${prNumber}/comments`
  const [keep, ...duplicates] = await listMarkedComments(gh, listPath)
  for (const duplicate of duplicates) {
    const deletePath = `/repos/${repo}/issues/comments/${duplicate.id}`
    const res = await gh('DELETE', deletePath)
    // Already gone -- a racing run got there first -- is the goal state.
    if (res.status !== 204 && res.status !== 404) {
      throw new Error(`GitHub API DELETE ${deletePath} -> HTTP ${res.status} ${res.body}`)
    }
  }
  if (keep === undefined) {
    const res = await gh('POST', listPath, {body})
    if (res.status !== 201) {
      throw new Error(`GitHub API POST ${listPath} -> HTTP ${res.status} ${res.body}`)
    }
    return {action: 'created', removed: duplicates.length}
  }
  const editPath = `/repos/${repo}/issues/comments/${keep.id}`
  const res = await gh('PATCH', editPath, {body})
  if (res.status !== 200) {
    throw new Error(`GitHub API PATCH ${editPath} -> HTTP ${res.status} ${res.body}`)
  }
  return {action: 'updated', removed: duplicates.length}
}

if (import.meta.main) {
  await main()
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  // GITHUB_REPOSITORY is Actions-provided, owner/name.
  const repo = process.env.GITHUB_REPOSITORY
  const prNumber = process.env.PR_NUMBER
  const headSha = process.env.HEAD_SHA
  const findingsFile = process.env.FINDINGS_FILE

  if (!token || !repo || !prNumber || !headSha || !findingsFile) {
    console.error(
      '::error::GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA and FINDINGS_FILE are required',
    )
    process.exit(1)
  }

  const summary = summarizeFindingsFile(await Bun.file(findingsFile).json())
  const body = buildCommentBody({repo, headSha, summary})
  const {action, removed} = await upsertComment({gh: makeGhClient(token), repo, prNumber, body})
  const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`
  console.log(
    `Warden run summary comment ${action} (${plural(summary.skills.length, 'skill')}, ${plural(summary.totalFindings, 'finding')})${removed ? ` (removed ${plural(removed, 'duplicate')})` : ''}`,
  )
}
