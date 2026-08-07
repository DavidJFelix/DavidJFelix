import type {Parser, SyntaxNode} from '@lezer/common'
import {parser} from '@lezer/javascript'

import type {EntityKind, EntitySpec, ResolveEntityNameParams} from '../entity'
import {anonymousScopeProp, entityProp} from '../entity'

// Initializers that make a binding a function rather than a value.
const FUNCTION_INITIALIZERS = new Set(['ArrowFunction', 'FunctionExpression', 'ClassExpression'])

// The identifiers vitest- and jest-style frameworks hang test calls off. A call
// on one of these with a literal title becomes a `test` entity, so a diff can
// say which test changed rather than listing the code inside its callback.
const TEST_CALLEES = new Set(['bench', 'describe', 'it', 'suite', 'test'])

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
  // Only calls that resolve a test title become entities; every other call
  // fails name resolution and is skipped. Deliberately not `top-level` scoped:
  // a test nested in a `describe` callback must still be reported.
  CallExpression: {kind: 'test', resolveName: resolveTestTitle, container: true},
}

function resolveTestTitle({node, source}: ResolveEntityNameParams): string | undefined {
  const callee = resolveCalleeBase(node.firstChild)
  if (callee === null || !TEST_CALLEES.has(source.slice(callee.from, callee.to))) {
    return undefined
  }
  const title = node.getChild('ArgList')?.getChild('String')
  return title === null || title === undefined
    ? undefined
    : source.slice(title.from + 1, title.to - 1)
}

// Unwraps member and curried forms -- `it.only(...)`, `test.each(rows)(...)` --
// to the identifier the framework hangs off.
function resolveCalleeBase(callee: SyntaxNode | null): SyntaxNode | null {
  if (callee === null) {
    return null
  }
  if (callee.type.name === 'VariableName') {
    return callee
  }
  if (callee.type.name === 'MemberExpression' || callee.type.name === 'CallExpression') {
    return resolveCalleeBase(callee.firstChild)
  }
  return null
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
  return parser.configure({
    dialect,
    props: [
      entityProp.add(SPECS),
      anonymousScopeProp.add({ArrowFunction: true, FunctionExpression: true}),
    ],
  })
}

export const javascriptParser = createParser('')
export const jsxParser = createParser('jsx')
export const typescriptParser = createParser('ts')
export const tsxParser = createParser('ts jsx')
