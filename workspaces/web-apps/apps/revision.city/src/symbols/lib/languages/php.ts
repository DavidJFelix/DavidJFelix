import {parser} from '@lezer/php'

import type {EntityKind, EntitySpec, ResolveEntityNameParams} from '../entity'
import {anonymousScopeProp, entityProp} from '../entity'

const SPECS: Record<string, EntitySpec> = {
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

function resolveMethodKind({node, source}: ResolveEntityNameParams): EntityKind {
  const name = node.getChild('Name')
  return name !== null && source.slice(name.from, name.to) === '__construct'
    ? 'constructor'
    : 'method'
}

export const phpParser = parser.configure({
  props: [
    entityProp.add(SPECS),
    anonymousScopeProp.add({ArrowFunction: true, FunctionExpression: true}),
  ],
})
