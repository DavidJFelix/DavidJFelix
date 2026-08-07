import type {CodeEntity, EntityChange, EntitySpan, SequenceDetail} from './entity'
import {tokenSimilarity} from './entity-signature'
import {alignByHash, diffSequenceElements} from './sequence-alignment'

// Below this token overlap a pair is two different entities that happen to look
// alike, not a rename. Matches sem's stated threshold.
const RENAME_SIMILARITY_THRESHOLD = 0.8

// The fuzzy phase is quadratic, so it is skipped on files that churn wholesale.
// Such a diff is a rewrite; naming which function became which adds nothing.
const MAX_FUZZY_CANDIDATES = 200

// Short entities share a node skeleton with every other entity of their shape --
// every one-line getter hashes alike -- so structural matching is reserved for
// bodies with enough substance for the hash to mean something. Smaller ones fall
// through to token similarity, which compares the actual text.
const MIN_STRUCTURAL_TOKENS = 12

export interface MatchEntitiesParams {
  oldEntities: readonly CodeEntity[]
  newEntities: readonly CodeEntity[]
}

// Three phases, cheapest and most certain first, each removing its matches from
// the pool the next one sees:
//   1. occurrence alignment  -- entities grouped by kind + base path, occurrence
//      sequences aligned by content, so the entity is the same entity even when
//      an insertion shifted its ordinal
//   2. same structural hash  -- a rename or move, proven by an identical body
//   3. token overlap over 0.8 -- a probable rename, body edited in place
// Whatever is unclaimed at the end is genuinely added or deleted -- minus rows
// that sit inside an element the sequence diff already reported, which would be
// the same fact restated.
export function matchEntities({oldEntities, newEntities}: MatchEntitiesParams): EntityChange[] {
  const changes: EntityChange[] = []
  const unmatchedOld = new Set(oldEntities)
  const unmatchedNew = new Set(newEntities)
  const covered: CoveredSpans = {inserted: [], deleted: []}

  matchByIdentity({unmatchedOld, unmatchedNew, changes, covered})
  suppressCoveredRows({unmatchedOld, unmatchedNew, covered})
  matchByStructure({unmatchedOld, unmatchedNew, changes})
  matchByTokens({unmatchedOld, unmatchedNew, changes})

  for (const entity of unmatchedNew) {
    changes.push({
      type: 'added',
      kind: entity.kind,
      name: entity.name,
      qualifiedName: entity.qualifiedName,
      newRange: entity.range,
    })
  }
  for (const entity of unmatchedOld) {
    changes.push({
      type: 'deleted',
      kind: entity.kind,
      name: entity.name,
      qualifiedName: entity.qualifiedName,
      oldRange: entity.range,
    })
  }

  return changes
}

// Spans the sequence diff reported as whole-element insertions or deletions,
// tagged with the owning entity's base path so only descendants suppress.
interface OwnedSpan {
  ownerBase: string
  span: EntitySpan
}

interface CoveredSpans {
  inserted: OwnedSpan[]
  deleted: OwnedSpan[]
}

interface IdentityPhaseParams {
  unmatchedOld: Set<CodeEntity>
  unmatchedNew: Set<CodeEntity>
  changes: EntityChange[]
  covered: CoveredSpans
}

