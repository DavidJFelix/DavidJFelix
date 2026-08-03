import type {SyntaxNode} from '@lezer/common'
import {parser} from '@lezer/cpp'

import type {EntityKind, EntitySpec, ResolveEntityNameParams} from '../entity'
import {entityProp} from '../entity'

// Declarator names sit at the bottom of an arbitrarily nested declarator chain
// (`int *const (*name)()`), so these are found by depth-first search rather than
// a fixed child path.
const DECLARATOR_NAMES = ['ScopedIdentifier', 'FieldIdentifier', 'Identifier', 'DestructorName']

const SPECS: Record<string, EntitySpec> = {
  NamespaceDefinition: {kind: 'module', name: ['Identifier'], container: true},
  StructSpecifier: {kind: 'struct', name: ['TypeIdentifier'], container: true},
  ClassSpecifier: {kind: 'class', name: ['TypeIdentifier'], container: true},
  EnumSpecifier: {kind: 'enum', name: ['TypeIdentifier'], container: true},
  FunctionDefinition: {kind: 'function', name: DECLARATOR_NAMES, deep: true, container: true},
  AliasDeclaration: {kind: 'type', name: ['TypeIdentifier']},
  TypedefDeclaration: {kind: 'type', name: ['TypeIdentifier'], deep: true},
  // A member is either a field or a prototype, told apart by the declarator.
  FieldDeclaration: {
    kind: 'field',
    name: DECLARATOR_NAMES,
    deep: true,
    resolveKind: resolveFieldKind,
  },
}

function resolveFieldKind({node}: ResolveEntityNameParams): EntityKind {
  return hasDescendant(node, 'FunctionDeclarator') ? 'method' : 'field'
}

function hasDescendant(node: SyntaxNode, type: string): boolean {
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.type.name === type || hasDescendant(child, type)) {
      return true
    }
  }
  return false
}

export const cppParser = parser.configure({props: [entityProp.add(SPECS)]})
