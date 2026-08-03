import type {SyntaxNode} from '@lezer/common'

// Node types whose contents are noise for identity purposes: a reworded comment
// should never make a function look renamed or rewritten.
const TRIVIA_PATTERN = /Comment/u

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
  node: SyntaxNode
  source: string
  // True for a descendant that was itself reported as an entity. Its content is
  // excluded from `ownContentHash`, so a class is not called modified merely
  // because one of its methods was.
  isNestedEntity: (node: SyntaxNode) => boolean
}

// One walk yields every hash the matcher needs:
//   - structural: node-type skeleton only, so identifier text and formatting
//     drop out and a pure rename hashes identically.
//   - content: leaf token text across the whole subtree, so formatting drops out
//     but a changed string literal does not.
//   - own content: the same, minus nested entities -- what separates "this
//     entity changed" from "something declared inside it did".
export function computeSignature({
  node,
  source,
  isNestedEntity,
}: ComputeSignatureParams): EntitySignature {
  const types: string[] = []
  const tokens: string[] = []
  const ownTokens: string[] = []

  const walk = (current: SyntaxNode, nested: boolean): void => {
    if (TRIVIA_PATTERN.test(current.type.name)) {
      return
    }
    types.push(current.type.name)
    if (current.firstChild === null) {
      const text = source.slice(current.from, current.to)
      tokens.push(text)
      if (!nested) {
        ownTokens.push(text)
      }
    }
    for (let child = current.firstChild; child !== null; child = child.nextSibling) {
      walk(child, nested || isNestedEntity(child))
    }
  }
  walk(node, false)

  return {
    structuralHash: hashString(types.join(' ')),
    contentHash: hashString(tokens.join(' ')),
    ownContentHash: hashString(ownTokens.join(' ')),
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
