export type DiffLine =
  | {kind: 'added' | 'context'; text: string; newLine: number}
  | {kind: 'removed'; text: string}

type DiffLineKind = DiffLine['kind']

export interface PatchHunk {
  lines: readonly DiffLine[]
}

const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

const LINE_KINDS: Readonly<Record<string, DiffLineKind>> = {
  '+': 'added',
  '-': 'removed',
  ' ': 'context',
}

// Parses the hunk-only patch text GitHub returns per file (no `diff --git` or
// `---`/`+++` headers). Lines before the first hunk header and git's
// "\ No newline at end of file" markers carry no reviewable content.
export function parsePatchHunks(patch: string): PatchHunk[] {
  const hunks: DiffLine[][] = []
  let nextNewLine = 0
  for (const rawLine of patch.split('\n')) {
    const header = HUNK_HEADER_PATTERN.exec(rawLine)
    if (header) {
      hunks.push([])
      nextNewLine = Number(header[1])
      continue
    }
    const current = hunks.at(-1)
    const kind = LINE_KINDS[rawLine.charAt(0)]
    if (!current || !kind) {
      continue
    }
    const text = rawLine.slice(1)
    if (kind === 'removed') {
      current.push({kind, text})
    } else {
      current.push({kind, text, newLine: nextNewLine})
      nextNewLine += 1
    }
  }
  return hunks.filter((lines) => lines.length > 0).map((lines) => ({lines}))
}
