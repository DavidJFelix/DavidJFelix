import {z} from 'zod'
import type {RenderedChunk, ReviewChunk} from './review-chunks'

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const

export type Severity = (typeof SEVERITIES)[number]

// Findings below this severity are not posted. Findings at or above the fail
// severity also fail the check run.
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

export const modelFindingsSchema = z.object({findings: z.array(modelFindingSchema)})

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

export function isAtLeast(severity: Severity, threshold: Severity): boolean {
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
  const toNewLine = (label: number) => rendered.newLineByLabel[label - 1]
  return findings.flatMap((finding) => {
    const startLine = toNewLine(finding.label)
    if (startLine === undefined) {
      return []
    }
    const lastLine = finding.endLabel ? toNewLine(finding.endLabel) : undefined
    return [
      {
        reviewerId,
        path: chunk.path,
        severity: finding.severity,
        title: finding.title,
        body: finding.body,
        startLine,
        endLine: lastLine !== undefined && lastLine > startLine ? lastLine : startLine,
        ...(typeof finding.suggestion === 'string' ? {suggestion: finding.suggestion} : {}),
      },
    ]
  })
}

// One inline comment per line: when the line ranges of two findings overlap,
// the more severe finding wins. Returns findings in severity order.
export function dedupeFindings(findings: readonly Finding[]): Finding[] {
  const bySeverity = findings.toSorted(
    (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity),
  )
  const kept: Finding[] = []
  for (const finding of bySeverity) {
    if (!kept.some((other) => findingsOverlap(finding, other))) {
      kept.push(finding)
    }
  }
  return kept
}

function findingsOverlap(a: Finding, b: Finding): boolean {
  return a.path === b.path && a.startLine <= b.endLine && b.startLine <= a.endLine
}

export interface ReviewOutcome {
  reported: Finding[]
  failed: boolean
}

export function decideOutcome(findings: readonly Finding[]): ReviewOutcome {
  const reported = dedupeFindings(findings).filter((finding) =>
    isAtLeast(finding.severity, REPORT_SEVERITY),
  )
  return {
    reported,
    failed: reported.some((finding) => isAtLeast(finding.severity, FAIL_SEVERITY)),
  }
}
