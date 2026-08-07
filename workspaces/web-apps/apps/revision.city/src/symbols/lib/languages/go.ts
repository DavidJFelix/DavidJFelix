import type {SyntaxNode} from '@lezer/common'
import {parser} from '@lezer/go'

import type {EntityKind, EntitySpec, ResolveEntityNameParams} from '../entity'
import {anonymousScopeProp, entityProp} from '../entity'

// The declaration keyword wraps one or more specs (`var ( a = 1; b = 2 )`), so
// the specs are the entities -- registering the wrapper would collapse a group
// into a single symbol.
const SPECS: Record<string, EntitySpec> = {
  FunctionDecl: {kind: 'function', name: ['DefName'], container: true},
  MethodDecl: {kind: 'method', name: ['FieldName'], container: true},
  TypeSpec: {kind: 'type', name: ['DefName'], container: true, resolveKind: resolveTypeKind},
  ConstSpec: {kind: 'constant', name: ['DefName'], scope: 'top-level'},
  VarSpec: {kind: 'variable', name: ['DefName'], scope: 'top-level'},
}

function resolveTypeKind({node}: ResolveEntityNameParams): EntityKind {
  for (let child: SyntaxNode | null = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.type.name === 'StructType') {
      return 'struct'
    }
    if (child.type.name === 'InterfaceType') {
      return 'interface'
    }
  }
  return 'type'
}

export const goParser = parser.configure({
  props: [entityProp.add(SPECS), anonymousScopeProp.add({FunctionLiteral: true})],
})