// The `#n` ordinal that disambiguates name collisions cannot be identity: one
// insertion shifts every later sibling's ordinal, and trusting it would cascade
// a single real change into a modified row per sibling. Occurrences that share
// a base path are instead aligned by content, like sem and difftastic align
// sibling sequences.
function matchByIdentity({
  unmatchedOld,
  unmatchedNew,
  changes,
  covered,
}: IdentityPhaseParams): void {
  const groups = new Map<string, {old: CodeEntity[]; new: CodeEntity[]}>()
  for (const entity of unmatchedOld) {
    getGroup(groups, baseKey(entity)).old.push(entity)
  }
  for (const entity of unmatchedNew) {
    getGroup(groups, baseKey(entity)).new.push(entity)
  }

  for (const group of groups.values()) {
    // Content-identical occurrences pair first, preserving order: however far
    // an insertion shifted one, it is the same entity and reports nothing.
    const matched = alignByHash(
      group.old.map((entity) => entity.contentHash),
      group.new.map((entity) => entity.contentHash),
    )
    const pairedOld = new Set(matched.map(([old]) => old))
    const pairedNew = new Set(matched.map(([, next]) => next))
    for (const [old, next] of matched) {
      unmatchedOld.delete(group.old[old])
      unmatchedNew.delete(group.new[next])
    }

    // Occurrences edited in place keep their position among unedited siblings,
    // so the leftovers zip in order. Whatever the zip cannot pair is genuinely
    // added or deleted and falls through to the rename phases. Occurrences
    // inside an element already reported inserted or deleted stay out of the
    // zip -- pairing the keys of one deleted object with another inserted
    // object's would invent a modification neither had. Groups arrive in
    // document order, so a sequence owner runs before the entities inside its
    // elements and `covered` is populated by the time they zip.
    const restOld = group.old.filter(
      (entity, index) => !pairedOld.has(index) && !isCovered(entity, covered.deleted),
    )
    const restNew = group.new.filter(
      (entity, index) => !pairedNew.has(index) && !isCovered(entity, covered.inserted),
    )
    const zipped = Math.min(restOld.length, restNew.length)
    for (let index = 0; index < zipped; index += 1) {
      const previous = restOld[index]
      const candidate = restNew[index]
      unmatchedOld.delete(previous)
      unmatchedNew.delete(candidate)
      const detail = diffSequence({previous, candidate, covered})
      if (previous.ownContentHash !== candidate.ownContentHash || detail !== undefined) {
        changes.push(createChange({type: 'modified', previous, candidate, detail}))
      }
    }
  }
}

function getGroup(
  groups: Map<string, {old: CodeEntity[]; new: CodeEntity[]}>,
  key: string,
): {old: CodeEntity[]; new: CodeEntity[]} {
  const existing = groups.get(key)
  if (existing !== undefined) {
    return existing
  }
  const created = {old: [], new: []}
  groups.set(key, created)
  return created
}

interface DiffSequenceParams {
  previous: CodeEntity
  candidate: CodeEntity
  covered: CoveredSpans
}

// Runs the element-level diff on a sequence-valued pair and records the spans
// of whole-element insertions and deletions, which later suppress the entity
// rows inside them.
function diffSequence({
  previous,
  candidate,
  covered,
}: DiffSequenceParams): SequenceDetail | undefined {
  if (previous.elements === undefined || candidate.elements === undefined) {
    return undefined
  }
  const result = diffSequenceElements({before: previous.elements, after: candidate.elements})
  if (result === undefined) {
    return undefined
  }
  const ownerBase = basePath(candidate)
  for (const element of result.deletedElements) {
    covered.deleted.push({ownerBase, span: element.span})
  }
  for (const element of result.insertedElements) {
    covered.inserted.push({ownerBase, span: element.span})
  }
  return result.detail
}

interface SuppressPhaseParams {
  unmatchedOld: Set<CodeEntity>
  unmatchedNew: Set<CodeEntity>
  covered: CoveredSpans
}

// Runs before the rename phases so an entity inside a deleted element cannot be
// fuzzily paired with something unrelated across the file.
// Safe to mutate while iterating: the only element removed from each set is the
// one currently being visited.
function suppressCoveredRows({unmatchedOld, unmatchedNew, covered}: SuppressPhaseParams): void {
  for (const entity of unmatchedNew) {
    if (isCovered(entity, covered.inserted)) {
      unmatchedNew.delete(entity)
    }
  }
  for (const entity of unmatchedOld) {
    if (isCovered(entity, covered.deleted)) {
      unmatchedOld.delete(entity)
    }
  }
}

function isCovered(entity: CodeEntity, spans: readonly OwnedSpan[]): boolean {
  return spans.some(
    ({ownerBase, span}) =>
      entity.span.from >= span.from &&
      entity.span.to <= span.to &&
      basePath(entity).startsWith(`${ownerBase}.`),
  )
}

