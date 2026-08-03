import type {Parser, SyntaxNode} from '@lezer/common'
import {parser} from '@lezer/javascript'

import type {EntityKind, EntitySpec, ResolveEntityNameParams} from '../entity'
import {entityProp} from '../entity'

// Initializers that make a binding a function rather than a value.
const FUNCTION_INITIALIZERS = new Set(['ArrowFunction', 'FunctionExpression', 'ClassExpression'])

const SPECS: Record<string, EntitySpec> = {
  FunctionDeclaration: {kind: 'function', name: ['VariableDefinition'], container: true},
  ClassDeclaration: {kind: 'class', name: ['VariableDefinition'], container: true},
  MethodDeclaration: {
    kind: 'method',
    name: ['PropertyDefinition', 'PrivatePropertyDefinition'],
    container: true,
    resolveKind: resolveMethodKind,
  },
  PropertyDeclaration: {
    kind: 'property',
    name: ['PropertyDefinition', 'PrivatePropertyDefinition'],
  },
  InterfaceDeclaration: {kind: 'interface', name: ['TypeDefinition'], container: true},
  TypeAliasDeclaration: {kind: 'type', name: ['TypeDefinition']},
  EnumDeclaration: {kind: 'enum', name: ['TypeDefinition']},
  NamespaceDeclaration: {kind: 'module', name: ['VariableDefinition'], container: true},
  // Only module- and class-level bindings; `scope` keeps function locals out.
  VariableDeclaration: {
    kind: 'constant',
    name: ['VariableDefinition'],
    scope: 'top-level',
    container: true,
    resolveKind: resolveBindingKind,
  },
}

// A class member named `constructor` is reported as one so the diff can say so.
function resolveMethodKind({node, source}: ResolveEntityNameParams): EntityKind {
  const name = node.getChild('PropertyDefinition')
  return name !== null && source.slice(name.from, name.to) === 'constructor'
    ? 'constructor'
    : 'method'
}

function resolveBindingKind({node}: ResolveEntityNameParams): EntityKind {
  return hasFunctionInitializer(node) ? 'function' : 'constant'
}

function hasFunctionInitializer(node: SyntaxNode): boolean {
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (FUNCTION_INITIALIZERS.has(child.type.name)) {
      return true
    }
  }
  return false
}

// Dialects are configured per file type rather than parsed once: the `ts`
// dialect rejects JSX-ambiguous syntax and vice versa, so each gets its own
// parser instance with the entity table attached.
function createParser(dialect: string): Parser {
  return parser.configure({dialect, props: [entityProp.add(SPECS)]})
}

export const javascriptParser = createParser('')
export const jsxParser = createParser('jsx')
export const typescriptParser = createParser('ts')
export const tsxParser = createParser('ts jsx')
