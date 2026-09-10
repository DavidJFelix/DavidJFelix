#!/usr/bin/env bun
// Posts a PR comment linking the pull request and its commits to the
// revision.city diff viewer (https://revision.city/diffs/<owner>/<repo>/...).
// One new comment per event, on purpose -- the thread becomes a log of what
// each push changed, so there is no sticky-comment upsert here. On `opened`
// every commit in the PR is listed; on `synchronize` only the commits new since
// the previous head: the before...after compare, intersected with the PR's own
// commits so a rebase onto main or a merge from main does not drag main's
// history into the list. When GitHub can no longer compare against `before` (a
// force-push whose old head has since been collected), every commit in the PR
// is listed instead. Uses the Actions-provided GITHUB_TOKEN (needs
// `pull-requests: write`).

export const REVISION_CITY_DIFFS = 'https://revision.city/diffs'

export interface CommitLink {
  readonly sha: string
  readonly title: string
}

export interface CommentBodyParams {
  // owner/name exactly as GitHub reports it (GITHUB_REPOSITORY), so the
  // revision.city path keeps the repository's casing.
  readonly repo: string
  readonly prNumber: string
  readonly prTitle: string
  readonly commits: readonly CommitLink[]
}

// Titles land inside `[...]` link text, where an unbalanced bracket breaks the
// link and inline markup (emphasis, code, raw HTML) would render instead of the
// words. GFM treats a backslash before any ASCII punctuation as a literal.
export function escapeLinkText(text: string): string {
  return text.replace(/[\\`*_[\]<>~]/g, (char) => `\\${char}`)
}

// The first line of a commit message, as git shows it in one-line logs.
export function commitTitle(message: string): string {
  return (message.split(/\r?\n/, 1)[0] ?? '').trim()
}

export function buildCommentBody(params: CommentBodyParams): string {
  const {repo, prNumber, prTitle, commits} = params
  const lines = [
    'See this change in revision.city:',
    '',
    `- [PR #${prNumber} - ${escapeLinkText(prTitle)}](${REVISION_CITY_DIFFS}/${repo}/pull/${prNumber})`,
    ...commits.map(
      ({sha, title}) =>
        `- [Commit ${sha.slice(0, 7)} - ${escapeLinkText(title)}](${REVISION_CITY_DIFFS}/${repo}/commit/${sha})`,
    ),
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
        'user-agent': 'revision-city-links',
      },
      ...(payload === undefined ? {} : {body: JSON.stringify(payload)}),
    })
    // Error bodies are text; keep them readable in the failure message.
    const body = res.ok ? await res.json() : await res.text()
    return {status: res.status, body}
  }
}

const PAGE_SIZE = 100

interface Page<T> {
  readonly status: number
  readonly items: readonly T[]
  // GitHub's error body when `status` is not 200; empty otherwise.
  readonly error: string
}

interface PaginateParams<T> {
  readonly gh: GhClient
  readonly path: string
  readonly items: (body: unknown) => readonly T[]
}

