import type {SyntaxNode} from '@lezer/common'
import {parser} from '@lezer/cpp'

import type {EntityKind, EntitySpec, ResolveEntityNameParams} from '../entity'
import {entityProp} from '../entity'

// A declarator name sits at the bottom of a chain of these wrappers
// (`int *const (*name)()`). The walk follows only these nodes, so it never
// reads a name from a parameter list, a default argument or an initializer list.
const DECLARATOR_WRAPPERS = new Set([
  'ArrayDeclarator',
  'FunctionDeclarator',
  'ParenthesizedDeclarator',
  'PointerDeclarator',
  'ReferenceDeclarator',
])

const MEMBER_NAMES = new Set([
  'DestructorName',
  'FieldIdentifier',
  'Identifier',
  'OperatorName',
  'ScopedIdentifier',
])

const TYPE_NAMES = new Set(['TypeIdentifier'])

const SPECS: Record<string, EntitySpec> = {
  NamespaceDefinition: {kind: 'module', name: ['Identifier'], container: true},
  // A specifier without a body only refers to the type (`struct request *req`,
  // `class Forward;`), so it is not an entity.
  StructSpecifier: {kind: 'struct', name: ['TypeIdentifier'], container: true, accept: hasFields},
  ClassSpecifier: {kind: 'class', name: ['TypeIdentifier'], container: true, accept: hasFields},
  UnionSpecifier: {kind: 'union', name: ['TypeIdentifier'], container: true, accept: hasFields},
  EnumSpecifier: {
    kind: 'enum',
    name: ['TypeIdentifier'],
    container: true,
    accept: hasEnumerators,
  },
  FunctionDefinition: {kind: 'function', resolveName: resolveMemberName, container: true},
  AliasDeclaration: {kind: 'type', name: ['TypeIdentifier']},
  // The fields of `typedef struct {...} Name` nest under `Name`.
  TypeDefinition: {kind: 'type', resolveName: resolveTypedefName, container: true},
  // A member is either a field or a prototype, told apart by the declarator.
  FieldDeclaration: {kind: 'field', resolveName: resolveMemberName, resolveKind: resolveFieldKind},
}

function hasFields({node}: ResolveEntityNameParams): boolean {
  return node.getChild('FieldDeclarationList') !== null
}

function hasEnumerators({node}: ResolveEntityNameParams): boolean {
  return node.getChild('EnumeratorList') !== null
}

interface DeclaratorChainParams {
  node: SyntaxNode
  names: ReadonlySet<string>
}

interface DeclaratorChain {
  readonly name: SyntaxNode
  readonly isFunction: boolean
}

function declaratorChain({node, names}: DeclaratorChainParams): DeclaratorChain | undefined {
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (names.has(child.type.name)) {
      return {name: child, isFunction: false}
    }
    if (DECLARATOR_WRAPPERS.has(child.type.name)) {
      const chain = declaratorChain({node: child, names})
      return chain === undefined
        ? undefined
        : {...chain, isFunction: chain.isFunction || child.type.name === 'FunctionDeclarator'}
    }
  }
  return undefined
}

function resolveMemberName({node, source}: ResolveEntityNameParams): string | undefined {
  const chain = declaratorChain({node, names: MEMBER_NAMES})
  return chain === undefined ? undefined : source.slice(chain.name.from, chain.name.to)
}

function resolveFieldKind({node}: ResolveEntityNameParams): EntityKind {
  return declaratorChain({node, names: MEMBER_NAMES})?.isFunction === true ? 'method' : 'field'
}

// The new name comes after the aliased type: `node_t` in
// `typedef struct node {...} node_t`, `fn_t` in `typedef int (*fn_t)(int)`.
function resolveTypedefName({node, source}: ResolveEntityNameParams): string | undefined {
  let name: SyntaxNode | undefined
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.type.name === 'TypeIdentifier') {
      name = child
    } else if (DECLARATOR_WRAPPERS.has(child.type.name)) {
      name = declaratorChain({node: child, names: TYPE_NAMES})?.name ?? name
    }
  }
  return name === undefined ? undefined : source.slice(name.from, name.to)
}

export const cppParser = parser.configure({props: [entityProp.add(SPECS)]})
