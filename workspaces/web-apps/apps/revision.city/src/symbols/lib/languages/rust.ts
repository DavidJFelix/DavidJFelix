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

// Nodes that wrap the type name: `Stack<T>`, `&Widget`, `*const Widget`, `fmt::Debug`.
const WRAPPER_TYPES = new Set([
  'GenericType',
  'ReferenceType',
  'PointerType',
  'ScopedTypeIdentifier',
])

// `impl Widget` has one type; `impl Draw for Widget` has two, and the type after
// `for` is the implementing type -- the name a reader looks for. A type that is
// not a named type (`impl Draw for [u8]`) gives no name.
function resolveImplName({node, source}: ResolveEntityNameParams): string | undefined {
  let target = node.getChild('Type', 'for') ?? node.getChild('Type')
  while (target !== null && WRAPPER_TYPES.has(target.type.name)) {
    target = target.getChild('TypeIdentifier') ?? target.getChild('Type')
  }
  return target?.type.name === 'TypeIdentifier' ? source.slice(target.from, target.to) : undefined
}

export const rustParser = parser.configure({
  props: [entityProp.add(SPECS), anonymousScopeProp.add({ClosureExpression: true})],
})
