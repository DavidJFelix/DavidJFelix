import {
  DEFAULT_MAX_PATCH_LINES_PER_FILE,
  type FileReviewStatus,
  fileReviewStatus,
  isReviewableFile,
  type PullRequestFile,
} from './review-chunks'
import {MAX_OUTPUT_CHARS, type NotReviewedFile, oneLine} from './review-markdown'

// Workflows keep at most 1 MiB for each step result, and the selection is a step
// result. The files to review get at most this many bytes, and the rest is for
// the `notReviewed` list.
const MAX_REVIEWED_BYTES = 700_000
// V8's serialization adds about 30 bytes to each file object, and the status
// adds up to 9. The rest is a margin.
const FILE_OVERHEAD_BYTES = 64

export const OVER_LIMIT_REASON = 'over the review size limit'

const NOT_REVIEWED_REASONS: Partial<Record<FileReviewStatus, string>> = {
  'no-text-diff': 'GitHub shows no text diff',
  'too-large': `the diff is longer than ${DEFAULT_MAX_PATCH_LINES_PER_FILE} lines`,
}

export interface ReviewFileSelection {
  files: PullRequestFile[]
  notReviewed: NotReviewedFile[]
}

// Keeps each reviewable file, in GitHub's order, if it fits in what is left of
// MAX_REVIEWED_BYTES. The `notReviewed` list keeps each path on one line, as the
// check run shows it. The list stops when its paths and reasons are longer than
// MAX_OUTPUT_CHARS characters, because the check run cannot show more. The check
// run then cuts the list and says so.
export function selectReviewFiles(files: readonly PullRequestFile[]): ReviewFileSelection {
  const selection: ReviewFileSelection = {files: [], notReviewed: []}
  let reviewedBytes = 0
  let notReviewedChars = 0
  const leaveOut = (path: string, reason: string) => {
    if (notReviewedChars <= MAX_OUTPUT_CHARS) {
      // The check run cannot show a longer path, and the cut keeps one long path
      // from making the step result too large.
      const shownPath = oneLine(path).slice(0, MAX_OUTPUT_CHARS)
      notReviewedChars += shownPath.length + reason.length
      selection.notReviewed.push({path: shownPath, reason})
    }
  }
  for (const file of files) {
    const reason = NOT_REVIEWED_REASONS[fileReviewStatus(file)]
    if (reason !== undefined) {
      leaveOut(file.path, reason)
    } else if (isReviewableFile(file)) {
      const bytes = storedBytes(file.path) + storedBytes(file.patch) + FILE_OVERHEAD_BYTES
      if (reviewedBytes + bytes > MAX_REVIEWED_BYTES) {
        leaveOut(file.path, OVER_LIMIT_REASON)
      } else {
        reviewedBytes += bytes
        selection.files.push(file)
      }
    }
  }
  return selection
}

// Step results use V8's serialization, which takes 2 bytes for each character
// of a string that has a character above U+00FF.
function storedBytes(text: string): number {
  return /[\u0100-\uFFFF]/.test(text) ? text.length * 2 : text.length
}
