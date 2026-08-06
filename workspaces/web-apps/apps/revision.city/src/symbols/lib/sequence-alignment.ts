import type {SequenceDetail, SequenceEdit, SequenceElement} from './entity'

// The LCS table is quadratic over whatever survives the common head and tail
// strip. Churn past this bound is a rewrite of the sequence; per-element edits
// would be noise, so alignment falls back to reporting nothing element-wise.
const MAX_ALIGNMENT_CELLS = 250_000

// Order-preserving pairs of equal hashes: common ends by position, the middle
// by LCS. Past the size cap the middle stays unpaired rather than paying a
// multi-megabyte table inside a Worker request.
export function alignByHash(
  left: readonly string[],
  right: readonly string[],
): ReadonlyArray<readonly [number, number]> {
  const {prefix, leftEnd, rightEnd} = stripCommonEnds(left, right)
  const pairs: Array<readonly [number, number]> = []
  for (let index = 0; index < prefix; index += 1) {
    pairs.push([index, index])
  }
  const middleLeft = left.slice(prefix, leftEnd)
  const middleRight = right.slice(prefix, rightEnd)
  if (middleLeft.length * middleRight.length <= MAX_ALIGNMENT_CELLS) {
    for (const [old, next] of lcsPairs(middleLeft, middleRight)) {
      pairs.push([prefix + old, prefix + next])
    }
  }
  for (let offset = 0; leftEnd + offset < left.length; offset += 1) {
    pairs.push([leftEnd + offset, rightEnd + offset])
  }
  return pairs
}

export interface DiffSequenceElementsParams {
  before: readonly SequenceElement[]
  after: readonly SequenceElement[]
}

export interface SequenceElementsDiff {
  readonly detail: SequenceDetail
  // Whole elements the diff reported inserted or deleted -- the caller uses
  // their spans to suppress entity rows that would restate the same fact.
  readonly insertedElements: readonly SequenceElement[]
  readonly deletedElements: readonly SequenceElement[]
}

// Element-level diff of a sequence pair: LCS over element hashes, then the
// blocks between matches. Within a block leftovers zip in order -- the same
// replace heuristic line diffs use -- and whole-element extras become inserted
// or deleted edits. Undefined when the sequences match, or when every
// difference is an in-place pair owned by nested entities, whose rows carry
// the report.
export function diffSequenceElements({
  before,
  after,
}: DiffSequenceElementsParams): SequenceElementsDiff | undefined {
  const beforeHashes = before.map((element) => element.hash)
  const afterHashes = after.map((element) => element.hash)
  const {prefix, leftEnd, rightEnd} = stripCommonEnds(beforeHashes, afterHashes)
  if (prefix === before.length && prefix === after.length) {
    return undefined
  }

  const middleOld = beforeHashes.slice(prefix, leftEnd)
  const middleNew = afterHashes.slice(prefix, rightEnd)
  const detail = {lengthBefore: before.length, lengthAfter: after.length}
  if (middleOld.length * middleNew.length > MAX_ALIGNMENT_CELLS) {
    // Lengths still tell the reviewer the array churned wholesale.
    return {detail: {...detail, edits: []}, insertedElements: [], deletedElements: []}
  }

  const anchors = lcsPairs(middleOld, middleNew).map(
    ([old, next]) => [prefix + old, prefix + next] as const,
  )
  const edits: SequenceEdit[] = []
  const insertedElements: SequenceElement[] = []
  const deletedElements: SequenceElement[] = []
  let oldCursor = prefix
  let newCursor = prefix
  for (const [anchorOld, anchorNew] of [...anchors, [leftEnd, rightEnd] as const]) {
    const zipped = Math.min(anchorOld - oldCursor, anchorNew - newCursor)
    for (let offset = 0; offset < zipped; offset += 1) {
      const old = before[oldCursor + offset]
      const next = after[newCursor + offset]
      // An in-place edit to an element that carries entities is reported by
      // those entities' own rows; restating it as element churn would be the
      // same fact twice.
      if (old.hasEntities || next.hasEntities) {
        continue
      }
      edits.push(
        {type: 'deleted', index: oldCursor + offset, preview: old.preview, range: old.range},
        {type: 'inserted', index: newCursor + offset, preview: next.preview, range: next.range},
      )
    }
    for (let index = oldCursor + zipped; index < anchorOld; index += 1) {
      const element = before[index]
      edits.push({type: 'deleted', index, preview: element.preview, range: element.range})
      deletedElements.push(element)
    }
    for (let index = newCursor + zipped; index < anchorNew; index += 1) {
      const element = after[index]
      edits.push({type: 'inserted', index, preview: element.preview, range: element.range})
      insertedElements.push(element)
    }
    oldCursor = anchorOld + 1
    newCursor = anchorNew + 1
  }

  if (edits.length === 0) {
    return undefined
  }
  return {detail: {...detail, edits}, insertedElements, deletedElements}
}

interface CommonEnds {
  readonly prefix: number
  readonly leftEnd: number
  readonly rightEnd: number
}

// Identical head and tail runs pair by position without a table; the typical
// edit touches a few neighbors, which keeps the quadratic middle tiny.
function stripCommonEnds(left: readonly string[], right: readonly string[]): CommonEnds {
  let prefix = 0
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) {
    prefix += 1
  }
  let leftEnd = left.length
  let rightEnd = right.length
  while (leftEnd > prefix && rightEnd > prefix && left[leftEnd - 1] === right[rightEnd - 1]) {
    leftEnd -= 1
    rightEnd -= 1
  }
  return {prefix, leftEnd, rightEnd}
}

// Longest common subsequence over two hash sequences, returned as ascending
// index pairs. Standard dynamic-programming table; callers bound the sizes.
function lcsPairs(
  left: readonly string[],
  right: readonly string[],
): ReadonlyArray<readonly [number, number]> {
  const cols = right.length + 1
  const table = new Uint32Array((left.length + 1) * cols)
  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      table[row * cols + col] =
        left[row - 1] === right[col - 1]
          ? table[(row - 1) * cols + (col - 1)] + 1
          : Math.max(table[(row - 1) * cols + col], table[row * cols + (col - 1)])
    }
  }

  const pairs: Array<readonly [number, number]> = []
  let row = left.length
  let col = right.length
  while (row > 0 && col > 0) {
    if (left[row - 1] === right[col - 1]) {
      pairs.push([row - 1, col - 1])
      row -= 1
      col -= 1
    } else if (table[(row - 1) * cols + col] >= table[row * cols + (col - 1)]) {
      row -= 1
    } else {
      col -= 1
    }
  }
  return pairs.toReversed()
}
