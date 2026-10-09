import {type DiffLine, type PatchHunk, parsePatchHunks} from './patch-hunks'

export type PullRequestFileStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged'

// The shape of one entry from GitHub's "list pull request files" endpoint.
// `patch` is absent for binary files and for diffs too large for GitHub to inline.
export interface PullRequestFile {
  path: string
  status: PullRequestFileStatus
  patch?: string
}

export interface ReviewChunk {
  path: string
  hunks: readonly PatchHunk[]
}

export interface ChunkPullRequestFilesOptions {
  maxLinesPerChunk?: number
}

// Small enough that one model call stays focused on the change, large enough
// that most files fit in one chunk.
export const DEFAULT_MAX_LINES_PER_CHUNK = 200

const SKIPPED_FILE_NAMES = new Set([
  'bun.lock',
  'bun.lockb',
  'Cargo.lock',
  'composer.lock',
  'Gemfile.lock',
  'go.sum',
  'package-lock.json',
  'pnpm-lock.yaml',
  'poetry.lock',
  'uv.lock',
  'yarn.lock',
])

const SKIPPED_FILE_SUFFIXES = ['.min.js', '.min.css', '.map', '.snap']

export function isReviewableFile(file: PullRequestFile): file is PullRequestFile & {patch: string} {
  if (file.status === 'removed' || !file.patch) {
    return false
  }
  const fileName = file.path.slice(file.path.lastIndexOf('/') + 1)
  return (
    !SKIPPED_FILE_NAMES.has(fileName) &&
    !SKIPPED_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix))
  )
}

export function chunkPullRequestFiles(
  files: readonly PullRequestFile[],
  {maxLinesPerChunk = DEFAULT_MAX_LINES_PER_CHUNK}: ChunkPullRequestFilesOptions = {},
): ReviewChunk[] {
  return files.filter(isReviewableFile).flatMap(({path, patch}) => {
    const hunks = parsePatchHunks(patch).flatMap((hunk) => splitHunk(hunk, maxLinesPerChunk))
    return groupHunks(hunks, maxLinesPerChunk).map((group) => ({path, hunks: group}))
  })
}

function splitHunk(hunk: PatchHunk, maxLines: number): PatchHunk[] {
  const slices: PatchHunk[] = []
  for (let start = 0; start < hunk.lines.length; start += maxLines) {
    slices.push({lines: hunk.lines.slice(start, start + maxLines)})
  }
  return slices
}

function groupHunks(hunks: readonly PatchHunk[], maxLines: number): PatchHunk[][] {
  const groups: PatchHunk[][] = []
  let groupLineCount = 0
  for (const hunk of hunks) {
    const current = groups.at(-1)
    if (current && groupLineCount + hunk.lines.length <= maxLines) {
      current.push(hunk)
      groupLineCount += hunk.lines.length
    } else {
      groups.push([hunk])
      groupLineCount = hunk.lines.length
    }
  }
  return groups
}

export interface RenderedChunk {
  text: string
  // Index i holds the new-file line number of the chunk line labeled i + 1.
  newLineByLabel: readonly number[]
}

// Labels lines with chunk-local numbers instead of file line numbers, so an
// edit above the chunk shifts nothing in the rendered text and a cached review
// of the chunk stays valid. Removed lines get no label: a review comment can
// only anchor to a line of the new file.
export function renderChunk(chunk: ReviewChunk): RenderedChunk {
  const newLineByLabel: number[] = []
  const renderLine = (line: DiffLine): string => {
    const marker = {added: '+', removed: '-', context: ' '}[line.kind]
    if (line.newLine === undefined) {
      return `${' '.repeat(5)} ${marker} ${line.text}`
    }
    newLineByLabel.push(line.newLine)
    return `${String(newLineByLabel.length).padStart(5)} ${marker} ${line.text}`
  }
  const body = chunk.hunks.map((hunk) => hunk.lines.map(renderLine).join('\n')).join('\n  ...\n')
  return {text: `File: ${chunk.path}\n\n${body}`, newLineByLabel}
}
