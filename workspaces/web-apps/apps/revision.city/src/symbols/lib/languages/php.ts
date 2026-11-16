import {parser} from '@lezer/php'

import type {ResolveSymbolNameParams, SymbolKind, SymbolSpec} from '../code-symbol'
import {anonymousScopeProp, symbolProp} from '../code-symbol'

const SPECS: Record<string, SymbolSpec> = {
  FunctionDefinition: {kind: 'function', name: ['Name'], container: true},
  ClassDeclaration: {kind: 'class', name: ['Name'], container: true},
  InterfaceDeclaration: {kind: 'interface', name: ['Name'], container: true},
  TraitDeclaration: {kind: 'trait', name: ['Name'], container: true},
  EnumDeclaration: {kind: 'enum', name: ['Name'], container: true},
  MethodDeclaration: {
    kind: 'method',
    name: ['Name'],
    container: true,
    resolveKind: resolveMethodKind,
  },
  PropertyDeclaration: {kind: 'property', name: ['VariableName'], deep: true},
  ConstDeclaration: {kind: 'constant', name: ['VariableDeclarator>Name'], scope: 'top-level'},
}

function resolveMethodKind({node, source}: ResolveSymbolNameParams): SymbolKind {
  const name = node.getChild('Name')
  return name !== null && source.slice(name.from, name.to) === '__construct'
    ? 'constructor'
    : 'method'
}

export const phpParser = parser.configure({
  props: [
    symbolProp.add(SPECS),
    anonymousScopeProp.add({ArrowFunction: true, FunctionExpression: true}),
  ],
})
