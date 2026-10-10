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

// Maps chunk-local labels back to new-file lines. A finding whose label is not
// in the chunk cannot become an inline comment, so it is dropped.
export function anchorFindings({
  reviewerId,
  chunk,
  rendered,
  findings,
}: AnchorFindingsParams): Finding[] {
  return findings.flatMap((finding) => {
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
        title: finding.title,
        body: finding.body,
        startLine,
        endLine: endLine ?? startLine,
        // A suggestion replaces the whole range that the model gave, so it does
        // not fit a range that was cut to its first line.
        ...(typeof suggestion === 'string' && endLine !== undefined ? {suggestion} : {}),
      },
    ]
  })
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
  const bySeverity = findings.toSorted(
    (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity),
  )
  const keptByCommentLine = new Map<string, Finding>()
  for (const finding of bySeverity) {
    const commentLine = `${finding.path}:${finding.endLine}`
    if (!keptByCommentLine.has(commentLine)) {
      keptByCommentLine.set(commentLine, finding)
    }
  }
  return [...keptByCommentLine.values()]
}

export interface ReviewOutcome {
  reported: Finding[]
  failed: boolean
}

export interface DecideOutcomeOptions {
  failedChunkReviewCount?: number
}

// A review with a failed chunk is incomplete, so it fails even when no finding
// reaches the fail severity.
export function decideOutcome(
  findings: readonly Finding[],
  {failedChunkReviewCount = 0}: DecideOutcomeOptions = {},
): ReviewOutcome {
  const reported = dedupeFindings(findings).filter((finding) =>
    isAtLeast({severity: finding.severity, threshold: REPORT_SEVERITY}),
  )
  return {
    reported,
    failed:
      failedChunkReviewCount > 0 ||
      reported.some((finding) => isAtLeast({severity: finding.severity, threshold: FAIL_SEVERITY})),
  }
}
