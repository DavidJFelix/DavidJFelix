import type {SyntaxNode} from '@lezer/common'

// Node types whose contents are noise for identity purposes: a reworded comment
// should never make a function look renamed or rewritten.
const TRIVIA_PATTERN = /Comment/u
const WHITE_SPACE_PATTERN = /\s+/u
// Ends the children of a node in the skeleton, so nesting is part of the shape.
const CLOSE_MARKER = ')'

export interface EntitySignature {
  readonly structuralHash: string
  readonly contentHash: string
  readonly ownContentHash: string
  readonly tokens: readonly string[]
}

// FNV-1a, 32-bit. Not cryptographic and not collision-proof -- a collision costs
// at worst one mislabeled rename, which is why the matcher confirms candidates
// by kind before trusting a hash.
export function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ (value.codePointAt(index) ?? 0), 0x01000193)
  }
  // Math.imul yields a signed 32-bit result; fold it back into the unsigned
  // range so the hex form is fixed-width and never carries a sign.
  return (hash < 0 ? hash + 2 ** 32 : hash).toString(16).padStart(8, '0')
}

export interface ComputeSignatureParams {
  // Walked in order as one entity: the leading nodes (decorators), then the
  // node.
  nodes: readonly SyntaxNode[]
  source: string
  // True for a descendant that was itself reported as an entity. Its content is
  // excluded from `ownContentHash`, so a class is not called modified merely
  // because one of its methods was.
  isNestedEntity: (node: SyntaxNode) => boolean
}

// One walk yields every hash the matcher needs:
//   - structural: node-type skeleton only, with a close marker after the
//     children of each node, so identifier text and formatting drop out, a pure
//     rename hashes identically, and a node that moves out of its parent does
//     not.
//   - content: the token text across the whole subtree plus the skeleton, so
//     formatting drops out but a changed string literal or a changed nesting
//     does not. The tokens are the leaf text and the text that a node holds
//     between its children (an escaped string, a template literal, a CSS
//     length), split on white space.
//   - own content: the same, minus nested entities -- what separates "this
//     entity changed" from "something declared inside it did".
export function computeSignature({
  nodes,
  source,
  isNestedEntity,
}: ComputeSignatureParams): EntitySignature {
  const types: string[] = []
  const ownTypes: string[] = []
  const tokens: string[] = []
  const ownTokens: string[] = []

  const pushType = (type: string, nested: boolean): void => {
    types.push(type)
    if (!nested) {
      ownTypes.push(type)
    }
  }
  const pushText = (text: string, nested: boolean): void => {
    for (const token of text.split(WHITE_SPACE_PATTERN)) {
      if (token !== '') {
        tokens.push(token)
        if (!nested) {
          ownTokens.push(token)
        }
      }
    }
  }

  const walk = (current: SyntaxNode, nested: boolean): void => {
    if (TRIVIA_PATTERN.test(current.type.name)) {
      return
    }
    pushType(current.type.name, nested)
    if (current.firstChild === null) {
      const text = source.slice(current.from, current.to)
      tokens.push(text)
      if (!nested) {
        ownTokens.push(text)
      }
      return
    }
    let cursor = current.from
    for (
      let child: SyntaxNode | null = current.firstChild;
      child !== null;
      child = child.nextSibling
    ) {
      pushText(source.slice(cursor, child.from), nested)
      walk(child, nested || isNestedEntity(child))
      cursor = child.to
    }
    pushText(source.slice(cursor, current.to), nested)
    pushType(CLOSE_MARKER, nested)
  }
  for (const node of nodes) {
    walk(node, false)
  }

  return {
    structuralHash: hashString(types.join(' ')),
    contentHash: hashString(`${tokens.join(' ')}\0${types.join(' ')}`),
    ownContentHash: hashString(`${ownTokens.join(' ')}\0${ownTypes.join(' ')}`),
    tokens,
  }
}

// Sørensen-Dice over token multisets, which is what makes a mostly-rewritten
// body score low while a renamed-but-intact one scores near 1.
export function tokenSimilarity(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 1
  }
  if (left.length === 0 || right.length === 0) {
    return 0
  }

  const remaining = new Map<string, number>()
  for (const token of left) {
    remaining.set(token, (remaining.get(token) ?? 0) + 1)
  }

  let shared = 0
  for (const token of right) {
    const available = remaining.get(token) ?? 0
    if (available > 0) {
      remaining.set(token, available - 1)
      shared += 1
    }
  }

  return (2 * shared) / (left.length + right.length)
}