interface MatchPhaseParams {
  unmatchedOld: Set<CodeEntity>
  unmatchedNew: Set<CodeEntity>
  changes: EntityChange[]
}

// An identical body under a different name is the strongest rename signal there
// is, so this phase runs before any similarity scoring.
function matchByStructure({unmatchedOld, unmatchedNew, changes}: MatchPhaseParams): void {
  const byHash = new Map<string, CodeEntity[]>()
  for (const entity of unmatchedOld) {
    if (entity.tokens.length < MIN_STRUCTURAL_TOKENS) {
      continue
    }
    const bucket = byHash.get(entity.structuralHash)
    if (bucket === undefined) {
      byHash.set(entity.structuralHash, [entity])
    } else {
      bucket.push(entity)
    }
  }

  // Safe to mutate while iterating: the only element removed from this set is
  // the one currently being visited.
  for (const candidate of unmatchedNew) {
    if (candidate.tokens.length < MIN_STRUCTURAL_TOKENS) {
      continue
    }
    const bucket = byHash.get(candidate.structuralHash)
    const previous = bucket?.find(
      (entity) => entity.kind === candidate.kind && unmatchedOld.has(entity),
    )
    if (previous === undefined) {
      continue
    }
    unmatchedOld.delete(previous)
    unmatchedNew.delete(candidate)
    changes.push(
      createChange({
        type: previous.name === candidate.name ? 'moved' : 'renamed',
        previous,
        candidate,
      }),
    )
  }
}

// Last resort: an entity that was renamed *and* edited. Each new entity takes
// its single best-scoring partner, so one old entity cannot be claimed twice.
function matchByTokens({unmatchedOld, unmatchedNew, changes}: MatchPhaseParams): void {
  if (unmatchedOld.size > MAX_FUZZY_CANDIDATES || unmatchedNew.size > MAX_FUZZY_CANDIDATES) {
    return
  }

  // Same as above: only the visited element is removed mid-iteration.
  for (const candidate of unmatchedNew) {
    let best: CodeEntity | undefined
    let bestScore = RENAME_SIMILARITY_THRESHOLD

    for (const previous of unmatchedOld) {
      if (previous.kind !== candidate.kind) {
        continue
      }
      const score = tokenSimilarity(previous.tokens, candidate.tokens)
      if (score > bestScore) {
        best = previous
        bestScore = score
      }
    }

    if (best === undefined) {
      continue
    }
    unmatchedOld.delete(best)
    unmatchedNew.delete(candidate)
    changes.push(
      createChange({
        type: best.name === candidate.name ? 'moved' : 'renamed',
        previous: best,
        candidate,
        similarity: Number(bestScore.toFixed(3)),
      }),
    )
  }
}

interface CreateChangeParams {
  type: EntityChange['type']
  previous: CodeEntity
  candidate: CodeEntity
  similarity?: number
  detail?: SequenceDetail
}

function createChange({
  type,
  previous,
  candidate,
  similarity,
  detail,
}: CreateChangeParams): EntityChange {
  return {
    type,
    kind: candidate.kind,
    name: candidate.name,
    qualifiedName: candidate.qualifiedName,
    ...(previous.qualifiedName === candidate.qualifiedName
      ? {}
      : {previousQualifiedName: previous.qualifiedName}),
    oldRange: previous.range,
    newRange: candidate.range,
    ...(similarity === undefined ? {} : {similarity}),
    ...(detail === undefined ? {} : {detail}),
  }
}

// Kind is part of identity: replacing a `function` with a `class` of the same
// name is a rewrite, not a modification.
function baseKey(entity: CodeEntity): string {
  return `${entity.kind}\0${basePath(entity)}`
}

// The qualified path with every `#n` ordinal dropped -- what siblings that
// collide on a name share.
function basePath(entity: CodeEntity): string {
  return entity.qualifiedName.replaceAll(/#\d+/gu, '')
}
