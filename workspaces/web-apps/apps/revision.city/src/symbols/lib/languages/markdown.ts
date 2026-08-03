import {parser} from '@lezer/markdown'

import type {EntitySpec, ResolveEntityNameParams} from '../entity'
import {entityProp} from '../entity'

// Headings carry their marker (`##`) and, for setext, an underline; the entity
// name is what is left once those are removed.
function resolveHeadingText({node, source}: ResolveEntityNameParams): string | undefined {
  const mark = node.getChild('HeaderMark')
  const start = mark === null ? node.from : mark.to
  const text = source
    .slice(start, node.to)
    .split('\n')[0]
    .replace(/\s+#*\s*$/u, '')
    .trim()
  return text === '' ? undefined : text
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
export const markdownParser = parser.configure({props: [entityProp.add(SPECS)]})
