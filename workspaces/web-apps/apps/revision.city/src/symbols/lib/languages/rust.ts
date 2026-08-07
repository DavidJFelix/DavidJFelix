import {parser} from '@lezer/rust'

import type {EntitySpec, ResolveEntityNameParams} from '../entity'
import {anonymousScopeProp, entityProp} from '../entity'

const SPECS: Record<string, EntitySpec> = {
  StructItem: {kind: 'struct', name: ['TypeIdentifier'], container: true},
  EnumItem: {kind: 'enum', name: ['TypeIdentifier'], container: true},
  TraitItem: {kind: 'trait', name: ['TypeIdentifier'], container: true},
  ImplItem: {kind: 'impl', resolveName: resolveImplName, container: true},
  FunctionItem: {kind: 'function', name: ['BoundIdentifier'], container: true},
  ModItem: {kind: 'module', name: ['BoundIdentifier'], container: true},
  TypeItem: {kind: 'type', name: ['TypeIdentifier']},
  MacroDefinition: {kind: 'macro', name: ['Identifier']},
  ConstItem: {kind: 'constant', name: ['BoundIdentifier'], scope: 'top-level'},
  StaticItem: {kind: 'constant', name: ['BoundIdentifier'], scope: 'top-level'},
}

// `impl Widget` has one type; `impl Draw for Widget` has two, and the second is
// the implementing type -- the name a reader looks for. Taking the last
// TypeIdentifier covers both.
function resolveImplName({node, source}: ResolveEntityNameParams): string | undefined {
  const types = node.getChildren('TypeIdentifier')
  const target = types.at(-1)
  return target === undefined ? undefined : source.slice(target.from, target.to)
}

export const rustParser = parser.configure({
  props: [entityProp.add(SPECS), anonymousScopeProp.add({ClosureExpression: true})],
})
