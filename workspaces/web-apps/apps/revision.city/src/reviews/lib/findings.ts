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
  // Chunk-local line labels, as printed by renderChunk.
  line: z.int().positive(),
  endLine: z.int().positive().nullish(),
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
  line: number
  // Present only when the finding spans more than one line.
  startLine?: number
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
    const firstLine = toNewLine(finding.line)
    if (firstLine === undefined) {
      return []
    }
    const lastLine = finding.endLine ? toNewLine(finding.endLine) : undefined
    const spansLines = lastLine !== undefined && lastLine > firstLine
    return [
      {
        reviewerId,
        path: chunk.path,
        severity: finding.severity,
        title: finding.title,
        body: finding.body,
        line: spansLines ? lastLine : firstLine,
        ...(spansLines ? {startLine: firstLine} : {}),
        ...(finding.suggestion ? {suggestion: finding.suggestion} : {}),
      },
    ]
  })
}

// Two reviewers can flag the same problem on the same line. Keeps the most
// severe copy, in severity order.
export function dedupeFindings(findings: readonly Finding[]): Finding[] {
  const bySeverity = findings.toSorted(
    (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity),
  )
  const seen = new Set<string>()
  return bySeverity.filter((finding) => {
    const key = `${finding.path}:${finding.line}:${finding.title.trim().toLowerCase()}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
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
