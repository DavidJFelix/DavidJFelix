import {type DiffLine, type PatchHunk, parsePatchHunks} from './patch-hunks'
import {oneLine} from './review-markdown'

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

export interface ChunkPullRequestFilesOptions extends FileReviewStatusOptions {
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

// A diff this long is almost always generated or vendored code. Its review
// would cost more than it finds.
export const DEFAULT_MAX_PATCH_LINES_PER_FILE = 1500

export interface FileReviewStatusOptions {
  maxPatchLinesPerFile?: number
}

// `skipped`: removed files, lockfiles, and generated files, which are not
// reviewed by design. A caller can report `no-text-diff` and `too-large` files
// as not reviewed.
export type FileReviewStatus = 'reviewable' | 'skipped' | 'no-text-diff' | 'too-large'

export function fileReviewStatus(
  file: PullRequestFile,
  {maxPatchLinesPerFile = DEFAULT_MAX_PATCH_LINES_PER_FILE}: FileReviewStatusOptions = {},
): FileReviewStatus {
  const fileName = file.path.slice(file.path.lastIndexOf('/') + 1)
  if (
    file.status === 'removed' ||
    SKIPPED_FILE_NAMES.has(fileName) ||
    SKIPPED_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix))
  ) {
    return 'skipped'
  }
  if (!file.patch) {
    return 'no-text-diff'
  }
  return file.patch.split('\n').length > maxPatchLinesPerFile ? 'too-large' : 'reviewable'
}

export function isReviewableFile(
  file: PullRequestFile,
  options?: FileReviewStatusOptions,
): file is PullRequestFile & {patch: string} {
  return fileReviewStatus(file, options) === 'reviewable'
}

export function chunkPullRequestFiles(
  files: readonly PullRequestFile[],
  {
    maxLinesPerChunk = DEFAULT_MAX_LINES_PER_CHUNK,
    ...statusOptions
  }: ChunkPullRequestFilesOptions = {},
): ReviewChunk[] {
  const reviewable = files.filter((file) => isReviewableFile(file, statusOptions))
  return reviewable.flatMap(({path, patch}) => {
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

// Labels lines with chunk-local numbers, not file line numbers. So a chunk that
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

// Each model call sends the description again, so it stops at this many
// characters.
export const MAX_DESCRIPTION_CHARS = 4_000

export interface RenderPullRequestDescriptionParams {
  title: string
  description: string
}

// The description is the author's text. These lines mark where it starts and
// ends, and the system prompt names them.
export const DESCRIPTION_START = '<<<description'
export const DESCRIPTION_END = 'description>>>'

// Each reviewer gets the title and description before its chunk, because they
// tell what the author wants the change to do.
export function renderPullRequestDescription({
  title,
  description,
}: RenderPullRequestDescriptionParams): string {
  // Without the markers, the author's text cannot end the description early.
  const text = withoutMarkers(description).trim()
  const shown = text.slice(0, MAX_DESCRIPTION_CHARS)
  const cut =
    text.length > shown.length ? `\n(${text.length - shown.length} more characters not shown)` : ''
  return [
    `Pull request title: ${oneLine(withoutMarkers(title))}`,
    text === ''
      ? 'Pull request description: none'
      : `Pull request description:\n${DESCRIPTION_START}\n${shown}\n${DESCRIPTION_END}${cut}`,
  ].join('\n\n')
}

// A space, not an empty string, takes the place of each marker: the markers
// contain no space, so the text on the two sides cannot join into a new marker.
function withoutMarkers(text: string): string {
  return text.replaceAll(DESCRIPTION_START, ' ').replaceAll(DESCRIPTION_END, ' ')
}

// Each model call sends the list again, so the list stops at this many
// characters. Most pull requests need a few hundred.
export const MAX_FILE_LIST_CHARS = 10_000

// Each reviewer gets this list before its chunk, because a change that the chunk
// needs is often in another file of the pull request. Skipped files are in the
// list too.
export function renderFileList(files: readonly PullRequestFile[]): string {
  const lines: string[] = []
  let chars = 0
  for (const {path, status} of files) {
    const line = `- ${oneLine(path)} (${status})`
    chars += line.length + 1
    if (chars > MAX_FILE_LIST_CHARS) {
      break
    }
    lines.push(line)
  }
  const unlistedCount = files.length - lines.length
  return [
    'Files that the pull request changes:',
    ...lines,
    ...(unlistedCount > 0 ? [`(${unlistedCount} more not listed)`] : []),
  ].join('\n')
}
