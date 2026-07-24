import type {
  FileContents,
  FileDiffContentsLoader,
  FileDiffLoadedFiles,
  FileDiffMetadata,
} from '@pierre/diffs'

import {parseGitHubDiffSource} from './github-diff-source'
import {isNullish} from './nullish'

type GitHubFileLoaderFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

interface GitHubDiffFileLoaderOptions {
  endpoint?: string
  fetch?: GitHubFileLoaderFetch
}

interface LoadedDiffFilesResponse {
  oldFile: FileContents | null
  newFile: FileContents | null
}

// Creates a Diffs `loadDiffFiles` callback for GitHub routes supported by
// Diffs. Browser code only talks to Diffs's same-origin API route; the server
// reads GitHub auth from the session cookie that rides along on the request.
export function createGitHubDiffFileLoader(
  path: string,
  options: GitHubDiffFileLoaderOptions = {},
): FileDiffContentsLoader | undefined {
  if (isNullish(parseGitHubDiffSource(path))) {
    return undefined
  }

  const endpoint = options.endpoint ?? '/diffs/api/github-diff-file'
  const fetcher = options.fetch ?? fetch
  const loadedFilesCache = new Map<string, Promise<FileDiffLoadedFiles>>()

  return (fileDiff) => {
    switch (fileDiff.type) {
      case 'new':
      case 'deleted':
        return Promise.reject(
          new Error(`Diffs GitHub file loader cannot hydrate ${fileDiff.type} diffs.`),
        )
      case 'change':
      case 'rename-changed':
      case 'rename-pure': {
        const cacheKey = `${getFileDiffVersion(fileDiff)}\0${fileDiff.type}\0${fileDiff.prevName ?? ''}\0${fileDiff.name}`
        const cached = loadedFilesCache.get(cacheKey)
        if (!isNullish(cached)) {
          return cached
        }

        const promise = fetchLoadedDiffFiles({
          endpoint,
          sourcePath: path,
          type: fileDiff.type,
          name: fileDiff.name,
          prevName: fileDiff.prevName,
          fetcher,
        }).catch((error: unknown) => {
          loadedFilesCache.delete(cacheKey)
          throw error
        })
        loadedFilesCache.set(cacheKey, promise)
        return promise
      }
    }
  }
}

function getFileDiffVersion(fileDiff: FileDiffMetadata): string {
  return [fileDiff.cacheKey ?? '', fileDiff.prevObjectId ?? '', fileDiff.newObjectId ?? ''].join(
    '\0',
  )
}

interface FetchLoadedDiffFilesParams {
  endpoint: string
  sourcePath: string
  type: string
  name: string
  prevName: string | undefined
  fetcher: GitHubFileLoaderFetch
}

async function fetchLoadedDiffFiles({
  endpoint,
  sourcePath,
  type,
  name,
  prevName,
  fetcher,
}: FetchLoadedDiffFilesParams): Promise<FileDiffLoadedFiles> {
  const response = await fetcher(createEndpointURL({endpoint, sourcePath, type, name, prevName}), {
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await readLoaderErrorDetail(response)
    throw new Error(
      detail.length > 0
        ? `Diffs GitHub file loader failed (${response.status}): ${detail}`
        : `Diffs GitHub file loader failed (${response.status}).`,
    )
  }

  return normalizeLoadedDiffFiles(await response.json(), type)
}

interface CreateEndpointURLParams {
  endpoint: string
  sourcePath: string
  type: string
  name: string
  prevName: string | undefined
}

function createEndpointURL({
  endpoint,
  sourcePath,
  type,
  name,
  prevName,
}: CreateEndpointURLParams): string {
  const searchParams = new URLSearchParams({path: sourcePath, type, name})
  if (!isNullish(prevName)) {
    searchParams.set('prevName', prevName)
  }
  return `${endpoint}?${searchParams}`
}

async function readLoaderErrorDetail(response: Response): Promise<string> {
  const text = (await response.text()).trim()
  if (text === '') {
    return ''
  }

  try {
    const data = JSON.parse(text) as unknown
    if (isRecord(data) && typeof data.error === 'string') {
      return data.error
    }
  } catch {
    // Fall back to the original body when the proxy returns plain text.
  }
  return text
}

function normalizeLoadedDiffFiles(data: unknown, type: string): FileDiffLoadedFiles {
  if (!isRecord(data)) {
    throw new Error('Diffs GitHub file loader returned an invalid response.')
  }

  const files: LoadedDiffFilesResponse = {
    oldFile: normalizeFileContents(data.oldFile),
    newFile: normalizeFileContents(data.newFile),
  }

  if (type === 'rename-pure') {
    if (files.oldFile !== null || files.newFile === null) {
      throw new Error('Diffs GitHub file loader returned an invalid pure rename response.')
    }
    return {oldFile: null, newFile: files.newFile}
  }

  if (files.oldFile === null || files.newFile === null) {
    throw new Error('Diffs GitHub file loader returned an invalid changed-file response.')
  }
  return {oldFile: files.oldFile, newFile: files.newFile}
}

function normalizeFileContents(value: unknown): FileContents | null {
  if (isNullish(value)) {
    return null
  }
  if (!isRecord(value)) {
    throw new Error('Diffs GitHub file loader returned an invalid file.')
  }

  const {cacheKey, contents, name} = value
  if (typeof name !== 'string' || typeof contents !== 'string') {
    throw new TypeError('Diffs GitHub file loader returned an invalid file.')
  }

  return {
    name,
    contents,
    cacheKey: typeof cacheKey === 'string' ? cacheKey : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
