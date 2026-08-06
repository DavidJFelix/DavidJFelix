import {parser as cssGrammar} from '@lezer/css'
import {parser as sassGrammar} from '@lezer/sass'

import type {EntitySpec, ResolveEntityNameParams} from '../entity'
import {entityProp} from '../entity'

// A rule's identity is its selector list, which is a run of sibling nodes rather
// than one named node -- so the name is the source text ahead of the block.
function resolveSelector({node, source}: ResolveEntityNameParams): string | undefined {
  const block = node.getChild('Block')
  const end = block?.from ?? node.to
  const selector = source.slice(node.from, end).trim().replaceAll(/\s+/gu, ' ')
  return selector === '' ? undefined : selector
}

const SPECS: Record<string, EntitySpec> = {
  RuleSet: {kind: 'rule', resolveName: resolveSelector, container: true},
  KeyframesStatement: {kind: 'rule', name: ['KeyframeName']},
}

// `@mixin name` puts the name in a ValueName; `@function name($a)` wraps it in a
// CallExpression. Both arrive as MixinStatement.
const SASS_SPECS: Record<string, EntitySpec> = {
  ...SPECS,
  MixinStatement: {kind: 'mixin', name: ['ValueName', 'CallExpression>Callee', 'CallExpression']},
}

export const cssParser = cssGrammar.configure({props: [entityProp.add(SPECS)]})
export const sassParser = sassGrammar.configure({props: [entityProp.add(SASS_SPECS)]})