// Walks every page of a list endpoint. A non-200 first page is reported to the
// caller rather than thrown, because one caller (the compare) treats a missing
// `before` as a signal, not a failure.
async function paginate<T>(params: PaginateParams<T>): Promise<Page<T>> {
  const {gh, path, items} = params
  const all: T[] = []
  for (let page = 1; ; page++) {
    const res = await gh('GET', `${path}?per_page=${PAGE_SIZE}&page=${page}`)
    if (res.status !== 200) {
      if (page === 1) return {status: res.status, items: [], error: String(res.body)}
      throw new Error(`GitHub API GET ${path} page ${page} -> HTTP ${res.status} ${res.body}`)
    }
    const batch = items(res.body)
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return {status: 200, items: all, error: ''}
}

interface ApiCommit {
  readonly sha: string
  readonly commit: {readonly message: string}
}

const toCommitLinks = (commits: readonly ApiCommit[]): CommitLink[] =>
  commits.map(({sha, commit}) => ({sha, title: commitTitle(commit.message)}))

interface PullParams {
  readonly gh: GhClient
  readonly repo: string
  readonly prNumber: string
}

// Every commit in the PR, oldest first (GitHub caps this list at 250).
async function listPullCommits(params: PullParams): Promise<CommitLink[]> {
  const {gh, repo, prNumber} = params
  const path = `/repos/${repo}/pulls/${prNumber}/commits`
  const page = await paginate({gh, path, items: (body) => body as ApiCommit[]})
  if (page.status !== 200) {
    throw new Error(`GitHub API GET ${path} -> HTTP ${page.status} ${page.error}`)
  }
  return toCommitLinks(page.items)
}

interface CompareParams {
  readonly gh: GhClient
  readonly repo: string
  readonly before: string
  readonly after: string
}

// The SHAs reachable from `after` but not from `before` -- what this push
// added. `undefined` when GitHub cannot resolve the comparison: after a
// force-push the old head can be unreachable, and GitHub answers 404 (unknown
// commit) or 422 (not comparable) rather than an empty list.
async function listPushedShas(params: CompareParams): Promise<Set<string> | undefined> {
  const {gh, repo, before, after} = params
  const path = `/repos/${repo}/compare/${before}...${after}`
  const page = await paginate({
    gh,
    path,
    items: (body) => (body as {commits: ApiCommit[]}).commits,
  })
  if (page.status === 404 || page.status === 422) return undefined
  if (page.status !== 200) {
    throw new Error(`GitHub API GET ${path} -> HTTP ${page.status} ${page.error}`)
  }
  return new Set(page.items.map(({sha}) => sha))
}

export interface ChangedCommitsParams {
  readonly gh: GhClient
  readonly repo: string
  readonly prNumber: string
  // The pull_request event's `action`: `synchronize` narrows to the push.
  readonly action: string
  // The event's `before` / `after` heads; only `synchronize` carries them.
  readonly before: string | undefined
  readonly after: string | undefined
}

// The commits a comment should link for this event: on `synchronize`, the
// PR's commits that this push introduced; otherwise every commit in the PR.
export async function resolveChangedCommits(params: ChangedCommitsParams): Promise<CommitLink[]> {
  const {gh, repo, prNumber, action, before, after} = params
  const pullCommits = await listPullCommits({gh, repo, prNumber})
  if (action !== 'synchronize' || !before || !after) return pullCommits
  const pushed = await listPushedShas({gh, repo, before, after})
  if (pushed === undefined) {
    console.log(
      `::notice::GitHub could not compare ${before.slice(0, 7)}...${after.slice(0, 7)}; listing every commit in the PR`,
    )
    return pullCommits
  }
  return pullCommits.filter(({sha}) => pushed.has(sha))
}

if (import.meta.main) {
  await main()
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  // GITHUB_REPOSITORY is Actions-provided, owner/name.
  const repo = process.env.GITHUB_REPOSITORY
  const prNumber = process.env.PR_NUMBER
  const prTitle = process.env.PR_TITLE
  const action = process.env.PR_ACTION

  if (!token || !repo || !prNumber || !prTitle || !action) {
    console.error(
      '::error::GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, PR_TITLE and PR_ACTION are required',
    )
    process.exit(1)
  }

  const gh = makeGhClient(token)
  const commits = await resolveChangedCommits({
    gh,
    repo,
    prNumber,
    action,
    before: process.env.PUSH_BEFORE,
    after: process.env.PUSH_AFTER,
  })
  const body = buildCommentBody({repo, prNumber, prTitle, commits})

  const path = `/repos/${repo}/issues/${prNumber}/comments`
  const res = await gh('POST', path, {body})
  if (res.status !== 201) {
    throw new Error(`GitHub API POST ${path} -> HTTP ${res.status} ${res.body}`)
  }
  console.log(
    `revision.city links comment posted (${commits.length} commit${commits.length === 1 ? '' : 's'})`,
  )
}
