import {type DiffLine, type PatchHunk, parsePatchHunks} from './patch-hunks'

export type PullRequestFileStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged'

// One file from GitHub's "list pull request files" endpoint, with `filename`
// renamed to `path`. `patch` is absent for binary files and for diffs too large
// for GitHub to inline.
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
    const hunks = parsePatchHunks(patch)
      .flatMap((hunk) => splitHunk(hunk, maxLinesPerChunk))
      // A slice of only removed lines has no labels, so `anchorFindings` would drop
      // every finding in it. Its review would cost money and report nothing.
      .filter((hunk) => hunk.lines.some((line) => line.kind !== 'removed'))
    return groupHunks(hunks, maxLinesPerChunk).map((group) => ({path, hunks: group}))
  })
}

function splitHunk(hunk: PatchHunk, maxLines: number): PatchHunk[] {
  const step = Math.max(1, maxLines)
  const slices: PatchHunk[] = []
  for (let start = 0; start < hunk.lines.length; start += step) {
    slices.push({lines: hunk.lines.slice(start, start + step)})
  }
  return slices
}

// Fills each chunk from the top of the file, so a push that grows or shrinks a
// hunk can move the chunk boundaries below it.
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
  newLineByLabel: ReadonlyMap<number, number>
}

// Labels lines with chunk-local numbers, not file line numbers, so a chunk that
// only moves in the file, for example after a rebase, keeps its text and its
// saved review. Removed lines get no label, because findings anchor only to lines
// of the new file.
export function renderChunk(chunk: ReviewChunk): RenderedChunk {
  const newLineByLabel = new Map<number, number>()
  const renderLine = (line: DiffLine): string => {
    const marker = {added: '+', removed: '-', context: ' '}[line.kind]
    if (line.kind === 'removed') {
      return `${' '.repeat(5)} ${marker} ${line.text}`
    }
    const label = newLineByLabel.size + 1
    newLineByLabel.set(label, line.newLine)
    return `${String(label).padStart(5)} ${marker} ${line.text}`
  }
  const body = chunk.hunks.map((hunk) => hunk.lines.map(renderLine).join('\n')).join('\n  ...\n')
  return {text: `File: ${chunk.path}\n\n${body}`, newLineByLabel}
}
