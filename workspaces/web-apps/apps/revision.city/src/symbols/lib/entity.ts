import type {SyntaxNode} from '@lezer/common'
import {NodeProp} from '@lezer/common'

// The vocabulary of things a diff can talk about. Deliberately broader than any
// single language: each grammar maps its own node types onto this set so the
// viewer renders one consistent legend regardless of file type.
export type EntityKind =
  | 'class'
  | 'constant'
  | 'constructor'
  | 'enum'
  | 'field'
  | 'function'
  | 'heading'
  | 'impl'
  | 'interface'
  | 'macro'
  | 'method'
  | 'mixin'
  | 'module'
  | 'property'
  | 'rule'
  | 'struct'
  | 'trait'
  | 'type'
  | 'variable'

// How an entity fared between two revisions. Mirrors sem's change buckets so a
// higher-fidelity backend could later fill the same shape.
export type EntityChangeType = 'added' | 'deleted' | 'modified' | 'moved' | 'renamed'

export interface EntityRange {
  readonly startLine: number
  readonly endLine: number
}

export interface CodeEntity {
  readonly kind: EntityKind
  readonly name: string
  // Dotted path through enclosing containers, e.g. `Widget.render`. Carries an
  // `#n` suffix when siblings collide (overloads, repeated headings).
  readonly qualifiedName: string
  readonly range: EntityRange
  // Hash of the node-type skeleton with identifier text and trivia dropped --
  // equal hashes mean structurally identical bodies, which is what lets a
  // rename be told apart from a rewrite.
  readonly structuralHash: string
  // Hash of the entity's normalized source. Distinguishes modified from
  // untouched once identity is already established.
  readonly contentHash: string
  // As above, minus anything nested that is itself an entity. A class whose only
  // change is one method's body keeps its own hash, so the change is reported
  // against the method alone.
  readonly ownContentHash: string
  readonly tokens: readonly string[]
}

export interface EntityChange {
  readonly type: EntityChangeType
  readonly kind: EntityKind
  readonly name: string
  readonly qualifiedName: string
  readonly previousQualifiedName?: string
  readonly oldRange?: EntityRange
  readonly newRange?: EntityRange
  // Only present on fuzzy renames -- the token overlap that justified the match.
  readonly similarity?: number
}

export interface EntityDiffSummary {
  readonly added: number
  readonly deleted: number
  readonly modified: number
  readonly moved: number
  readonly renamed: number
}

export interface EntityDiff {
  readonly path: string
  readonly language: string | null
  readonly changes: readonly EntityChange[]
  readonly summary: EntityDiffSummary
}

export interface ResolveEntityNameParams {
  node: SyntaxNode
  source: string
}

export interface EntitySpec {
  readonly kind: EntityKind
  // Narrows `kind` per occurrence, for node types that serve double duty -- a
  // `const` binding is a function when it holds one and a constant otherwise.
  readonly resolveKind?: (params: ResolveEntityNameParams) => EntityKind | undefined
  // `top-level` drops the entity when it sits inside a function body, which is
  // what keeps local variables out of the symbol list.
  readonly scope?: 'top-level'
  // Direct-child node types holding the name, in priority order. Each entry may
  // be a `>`-separated path (`FunctionDeclarator>Identifier`).
  readonly name?: readonly string[]
  // Search the whole subtree for `name` rather than direct children, stopping
  // before bodies. Needed where declarators nest arbitrarily (C++).
  readonly deep?: boolean
  // Contributes its own name to the qualified path of entities nested inside it.
  readonly container?: boolean
  // Escape hatch for grammars whose name is not a node -- a CSS selector list,
  // a markdown heading's text.
  readonly resolveName?: (params: ResolveEntityNameParams) => string | undefined
  // Skip the node unless this returns true. Lets one node type serve two roles
  // (a `const` binding is only a function when its initializer is one).
  readonly accept?: (params: ResolveEntityNameParams) => boolean
}

// Attached to node types via `parser.configure({props})`, which every Lezer
// parser supports. Because the prop rides on the node type rather than a lookup
// table keyed by name, mixed-language trees (JS in HTML, CSS in a template)
// resolve correctly with no extra bookkeeping in the walker.
export const entityProp = new NodeProp<EntitySpec>({perNode: false})
