import {parser} from '@lezer/java'

import type {EntitySpec} from '../entity'
import {entityProp} from '../entity'

const SPECS: Record<string, EntitySpec> = {
  ClassDeclaration: {kind: 'class', name: ['Definition'], container: true},
  InterfaceDeclaration: {kind: 'interface', name: ['Definition'], container: true},
  EnumDeclaration: {kind: 'enum', name: ['Definition'], container: true},
  MethodDeclaration: {kind: 'method', name: ['Definition'], container: true},
  ConstructorDeclaration: {kind: 'constructor', name: ['Definition'], container: true},
  FieldDeclaration: {kind: 'field', name: ['VariableDeclarator']},
}

export const javaParser = parser.configure({props: [entityProp.add(SPECS)]})
