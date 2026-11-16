import type {Parser, SyntaxNode} from '@lezer/common'

import type {CodeSymbol, SequenceElement, SymbolKind, SymbolSpan, SymbolSpec} from './code-symbol'
import {anonymousScopeProp, symbolProp} from './code-symbol'
import {computeSignature} from './symbol-signature'

// A generated file, such as a lockfile or a bundled asset, can hold tens of
// thousands of symbols. Parsing it is fine; reporting each symbol is not.
const MAX_SYMBOLS_PER_FILE = 2000

// A signature reads all the text of its symbol, including each nested symbol.
// A qualified name repeats the names of its containers. This limit on the total
// length of symbol text and qualified names stops a small, deeply nested file
// from using hundreds of MB.
const MAX_SYMBOL_CHARACTERS_PER_FILE = 2_000_000

// Fingerprinting is linear but not free; a generated array past this size gets
// no element fingerprints and its property falls back to a bare `modified`.
const MAX_SEQUENCE_ELEMENTS = 2000

// The extractor keeps an object for each fingerprinted element and compares the
// element with each symbol. This limit stops a file of many arrays from using
// seconds of CPU and hundreds of MB.
const MAX_FINGERPRINTED_ELEMENTS_PER_FILE = 10_000

// Sequence-edit previews are one-line labels, not content.
const PREVIEW_LENGTH = 48

// Symbols whose bodies hold executable code. Anything declared inside one is a
// local, not part of the file's public shape.
const EXECUTABLE_KINDS = new Set<SymbolKind>(['constructor', 'function', 'method'])

// A deep name search must not wander into a symbol's body, where it would find
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

export interface ExtractSymbolsParams {
  source: string
  parser: Parser
}

export type SymbolExtraction =
  | {readonly tooLarge: true}
  | {readonly tooLarge: false; readonly symbols: readonly CodeSymbol[]}

// Walks a parsed tree once, emitting a symbol for every node whose type carries
// a `symbolProp`. Because the spec lives on the node type, a tree stitched from
// several grammars (script tags, template blocks) needs no special handling.
// For a file over a `_PER_FILE` limit, the result is `{tooLarge: true}`.
export function extractSymbols({source, parser}: ExtractSymbolsParams): SymbolExtraction {
  try {
    return extractFromTree({source, parser})
  } catch (error) {
    // The parser builds its tree with recursion, so input nested past a few
    // thousand levels can overflow the stack. That input counts as too large.
    if (error instanceof RangeError) {
      return {tooLarge: true}
    }
    throw error
  }
}

function extractFromTree({source, parser}: ExtractSymbolsParams): SymbolExtraction {
  const found = collectSymbolNodes({source, parser})
  if (found === undefined) {
    return {tooLarge: true}
  }
  const emitted = new Set(found.flatMap(ownedNodes).map((node) => nodeKey(node)))
  // Only nodes that survived `accept` and `scope` count as nested symbols --
  // a skipped local must still contribute to its enclosing function's content.
  const isNestedSymbol = (node: SyntaxNode): boolean => emitted.has(nodeKey(node))
  const lineStarts = createLineStarts(source)
  const symbolSpans = found.map(symbolSpan)

  const symbols = found.map(({node, leading, sequence, ...identity}) => {
    const span = symbolSpan({node, leading})
    const signature = computeSignature({nodes: [...leading, node], source, isNestedSymbol})
    const elements =
      sequence === undefined
        ? undefined
        : fingerprintSequence({sequence, source, lineStarts, symbolSpans})
    return {
      ...identity,
      range: {startLine: lineAt(lineStarts, span.from), endLine: lineAt(lineStarts, span.to)},
      structuralHash: signature.structuralHash,
      contentHash: signature.contentHash,
      ownContentHash: signature.ownContentHash,
      tokens: signature.tokens,
      span,
      ...(elements === undefined ? {} : {elements}),
    }
  })
  return {tooLarge: false, symbols}
}

// The nodes that an enclosing symbol does not count as its own: the symbol's
// node, its leading nodes, and a parent that wraps only these (a Python
// `DecoratedStatement`). So an added or changed decorator goes to the symbol
// that it decorates, not to the enclosing class.
function ownedNodes({node, leading}: FoundSymbol): readonly SyntaxNode[] {
  const span = symbolSpan({node, leading})
  const parent = node.parent
  const wrapper =
    leading.length > 0 && parent !== null && parent.from === span.from && parent.to === span.to
      ? [parent]
      : []
  return [...wrapper, ...leading, node]
}

// The span starts at the first leading node, so a decorated symbol starts at
// its first decorator.
function symbolSpan({node, leading}: Pick<FoundSymbol, 'node' | 'leading'>): SymbolSpan {
  return {from: leading[0]?.from ?? node.from, to: node.to}
}

interface FingerprintSequenceParams {
  sequence: readonly SyntaxNode[]
  source: string
  lineStarts: readonly number[]
  symbolSpans: readonly SymbolSpan[]
}

