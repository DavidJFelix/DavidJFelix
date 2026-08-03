import type {Parser, SyntaxNode} from '@lezer/common'

import type {CodeEntity, EntityKind, EntitySpec} from './entity'
import {entityProp} from './entity'
import {computeSignature} from './entity-signature'

// Entities whose bodies hold executable code. Anything declared inside one is a
// local, not part of the file's public shape.
const EXECUTABLE_KINDS = new Set<EntityKind>(['constructor', 'function', 'method'])

// A deep name search must not wander into an entity's body, where it would find
// local variables instead of the declarator it was aiming for.
const BODY_NODE_TYPES = new Set([
  'Block',
  'Body',
  'ClassBody',
  'CompoundStatement',
  'ConstructorBody',
  'DeclarationList',
  'EnumBody',
  'FieldDeclarationList',
  'InterfaceBody',
])

export interface ExtractEntitiesParams {
  source: string
  parser: Parser
}

// Walks a parsed tree once, emitting an entity for every node whose type carries
// an `entityProp`. Because the spec lives on the node type, a tree stitched from
// several grammars (script tags, template blocks) needs no special handling.
export function extractEntities({source, parser}: ExtractEntitiesParams): readonly CodeEntity[] {
  const found = collectEntityNodes({source, parser})
  const emitted = new Set(found.map((entity) => nodeKey(entity.node)))
  // Only nodes that survived `accept` and `scope` count as nested entities --
  // a skipped local must still contribute to its enclosing function's content.
  const isNestedEntity = (node: SyntaxNode): boolean => emitted.has(nodeKey(node))
  const lineStarts = createLineStarts(source)

  return found.map(({kind, name, qualifiedName, node}) => {
    const signature = computeSignature({node, source, isNestedEntity})
    return {
      kind,
      name,
      qualifiedName,
      range: {startLine: lineAt(lineStarts, node.from), endLine: lineAt(lineStarts, node.to)},
      structuralHash: signature.structuralHash,
      contentHash: signature.contentHash,
      ownContentHash: signature.ownContentHash,
      tokens: signature.tokens,
    }
  })
}

interface FoundEntity {
  readonly kind: EntityKind
  readonly name: string
  readonly qualifiedName: string
  readonly node: SyntaxNode
}

interface EntityFrame {
  readonly name: string
  readonly kind: EntityKind
  readonly from: number
  readonly to: number
  readonly container: boolean
}

function collectEntityNodes({source, parser}: ExtractEntitiesParams): readonly FoundEntity[] {
  const tree = parser.parse(source)
  const found: FoundEntity[] = []
  const open: EntityFrame[] = []
  const nameCounts = new Map<string, number>()

  tree.iterate({
    enter(ref) {
      const spec = ref.type.prop(entityProp)
      if (spec === undefined) {
        return true
      }

      const node = ref.node
      if (spec.accept !== undefined && !spec.accept({node, source})) {
        return true
      }
      if (spec.scope === 'top-level' && open.some((frame) => EXECUTABLE_KINDS.has(frame.kind))) {
        return true
      }

      const name = resolveName({node, source, spec})
      if (name === undefined || name === '') {
        return true
      }

      const kind = spec.resolveKind?.({node, source}) ?? spec.kind
      found.push({
        kind,
        name,
        qualifiedName: disambiguate({kind, path: joinPath(open, name), counts: nameCounts}),
        node,
      })
      open.push({name, kind, from: node.from, to: node.to, container: spec.container === true})
      return true
    },
    leave(ref) {
      const top = open.at(-1)
      if (top !== undefined && top.from === ref.from && top.to === ref.to) {
        open.pop()
      }
    },
  })

  return found
}

// Type is part of the key because a wrapper and its child can share a span.
function nodeKey(node: SyntaxNode): string {
  return `${node.from}:${node.to}:${node.type.name}`
}

interface ResolveNameParams {
  node: SyntaxNode
  source: string
  spec: EntitySpec
}

function resolveName({node, source, spec}: ResolveNameParams): string | undefined {
  if (spec.resolveName !== undefined) {
    return spec.resolveName({node, source})
  }
  if (spec.name === undefined) {
    return undefined
  }

  for (const selector of spec.name) {
    const found =
      spec.deep === true ? findDescendant(node, selector) : findChildByPath(node, selector)
    if (found !== null) {
      return source.slice(found.from, found.to)
    }
  }
  return undefined
}

// Follows a `Parent>Child` path through direct children only.
function findChildByPath(node: SyntaxNode, selector: string): SyntaxNode | null {
  let current: SyntaxNode | null = node
  for (const step of selector.split('>')) {
    current = current.getChild(step)
    if (current === null) {
      return null
    }
  }
  return current
}

// First match in document order, skipping bodies so a declarator wins over
// anything declared inside the entity.
function findDescendant(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.type.name === type) {
      return child
    }
    if (BODY_NODE_TYPES.has(child.type.name)) {
      continue
    }
    const nested = findDescendant(child, type)
    if (nested !== null) {
      return nested
    }
  }
  return null
}

function joinPath(open: readonly EntityFrame[], name: string): string {
  const path = open.filter((frame) => frame.container).map((frame) => frame.name)
  return path.length === 0 ? name : `${path.join('.')}.${name}`
}

interface DisambiguateParams {
  kind: EntityKind
  path: string
  counts: Map<string, number>
}

// Overloads and repeated markdown headings would otherwise share a key and match
// each other arbitrarily. Counted per kind, because a Rust `struct Widget` and
// its `impl Widget` are separate entities that legitimately share a name.
function disambiguate({kind, path, counts}: DisambiguateParams): string {
  const key = `${kind}\0${path}`
  const seen = counts.get(key) ?? 0
  counts.set(key, seen + 1)
  return seen === 0 ? path : `${path}#${seen + 1}`
}

function createLineStarts(source: string): readonly number[] {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source.codePointAt(index) === 10) {
      starts.push(index + 1)
    }
  }
  return starts
}

// Binary search for the 1-based line containing `offset`.
function lineAt(lineStarts: readonly number[], offset: number): number {
  let low = 0
  let high = lineStarts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (lineStarts[mid] <= offset) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return low + 1
}
