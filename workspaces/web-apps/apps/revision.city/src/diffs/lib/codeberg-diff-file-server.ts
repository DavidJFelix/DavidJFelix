import type {ChangeTypes, FileContents} from '@pierre/diffs'

import {
  CODEBERG_API_ROOT,
  type CodebergDiffSource,
  type CodebergRepo,
  hasDotSegment,
  parseCodebergDiffSource,
} from './codeberg-diff-source'
import {encodePath, encodeURLSegment} from './github-diff-source'
import {isNullish} from './nullish'

type CodebergServerFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

export interface CodebergDiffFileRequest {
  name: string
  path: string
  prevName?: string
  type: ChangeTypes
}

export interface CodebergDiffFileServerOptions {
  fetch?: CodebergServerFetch
}

interface CodebergDiffRefs {
  // A root commit has no parent, so its diff has no old side.
  oldRef?: string
  newRef: string
}

type CodebergRefSource = Exclude<CodebergDiffSource, {kind: 'compare'}>

interface CodebergDiffFiles {
  oldFile: FileContents | null
  newFile: FileContents | null
}

export type CodebergFileReader = (
  file: Omit<CodebergDiffFileRequest, 'path'>,
) => Promise<CodebergDiffFiles>

// Reads the revisions of one file that a public Codeberg pull request or commit
// changes, with no credentials. This does not read a compare, because the API
// gives no merge base for a compare range.
export function loadCodebergDiffFiles(
  request: CodebergDiffFileRequest,
  options: CodebergDiffFileServerOptions = {},
): Promise<CodebergDiffFiles> {
  return createCodebergFileReader(request.path, options)(request)
}

// Reads files of one Codeberg diff. The reader looks up the diff's revisions on
// its first read only, so a batch of files costs one lookup.
export function createCodebergFileReader(
  path: string,
  options: CodebergDiffFileServerOptions = {},
): CodebergFileReader {
  const source = parseCodebergDiffSource(path)
  const fetcher = options.fetch ?? fetch
  let refsPromise: Promise<CodebergDiffRefs> | undefined

  return async (file) => {
    if (isNullish(source) || source.kind === 'compare') {
      throw new Error('Unsupported Codeberg diff path.')
    }
    if (hasDotSegment(file.name) || hasDotSegment(file.prevName ?? '')) {
      throw new Error('Unsupported Codeberg file path.')
    }

    // The reader does not keep a failed lookup, so the next read tries again.
    refsPromise ??= resolveCodebergDiffRefs(source, fetcher).catch((error: unknown) => {
      refsPromise = undefined
      throw error
    })
    const refs = await refsPromise
    const readNewFile = () =>
      fetchCodebergFile({repo: source.repo, ref: refs.newRef, path: file.name, fetcher})
    const readOldFile = (oldPath: string) =>
      fetchCodebergFile({
        repo: source.repo,
        ref: requireOldRef(refs, oldPath),
        path: oldPath,
        fetcher,
      })

    if (file.type === 'new' || file.type === 'rename-pure') {
      return {oldFile: null, newFile: await readNewFile()}
    }
    if (file.type === 'deleted') {
      return {oldFile: await readOldFile(file.name), newFile: null}
    }
    const [oldFile, newFile] = await Promise.all([
      readOldFile(file.prevName ?? file.name),
      readNewFile(),
    ])
    return {oldFile, newFile}
  }
}

function resolveCodebergDiffRefs(
  source: CodebergRefSource,
  fetcher: CodebergServerFetch,
): Promise<CodebergDiffRefs> {
  return source.kind === 'pull'
    ? resolveCodebergPullRefs(source, fetcher)
    : resolveCodebergCommitRefs(source, fetcher)
}

// The `.diff` of a pull request starts at the merge base. This reads both sides
// from the base repository. Forgejo keeps the head commit of each pull request
// there, also for a pull request from a fork.
async function resolveCodebergPullRefs(
  source: Extract<CodebergDiffSource, {kind: 'pull'}>,
  fetcher: CodebergServerFetch,
): Promise<CodebergDiffRefs> {
  const label = `Codeberg pull ${source.repo.owner}/${source.repo.repo}#${source.number}`
  const data = await fetchCodebergJSON({
    url: `${createRepoApiUrl(source.repo)}/pulls/${encodeURLSegment(source.number)}`,
    label,
    fetcher,
  })
  const mergeBase = readStringPath(data, ['merge_base'])
  const headSha = readStringPath(data, ['head', 'sha'])
  if (isNullish(mergeBase) || isNullish(headSha)) {
    throw new Error(`${label} did not include refs.`)
  }
  return {oldRef: mergeBase, newRef: headSha}
}

// The `.diff` of a commit starts at its first parent.
async function resolveCodebergCommitRefs(
  source: Extract<CodebergDiffSource, {kind: 'commit'}>,
  fetcher: CodebergServerFetch,
): Promise<CodebergDiffRefs> {
  const label = `Codeberg commit ${source.repo.owner}/${source.repo.repo}@${source.sha}`
  const data = await fetchCodebergJSON({
    url: `${createRepoApiUrl(source.repo)}/git/commits/${encodeURLSegment(source.sha)}`,
    label,
    fetcher,
  })
  const sha = readStringPath(data, ['sha'])
  if (isNullish(sha)) {
    throw new Error(`${label} did not include a SHA.`)
  }
  const parents = readUnknownPath(data, ['parents'])
  const firstParent = Array.isArray(parents) ? readStringPath(parents[0], ['sha']) : undefined
  return {oldRef: firstParent, newRef: sha}
}

interface FetchCodebergFileParams {
  repo: CodebergRepo
  ref: string
  path: string
  fetcher: CodebergServerFetch
}

async function fetchCodebergFile({
  repo,
  ref,
  path,
  fetcher,
}: FetchCodebergFileParams): Promise<FileContents> {
  const url = new URL(`${createRepoApiUrl(repo)}/raw/${encodePath(path)}`)
  url.searchParams.set('ref', ref)
  const response = await fetcher(url.href)
  assertCodebergResponseOK(response, `Codeberg file ${repo.owner}/${repo.repo}/${path}@${ref}`)
  return {
    name: path,
    contents: await response.text(),
    cacheKey: `codeberg:${repo.owner}/${repo.repo}:${ref}:${path}`,
  }
}

interface FetchCodebergJSONParams {
  url: string
  label: string
  fetcher: CodebergServerFetch
}

async function fetchCodebergJSON({url, label, fetcher}: FetchCodebergJSONParams): Promise<unknown> {
  const response = await fetcher(url, {headers: {Accept: 'application/json'}})
  assertCodebergResponseOK(response, label)
  return response.json()
}

function assertCodebergResponseOK(response: Response, label: string): void {
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}).`)
  }
}

function requireOldRef(refs: CodebergDiffRefs, path: string): string {
  if (isNullish(refs.oldRef)) {
    throw new Error(`Codeberg loader cannot read the old side of ${path}.`)
  }
  return refs.oldRef
}

function createRepoApiUrl(repo: CodebergRepo): string {
  return `${CODEBERG_API_ROOT}/repos/${encodeURLSegment(repo.owner)}/${encodeURLSegment(repo.repo)}`
}

function readStringPath(data: unknown, path: readonly string[]): string | undefined {
  const value = readUnknownPath(data, path)
  return typeof value === 'string' ? value : undefined
}

function readUnknownPath(data: unknown, path: readonly string[]): unknown {
  let current = data
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined
    }
    current = current[key]
  }
  return current
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
