import type {Parser, SyntaxNode} from '@lezer/common'
import {parser} from '@lezer/javascript'

import type {EntityKind, EntitySpec, ResolveEntityNameParams} from '../entity'
import {anonymousScopeProp, entityProp} from '../entity'

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
  // A call in statement position at module scope is itself the semantic unit:
  // a registered test, a mounted route, an executed side effect. No framework
  // vocabulary -- `test('adds', ...)` and `app.use(...)` are the same fact, a
  // function called at the top level of the module.
  CallExpression: {
    kind: 'call',
    scope: 'top-level',
    accept: isStatementCall,
    resolveName: resolveCallLabel,
  },
}

// Statement position only: an initializer or argument is part of the entity
// that contains it, not a module-level action of its own. Top-level `await`
// still counts -- the statement is the call.
function isStatementCall({node}: ResolveEntityNameParams): boolean {
  const parent = node.parent
  if (parent === null) {
    return false
  }
  if (parent.type.name === 'ExpressionStatement') {
    return true
  }
  return (
    parent.type.name === 'AwaitExpression' && parent.parent?.type.name === 'ExpressionStatement'
  )
}

// Callee identifier path plus the first literal argument when there is one:
// `test('adds numbers')`, `vi.mock('@pierre/icons')`, `startServer`. The
// literal is what keeps twenty sibling `test(...)` calls tellable apart.
function resolveCallLabel({node, source}: ResolveEntityNameParams): string | undefined {
  const path = calleePath(node.firstChild, source)
  if (path === undefined) {
    return undefined
  }
  const title = node.getChild('ArgList')?.getChild('String')
  return title === null || title === undefined
    ? path
    : `${path}(${source.slice(title.from, title.to)})`
}

// Flattens member and curried forms -- `it.only(...)`, `test.each(rows)(...)`
// -- to a dotted identifier path, dropping intermediate arguments.
function calleePath(callee: SyntaxNode | null, source: string): string | undefined {
  if (callee === null) {
    return undefined
  }
  if (callee.type.name === 'VariableName') {
    return source.slice(callee.from, callee.to)
  }
  if (callee.type.name === 'CallExpression') {
    return calleePath(callee.firstChild, source)
  }
  if (callee.type.name === 'MemberExpression') {
    const base = calleePath(callee.firstChild, source)
    const property = callee.getChild('PropertyName')
    if (base === undefined || property === null) {
      return undefined
    }
    return `${base}.${source.slice(property.from, property.to)}`
  }
  return undefined
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