// Fingerprints for the elements of a sequence-valued symbol. Hashes use full
// content -- an element is matched across revisions as a whole, unlike symbols,
// whose nested changes are attributed to the nested symbol itself.
function fingerprintSequence({
  sequence,
  source,
  lineStarts,
  symbolSpans,
}: FingerprintSequenceParams): readonly SequenceElement[] {
  return sequence.map((element) => ({
    hash: computeSignature({nodes: [element], source, isNestedSymbol: () => false}).contentHash,
    preview: createPreview(source.slice(element.from, element.to)),
    range: {startLine: lineAt(lineStarts, element.from), endLine: lineAt(lineStarts, element.to)},
    span: {from: element.from, to: element.to},
    hasSymbols: symbolSpans.some((span) => span.from >= element.from && span.to <= element.to),
  }))
}

function createPreview(text: string): string {
  const collapsed = text.replaceAll(/\s+/gu, ' ')
  return collapsed.length > PREVIEW_LENGTH
    ? `${collapsed.slice(0, PREVIEW_LENGTH - 3)}...`
    : collapsed
}

interface FoundSymbol {
  readonly kind: SymbolKind
  readonly name: string
  readonly qualifiedName: string
  readonly basePath: string
  readonly occurrence: number
  readonly node: SyntaxNode
  readonly leading: readonly SyntaxNode[]
  readonly sequence?: readonly SyntaxNode[]
}

interface SymbolFrame {
  readonly name: string
  readonly kind: SymbolKind
  readonly from: number
  readonly to: number
  readonly container: boolean
}

function collectSymbolNodes({
  source,
  parser,
}: ExtractSymbolsParams): readonly FoundSymbol[] | undefined {
  const tree = parser.parse(source)
  const found: FoundSymbol[] = []
  const open: SymbolFrame[] = []
  const nameCounts = new Map<string, number>()
  // Anonymous callables (an arrow passed to `test`, a Go func literal) open an
  // executable scope without contributing a symbol frame, so they get their
  // own depth counter.
  let anonymousScopes = 0
  let symbolCharacters = 0
  let fingerprintedElements = 0
  let tooLarge = false

  tree.iterate({
    enter(ref) {
      if (tooLarge) {
        return false
      }
      if (ref.type.prop(anonymousScopeProp) === true) {
        anonymousScopes += 1
      }
      const spec = ref.type.prop(symbolProp)
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
      const owner = spec.resolveOwner?.({node, source})
      const segment = owner === undefined ? name : `${owner}.${name}`
      const basePath = joinPath(open, segment)
      const occurrence = countOccurrence({kind, path: basePath, counts: nameCounts})
      const qualifiedName = occurrence === 1 ? basePath : `${basePath}#${occurrence}`
      const leading = spec.leading?.({node, source}) ?? []
      const span = symbolSpan({node, leading})
      symbolCharacters += span.to - span.from + qualifiedName.length
      if (
        found.length === MAX_SYMBOLS_PER_FILE ||
        symbolCharacters > MAX_SYMBOL_CHARACTERS_PER_FILE
      ) {
        tooLarge = true
        return false
      }
      const elements = spec.resolveSequence?.({node, source})
      const sequence =
        elements === undefined || elements.length > MAX_SEQUENCE_ELEMENTS ? undefined : elements
      fingerprintedElements += sequence?.length ?? 0
      if (fingerprintedElements > MAX_FINGERPRINTED_ELEMENTS_PER_FILE) {
        tooLarge = true
        return false
      }
      found.push({kind, name, qualifiedName, basePath, occurrence, node, leading, sequence})
      open.push({
        name: segment,
        kind,
        from: node.from,
        to: node.to,
        container: spec.container === true,
      })
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

  return tooLarge ? undefined : found
}

// Type is part of the key because a wrapper and its child can share a span.
function nodeKey(node: SyntaxNode): string {
  return `${node.from}:${node.to}:${node.type.name}`
}

interface ResolveNameParams {
  node: SyntaxNode
  source: string
  spec: SymbolSpec
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
// anything declared inside the symbol.
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

function joinPath(open: readonly SymbolFrame[], name: string): string {
  const path = open.filter((frame) => frame.container).map((frame) => frame.name)
  return path.length === 0 ? name : `${path.join('.')}.${name}`
}

interface CountOccurrenceParams {
  kind: SymbolKind
  path: string
  counts: Map<string, number>
}

// Overloads and repeated markdown headings would otherwise share one display
// name. Counted per kind, because a Rust `struct Widget` and its `impl Widget`
// are separate symbols that legitimately share a name.
function countOccurrence({kind, path, counts}: CountOccurrenceParams): number {
  const key = `${kind}\0${path}`
  const occurrence = (counts.get(key) ?? 0) + 1
  counts.set(key, occurrence)
  return occurrence
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
