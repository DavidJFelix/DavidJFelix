import {parser} from '@lezer/markdown'

import type {EntitySpec, ResolveEntityNameParams} from '../entity'
import {entityProp} from '../entity'

// Headings carry their marker (`##`) and, for setext, an underline; the entity
// name is what is left once those are removed.
function resolveHeadingText({node, source}: ResolveEntityNameParams): string | undefined {
  const mark = node.getChild('HeaderMark')
  const start = mark === null ? node.from : mark.to
  const text = removeClosingSequence(source.slice(start, node.to).split('\n')[0]).trim()
  return text === '' ? undefined : text
}

// Removes the closing `#` run of an ATX heading, which must follow whitespace.
// Do not use a regex such as `/\s+#*\s*$/u` here: it backtracks for seconds on
// a long run of spaces.
function removeClosingSequence(line: string): string {
  const trimmed = line.trimEnd()
  let end = trimmed.length
  while (end > 0 && trimmed[end - 1] === '#') {
    end -= 1
  }
  const followsWhitespace = end > 0 && end < trimmed.length && trimmed[end - 1].trim() === ''
  return followsWhitespace ? trimmed.slice(0, end) : trimmed
}

const HEADING_TYPES = [
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
  'SetextHeading1',
  'SetextHeading2',
]

const SPECS: Record<string, EntitySpec> = Object.fromEntries(
  HEADING_TYPES.map((type) => [type, {kind: 'heading', resolveName: resolveHeadingText}]),
)

// Markdown headings are siblings rather than nested nodes, so they stay flat --
// a heading is never a container for the ones that follow it.
export const markdownParser = parser.configure({
  props: [entityProp.add(SPECS)],
  // The hard-break rule reads a run of spaces again from each space in it, so
  // 40,000 spaces take 5 s to parse with it. No entity needs hard breaks.
  remove: ['HardBreak'],
})
