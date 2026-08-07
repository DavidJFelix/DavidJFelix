import type {Parser, SyntaxNode} from '@lezer/common'

import type {CodeEntity, EntityKind, EntitySpan, EntitySpec, SequenceElement} from './entity'
import {anonymousScopeProp, entityProp} from './entity'
import {computeSignature} from './entity-signature'

// Fingerprinting is linear but not free; a generated array past this size gets
// no element fingerprints and its property falls back to a bare `modified`.
const MAX_SEQUENCE_ELEMENTS = 2000

// Sequence-edit previews are one-line labels, not content.
const PREVIEW_LENGTH = 48

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
  const entitySpans = found.map((entity) => ({from: entity.node.from, to: entity.node.to}))

  return found.map(({kind, name, qualifiedName, node}) => {
    const signature = computeSignature({node, source, isNestedEntity})
    const elements = fingerprintSequence({node, source, lineStarts, entitySpans})
    return {
      kind,
      name,
      qualifiedName,
      range: {startLine: lineAt(lineStarts, node.from), endLine: lineAt(lineStarts, node.to)},
      structuralHash: signature.structuralHash,
      contentHash: signature.contentHash,
      ownContentHash: signature.ownContentHash,
      tokens: signature.tokens,
      span: {from: node.from, to: node.to},
      ...(elements === undefined ? {} : {elements}),
    }
  })
}

interface FingerprintSequenceParams {
  node: SyntaxNode
  source: string
  lineStarts: readonly number[]
  entitySpans: readonly EntitySpan[]
}

// Fingerprints for the elements of a sequence-valued entity. Hashes use full
// content -- an element is matched across revisions as a whole, unlike entities,
// whose nested changes are attributed to the nested entity itself.
function fingerprintSequence({
  node,
  source,
  lineStarts,
  entitySpans,
}: FingerprintSequenceParams): readonly SequenceElement[] | undefined {
  const spec = node.type.prop(entityProp)
  const elements = spec?.resolveSequence?.({node, source})
  if (elements === undefined || elements.length > MAX_SEQUENCE_ELEMENTS) {
    return undefined
  }
  return elements.map((element) => ({
    hash: computeSignature({node: element, source, isNestedEntity: () => false}).contentHash,
    preview: createPreview(source.slice(element.from, element.to)),
    range: {startLine: lineAt(lineStarts, element.from), endLine: lineAt(lineStarts, element.to)},
    span: {from: element.from, to: element.to},
    hasEntities: entitySpans.some((span) => span.from >= element.from && span.to <= element.to),
  }))
}

function createPreview(text: string): string {
  const collapsed = text.replaceAll(/\s+/gu, ' ')
  return collapsed.length > PREVIEW_LENGTH
    ? `${collapsed.slice(0, PREVIEW_LENGTH - 3)}...`
    : collapsed
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
  // Anonymous callables (an arrow passed to `test`, a Go func literal) open an
  // executable scope without contributing an entity frame, so they get their
  // own depth counter.
  let anonymousScopes = 0

  tree.iterate({
    enter(ref) {
      if (ref.type.prop(anonymousScopeProp) === true) {
        anonymousScopes += 1
      }
      const spec = ref.type.prop(entityProp)
      if (spec === undefined) {
        return true
      }

      const node = ref.node
      if (spec.accept !== undefined && !spec.accept({node, source})) {
        return true
      }
      const insideExecutable =
        anonymousScopes > 0 || open.some((frame) => EXECUTABLE_KINDS.has(frame.kind))
      if (spec.scope === 'top-level' && insideExecutable) {
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
      if (ref.type.prop(anonymousScopeProp) === true) {
        anonymousScopes -= 1
      }
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
