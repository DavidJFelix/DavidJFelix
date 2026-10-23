import {z} from 'zod'
import type {RenderedChunk, ReviewChunk} from './review-chunks'

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const

export type Severity = (typeof SEVERITIES)[number]

export const REPORT_SEVERITY: Severity = 'medium'
export const FAIL_SEVERITY: Severity = 'high'

export const modelFindingSchema = z.object({
  severity: z.enum(SEVERITIES),
  title: z.string().min(1),
  body: z.string().min(1),
  // A malformed finding fails the chunk review, so a missing value or one that
  // is not a boolean becomes false.
  checked: z.boolean().catch(false),
  label: z.int().positive(),
  endLabel: z.int().positive().nullish(),
  suggestion: z.string().nullish(),
})

export type ModelFinding = z.infer<typeof modelFindingSchema>

// Findings stay unknown here, so that each one is checked on its own and one
// malformed finding does not hide the valid ones.
export const modelAnswerSchema = z.object({findings: z.array(z.unknown())})

export interface Finding {
  reviewerId: string
  path: string
  severity: Severity
  title: string
  body: string
  // The reviewer says that the code it saw shows the problem is real.
  checked: boolean
  startLine: number
  endLine: number
  suggestion?: string
}

export interface IsAtLeastParams {
  severity: Severity
  threshold: Severity
}

export function isAtLeast({severity, threshold}: IsAtLeastParams): boolean {
  return SEVERITIES.indexOf(severity) <= SEVERITIES.indexOf(threshold)
}

export interface AnchorFindingsParams {
  reviewerId: string
  chunk: ReviewChunk
  rendered: RenderedChunk
  findings: readonly ModelFinding[]
}

// Limits on what one model answer can add to a review. They keep the findings
// within GitHub's limit of 65,536 characters for a comment and Cloudflare's
// limit of 1 MiB for a Workflow step result.
const MAX_FINDINGS_PER_ANSWER = 20
const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 3000
const MAX_SUGGESTION_LENGTH = 3000

// Maps chunk-local labels back to new-file lines. A finding whose label is not
// in the chunk cannot become an inline comment, so it is dropped.
export function anchorFindings({
  reviewerId,
  chunk,
  rendered,
  findings,
}: AnchorFindingsParams): Finding[] {
  return findings
    .flatMap((finding) => {
      const startLine = rendered.newLineByLabel.get(finding.label)
      if (startLine === undefined) {
        return []
      }
      const endLine = rangeEndLine({newLineByLabel: rendered.newLineByLabel, finding, startLine})
      const {suggestion} = finding
      return [
        {
          reviewerId,
          path: chunk.path,
          severity: finding.severity,
          title: clip(finding.title, MAX_TITLE_LENGTH),
          body: clip(finding.body, MAX_BODY_LENGTH),
          checked: finding.checked,
          startLine,
          endLine: endLine ?? startLine,
          // A suggestion replaces the whole range that the model gave, so it does
          // not fit a range that was cut to its first line. A cut suggestion
          // would also replace the lines with broken code.
          ...(typeof suggestion === 'string' &&
          endLine !== undefined &&
          suggestion.length <= MAX_SUGGESTION_LENGTH
            ? {suggestion}
            : {}),
        },
      ]
    })
    .toSorted(bySeverity)
    .slice(0, MAX_FINDINGS_PER_ANSWER)
}

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`
}

function bySeverity(a: Finding, b: Finding): number {
  return SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
}

interface RangeEndLineParams {
  newLineByLabel: RenderedChunk['newLineByLabel']
  finding: ModelFinding
  startLine: number
}

function rangeEndLine({
  newLineByLabel,
  finding,
  startLine,
}: RangeEndLineParams): number | undefined {
  const {label, endLabel} = finding
  if (endLabel === undefined || endLabel === null) {
    return startLine
  }
  const endLine = newLineByLabel.get(endLabel)
  const endsAfterStart = endLabel >= label
  // In one hunk, each next label is the next file line.
  const staysInOneHunk = endLine !== undefined && endLine - startLine === endLabel - label
  return endsAfterStart && staysInOneHunk ? endLine : undefined
}

// One inline comment per line: when findings end on the same line, where GitHub
// shows the comment, the most severe finding wins. Findings whose ranges only
// overlap are all kept, so that a wide range does not hide other problems in it.
// Returns findings in severity order.
export function dedupeFindings(findings: readonly Finding[]): Finding[] {
  const keptByCommentLine = new Map<string, Finding>()
  for (const finding of findings.toSorted(bySeverity)) {
    const commentLine = `${finding.path}:${finding.endLine}`
    if (!keptByCommentLine.has(commentLine)) {
      keptByCommentLine.set(commentLine, finding)
    }
  }
  return [...keptByCommentLine.values()]
}

export interface ReviewOutcome {
  reported: Finding[]
  // The findings at or above the report severity whose `checked` is false. The
  // review does not post them.
  unchecked: Finding[]
  failed: boolean
}

export interface DecideOutcomeOptions {
  failedChunkReviewCount?: number
}

// A review with a failed chunk is incomplete, so it fails even when no finding
// reaches the fail severity. A finding that the reviewer did not check cannot
// fail the review, and it cannot hide a checked finding on the same line.
export function decideOutcome(
  findings: readonly Finding[],
  {failedChunkReviewCount = 0}: DecideOutcomeOptions = {},
): ReviewOutcome {
  const atReportSeverity = findings.filter((finding) =>
    isAtLeast({severity: finding.severity, threshold: REPORT_SEVERITY}),
  )
  const reported = dedupeFindings(atReportSeverity.filter((finding) => finding.checked))
  return {
    reported,
    unchecked: dedupeFindings(atReportSeverity.filter((finding) => !finding.checked)),
    failed:
      failedChunkReviewCount > 0 ||
      reported.some((finding) => isAtLeast({severity: finding.severity, threshold: FAIL_SEVERITY})),
  }
}
