#!/usr/bin/env bun
// Keeps one sticky PR comment current with the latest Warden run: which head
// it reviewed, and per skill how many findings it produced, how long it took,
// and what it cost. Warden itself posts inline review comments only for
// findings that land on a diff line, and its `reportOnSuccess` option is inert
// in 0.48.0 (a body-only COMMENT review is dropped before posting), so without
// this a clean run is visible only as check runs on the commit -- nothing in
// the PR conversation says Warden looked at the current head. Reads the
// structured findings file the `warden analyze` step writes. Uses the
// Actions-provided GITHUB_TOKEN (needs `pull-requests: write`).

export const MARKER = '<!-- warden-run-summary -->'

export interface SkillSummary {
  readonly name: string
  readonly findings: number
  readonly durationMs?: number
  readonly costUsd?: number
  readonly checkRunUrl?: string
  readonly error?: string
}

export interface RunSummary {
  readonly totalFindings: number
  readonly skills: readonly SkillSummary[]
}

interface FindingsFileSkill {
  readonly name: string
  readonly findings?: readonly unknown[]
  readonly findingsBySeverity?: Readonly<Record<string, number>>
  readonly durationMs?: number
  readonly usage?: {readonly costUSD?: number}
  readonly checkRunUrl?: string
  readonly error?: {readonly message: string}
}

interface FindingsFile {
  readonly summary?: {readonly totalFindings?: number}
  readonly skills?: readonly FindingsFileSkill[]
}

const countFindings = (skill: FindingsFileSkill): number =>
  Array.isArray(skill.findings)
    ? skill.findings.length
    : Object.values(skill.findingsBySeverity ?? {}).reduce((sum, n) => sum + n, 0)

// The parts of Warden's findings file (FindingsOutputSchema, version 1) the
// comment needs. Tolerant of optional fields so a partial file -- a skill that
// errored before producing usage, say -- still yields a row.
export function summarizeFindingsFile(raw: unknown): RunSummary {
  const file = (raw ?? {}) as FindingsFile
  const skills = (file.skills ?? []).map((skill) => ({
    name: skill.name,
    findings: countFindings(skill),
    durationMs: skill.durationMs,
    costUsd: skill.usage?.costUSD,
    checkRunUrl: skill.checkRunUrl,
    error: skill.error?.message,
  }))
  const totalFindings =
    file.summary?.totalFindings ?? skills.reduce((sum, skill) => sum + skill.findings, 0)
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

export interface CommentBodyParams {
  // owner/name exactly as GitHub reports it (GITHUB_REPOSITORY).
  readonly repo: string
  readonly headSha: string
  readonly summary: RunSummary
}

export function buildCommentBody(params: CommentBodyParams): string {
  const {repo, headSha, summary} = params
  const {totalFindings, skills} = summary
  const commitLink = `[\`${headSha.slice(0, 7)}\`](https://github.com/${repo}/commit/${headSha})`
  const verdict =
    totalFindings === 0
      ? 'no findings'
      : `${totalFindings} finding${totalFindings === 1 ? '' : 's'}`
  const lines = [
    MARKER,
    `Warden reviewed ${commitLink}: ${verdict}.`,
    '',
    '| Skill | Findings | Duration | Cost |',
    '| --- | --- | --- | --- |',
    ...skills.map((skill) => {
      const name = skill.checkRunUrl ? `[${skill.name}](${skill.checkRunUrl})` : skill.name
      const findings = skill.error ? `error: ${escapeCell(skill.error)}` : String(skill.findings)
      const duration = skill.durationMs === undefined ? '' : formatDuration(skill.durationMs)
      const cost = skill.costUsd === undefined ? '' : formatCost(skill.costUsd)
      return `| ${name} | ${findings} | ${duration} | ${cost} |`
    }),
  ]
  return lines.join('\n')
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
    // Error bodies are text; keep them readable in the failure message.
    const body = res.ok ? await res.json() : await res.text()
    return {status: res.status, body}
  }
}

const PAGE_SIZE = 100

interface IssueComment {
  readonly id: number
  readonly body?: string
}

// The id of the existing summary comment on the PR, if one was posted before.
async function findExistingComment(gh: GhClient, path: string): Promise<number | undefined> {
  for (let page = 1; ; page++) {
    const res = await gh('GET', `${path}?per_page=${PAGE_SIZE}&page=${page}`)
    if (res.status !== 200) {
      throw new Error(`GitHub API GET ${path} -> HTTP ${res.status} ${res.body}`)
    }
    const comments = res.body as IssueComment[]
    const existing = comments.find((comment) => comment.body?.startsWith(MARKER))
    if (existing) return existing.id
    if (comments.length < PAGE_SIZE) return undefined
  }
}

export interface UpsertParams {
  readonly gh: GhClient
  readonly repo: string
  readonly prNumber: string
  readonly body: string
}

// Edits the previous summary comment in place, or posts one when the PR has
// none yet, so the conversation carries a single always-current summary.
export async function upsertComment(params: UpsertParams): Promise<'created' | 'updated'> {
  const {gh, repo, prNumber, body} = params
  const listPath = `/repos/${repo}/issues/${prNumber}/comments`
  const existingId = await findExistingComment(gh, listPath)
  if (existingId === undefined) {
    const res = await gh('POST', listPath, {body})
    if (res.status !== 201) {
      throw new Error(`GitHub API POST ${listPath} -> HTTP ${res.status} ${res.body}`)
    }
    return 'created'
  }
  const editPath = `/repos/${repo}/issues/comments/${existingId}`
  const res = await gh('PATCH', editPath, {body})
  if (res.status !== 200) {
    throw new Error(`GitHub API PATCH ${editPath} -> HTTP ${res.status} ${res.body}`)
  }
  return 'updated'
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
  const outcome = await upsertComment({gh: makeGhClient(token), repo, prNumber, body})
  console.log(
    `Warden run summary comment ${outcome} (${summary.skills.length} skill${summary.skills.length === 1 ? '' : 's'}, ${summary.totalFindings} finding${summary.totalFindings === 1 ? '' : 's'})`,
  )
}
