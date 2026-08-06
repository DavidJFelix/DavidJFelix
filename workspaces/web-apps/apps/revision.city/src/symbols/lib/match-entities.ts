import type {CodeEntity, EntityChange} from './entity'
import {tokenSimilarity} from './entity-signature'

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
//   1. same qualified name + kind -- the entity is the same entity
//   2. same structural hash      -- a rename or move, proven by an identical body
//   3. token overlap over 0.8    -- a probable rename, body edited in place
// Whatever is unclaimed at the end is genuinely added or deleted.
export function matchEntities({oldEntities, newEntities}: MatchEntitiesParams): EntityChange[] {
  const changes: EntityChange[] = []
  const unmatchedOld = new Set(oldEntities)
  const unmatchedNew = new Set(newEntities)

  const oldByKey = new Map<string, CodeEntity>()
  for (const entity of oldEntities) {
    oldByKey.set(identityKey(entity), entity)
  }

  for (const candidate of newEntities) {
    const previous = oldByKey.get(identityKey(candidate))
    if (previous === undefined || !unmatchedOld.has(previous)) {
      continue
    }
    unmatchedOld.delete(previous)
    unmatchedNew.delete(candidate)
    // Own content, not full content: a container whose only change is a nested
    // entity is left out, because that entity reports the change itself.
    if (previous.ownContentHash !== candidate.ownContentHash) {
      changes.push(createChange({type: 'modified', previous, candidate}))
    }
  }

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
}

function createChange({type, previous, candidate, similarity}: CreateChangeParams): EntityChange {
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
  }
}

// Kind is part of identity: replacing a `function` with a `class` of the same
// name is a rewrite, not a modification.
function identityKey(entity: CodeEntity): string {
  return `${entity.kind}\0${entity.qualifiedName}`
}
