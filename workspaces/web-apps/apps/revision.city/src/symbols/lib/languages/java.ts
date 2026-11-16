import {parser} from '@lezer/java'

import type {SymbolSpec} from '../code-symbol'
import {symbolProp} from '../code-symbol'

const SPECS: Record<string, SymbolSpec> = {
  ClassDeclaration: {kind: 'class', name: ['Definition'], container: true},
  InterfaceDeclaration: {kind: 'interface', name: ['Definition'], container: true},
  EnumDeclaration: {kind: 'enum', name: ['Definition'], container: true},
  RecordDeclaration: {kind: 'class', name: ['Definition'], container: true},
  AnnotationTypeDeclaration: {kind: 'interface', name: ['Identifier'], container: true},
  MethodDeclaration: {kind: 'method', name: ['Definition'], container: true},
  ConstructorDeclaration: {kind: 'constructor', name: ['Definition'], container: true},
  CompactConstructorDeclaration: {kind: 'constructor', name: ['Definition'], container: true},
  FieldDeclaration: {kind: 'field', name: ['VariableDeclarator>Definition']},
  ConstantDeclaration: {kind: 'constant', name: ['VariableDeclarator>Definition']},
}

export const javaParser = parser.configure({props: [symbolProp.add(SPECS)]})
