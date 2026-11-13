import type {CodeEntity, EntityChange, EntityKind, EntitySpan, SequenceDetail} from './entity'
import {hashString, tokenSimilarity} from './entity-signature'
import {alignByHash, diffSequenceElements} from './sequence-alignment'

// Below this token overlap a pair is two different entities that happen to look
// alike, not a rename. Matches sem's stated threshold.
const RENAME_SIMILARITY_THRESHOLD = 0.8

// The fuzzy phase is quadratic, so it is skipped on files that churn wholesale.
// Such a diff is a rewrite; naming which function became which adds nothing.
const MAX_FUZZY_CANDIDATES = 200

// A nested entity holds the tokens of each entity inside it, so the entity count
// alone does not keep the phase fast. Two 11 KB files of 200 nested namespaces
// need 624 million reads, and a renamed 92 KB class with 150 edited methods needs
// 7.7 million.
const MAX_FUZZY_TOKEN_READS = 20_000_000

// Sums of likeness scores that differ by less than this are equal. Without it,
// rounding in a different order of additions could break a tie the wrong way.
const LIKENESS_TIE_TOLERANCE = 1e-9

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
//   2. same structural hash and same body -- a rename or move, proven by an
//      identical body
//   3. token overlap over 0.8 -- a probable rename, body edited in place
// When phase 2 or 3 pairs two entities whose paths differ, the members inside
// them pair by identity under the new path, see `matchMembers`.
// Whatever is unclaimed at the end is genuinely added or deleted -- minus rows
// that sit inside an element the sequence diff already reported, which would be
// the same fact restated.
export function matchEntities({oldEntities, newEntities}: MatchEntitiesParams): EntityChange[] {
  const changes: EntityChange[] = []
  const unmatchedOld = new Set(oldEntities)
  const unmatchedNew = new Set(newEntities)
  const covered: CoveredSpans = {inserted: [], deleted: []}
  const phase: RenamePhase = {
    unmatchedOld,
    unmatchedNew,
    changes,
    covered,
    renames: [],
    released: new Set(),
  }

  matchByIdentity({unmatchedOld, unmatchedNew, changes, covered})
  suppressCoveredRows({unmatchedOld, unmatchedNew, covered})
  matchByStructure(phase)
  matchByTokens(phase)

  for (const pair of phase.renames) {
    if (!phase.released.has(pair)) {
      changes.push(pair.change)
    }
  }

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
  // The path that groups an old entity. A member of a renamed container
  // groups under the path that it has after the rename.
  oldPath?: (entity: CodeEntity) => string
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
  oldPath = (entity) => entity.basePath,
}: IdentityPhaseParams): void {
  const groups = new Map<string, {old: CodeEntity[]; new: CodeEntity[]}>()
  for (const entity of unmatchedOld) {
    getGroup(groups, baseKey({kind: entity.kind, path: oldPath(entity)})).old.push(entity)
  }
  for (const entity of unmatchedNew) {
    getGroup(groups, baseKey({kind: entity.kind, path: entity.basePath})).new.push(entity)
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
    // so equal leftover counts zip in order. Unequal counts pair by likeness,
    // see `pairLeftovers`. Whatever stays unpaired is genuinely added or deleted
    // and falls through to the rename phases. Occurrences inside an element
    // already reported inserted or deleted stay out of the pairing -- pairing
    // the keys of one deleted object with another inserted object's would
    // invent a modification neither had. Groups arrive in document order, so a
    // sequence owner runs before the entities inside its elements and `covered`
    // is populated by the time they pair.
    const restOld = group.old.filter(
      (entity, index) =>
        !pairedOld.has(index) &&
        !isCovered({span: entity.span, path: oldPath(entity), spans: covered.deleted}),
    )
    const restNew = group.new.filter(
      (entity, index) =>
        !pairedNew.has(index) &&
        !isCovered({span: entity.span, path: entity.basePath, spans: covered.inserted}),
    )
    for (const [previous, candidate] of pairLeftovers({restOld, restNew})) {
      unmatchedOld.delete(previous)
      unmatchedNew.delete(candidate)
      const detail = diffSequence({previous, candidate, covered})
      if (previous.ownContentHash !== candidate.ownContentHash || detail !== undefined) {
        changes.push(createChange({type: 'modified', previous, candidate, detail}))
      }
    }
  }
}

interface PairLeftoversParams {
  restOld: readonly CodeEntity[]
  restNew: readonly CodeEntity[]
}

// Each entry of the shorter side pairs in order. The longer side skips the
// entries that give the lowest total likeness, so a deleted sibling next to an
// edited one does not take the edit. Likeness reads the words inside each
// token: a YAML or JSON scalar such as `bun run lint` is one token, and two
// steps that differ only inside their scalars would tie. A tie skips the later
// entry, which keeps the order of a plain zip. Over the read budget, the
// pairing is a plain zip.
function pairLeftovers({restOld, restNew}: PairLeftoversParams): Array<[CodeEntity, CodeEntity]> {
  const oldIsShort = restOld.length <= restNew.length
  const short = oldIsShort ? restOld : restNew
  const long = oldIsShort ? restNew : restOld
  const toPair = (shortIndex: number, longIndex: number): [CodeEntity, CodeEntity] =>
    oldIsShort ? [short[shortIndex], long[longIndex]] : [long[longIndex], short[shortIndex]]

  const zip = (): Array<[CodeEntity, CodeEntity]> => short.map((_, index) => toPair(index, index))
  if (short.length === long.length) {
    return zip()
  }
  const shortWords = short.map(entityWords)
  const longWords = long.map(entityWords)
  const reads = long.length * countWords(shortWords) + short.length * countWords(longWords)
  if (reads > MAX_FUZZY_TOKEN_READS) {
    return zip()
  }

  // best[i][j]: the highest total likeness when the first i short entries pair
  // inside the first j long entries. Row i only needs the columns that leave
  // enough long entries for the short entries after it.
  const slack = long.length - short.length
  const best = Array.from({length: short.length + 1}, () =>
    new Float64Array(long.length + 1).fill(Number.NEGATIVE_INFINITY),
  )
  best[0].fill(0)
  for (let i = 1; i <= short.length; i += 1) {
    for (let j = i; j <= i + slack; j += 1) {
      const take = best[i - 1][j - 1] + tokenSimilarity(shortWords[i - 1], longWords[j - 1])
      best[i][j] = Math.max(best[i][j - 1], take)
    }
  }

  const pairs: Array<[CodeEntity, CodeEntity]> = []
  let j = long.length
  for (let i = short.length; i > 0; j -= 1) {
    if (best[i][j - 1] < best[i][j] - LIKENESS_TIE_TOLERANCE) {
      pairs.push(toPair(i - 1, j - 1))
      i -= 1
    }
  }
  return pairs.toReversed()
}

function entityWords(entity: CodeEntity): string[] {
  return entity.tokens.flatMap((token) => token.split(/\s+/).filter((word) => word !== ''))
}

function countWords(lists: readonly (readonly string[])[]): number {
  return lists.reduce((total, words) => total + words.length, 0)
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
  const ownerBase = candidate.basePath
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
    if (isCovered({span: entity.span, path: entity.basePath, spans: covered.inserted})) {
      unmatchedNew.delete(entity)
    }
  }
  for (const entity of unmatchedOld) {
    if (isCovered({span: entity.span, path: entity.basePath, spans: covered.deleted})) {
      unmatchedOld.delete(entity)
    }
  }
}

interface IsCoveredParams {
  span: EntitySpan
  path: string
  spans: readonly OwnedSpan[]
}

function isCovered({span, path, spans}: IsCoveredParams): boolean {
  return spans.some(
    (owned) =>
      span.from >= owned.span.from &&
      span.to <= owned.span.to &&
      path.startsWith(`${owned.ownerBase}.`),
  )
}

// A pair that phase 2 or 3 made. Its row is added at the end, because a
// renamed container that pairs later can release the pair of a member.
interface RenamePair {
  previous: CodeEntity
  candidate: CodeEntity
  change: EntityChange
}

interface RenamePhase {
  unmatchedOld: Set<CodeEntity>
  unmatchedNew: Set<CodeEntity>
  changes: EntityChange[]
  covered: CoveredSpans
  renames: RenamePair[]
  released: Set<RenamePair>
}

interface RecordRenameParams {
  phase: RenamePhase
  pair: RenamePair
}

function recordRename({phase, pair}: RecordRenameParams): void {
  phase.unmatchedOld.delete(pair.previous)
  phase.unmatchedNew.delete(pair.candidate)
  phase.renames.push(pair)
  if (pair.previous.basePath !== pair.candidate.basePath) {
    matchMembers({phase, container: pair})
  }
}

interface MatchMembersParams {
  phase: RenamePhase
  container: RenamePair
}

// The members of a renamed container moved with it. Without this step, each
// member that did not change reports a `moved` row. The members pair by
// identity, with the old path prefix changed to the new one, so an unchanged
// member reports nothing and an edited member reports `modified`. A member
// pair made before its container paired is released and pairs again here. A
// member is inside the span of its container and under its
// path, so a Rust `struct Foo` and its `impl Foo` keep their own members.
function matchMembers({phase, container}: MatchMembersParams): void {
  const {previous, candidate} = container
  const newPathOf = (entity: CodeEntity): string =>
    `${candidate.basePath}${entity.basePath.slice(previous.basePath.length)}`

  for (const pair of phase.renames) {
    if (
      !phase.released.has(pair) &&
      isMember({entity: pair.previous, container: previous}) &&
      isMember({entity: pair.candidate, container: candidate}) &&
      newPathOf(pair.previous) === pair.candidate.basePath
    ) {
      phase.released.add(pair)
      phase.unmatchedOld.add(pair.previous)
      phase.unmatchedNew.add(pair.candidate)
    }
  }

  const oldMembers = [...phase.unmatchedOld].filter((entity) =>
    isMember({entity, container: previous}),
  )
  const newMembers = [...phase.unmatchedNew].filter((entity) =>
    isMember({entity, container: candidate}),
  )
  const unmatchedOld = new Set(oldMembers)
  const unmatchedNew = new Set(newMembers)
  matchByIdentity({
    unmatchedOld,
    unmatchedNew,
    changes: phase.changes,
    covered: phase.covered,
    oldPath: newPathOf,
  })
  // A paired member leaves the sets. So does a member inside an element that
  // the sequence diff reported, as in `suppressCoveredRows`.
  for (const entity of oldMembers) {
    const covered = isCovered({
      span: entity.span,
      path: newPathOf(entity),
      spans: phase.covered.deleted,
    })
    if (!unmatchedOld.has(entity) || covered) {
      phase.unmatchedOld.delete(entity)
    }
  }
  for (const entity of newMembers) {
    const covered = isCovered({
      span: entity.span,
      path: entity.basePath,
      spans: phase.covered.inserted,
    })
    if (!unmatchedNew.has(entity) || covered) {
      phase.unmatchedNew.delete(entity)
    }
  }
}

interface IsMemberParams {
  entity: CodeEntity
  container: CodeEntity
}

function isMember({entity, container}: IsMemberParams): boolean {
  return (
    entity.span.from >= container.span.from &&
    entity.span.to <= container.span.to &&
    entity.basePath.startsWith(`${container.basePath}.`)
  )
}

// An identical body under a different name is the strongest rename signal there
// is, so this phase runs before any similarity scoring. The same shape alone is
// not enough: two unrelated rules or keys often share one.
function matchByStructure(phase: RenamePhase): void {
  const {unmatchedOld, unmatchedNew} = phase
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

  // Safe to change while iterating: a `Set` skips an entry that is removed
  // before the loop gets to it. So the members that a renamed container
  // claims are not visited.
  for (const candidate of unmatchedNew) {
    if (candidate.tokens.length < MIN_STRUCTURAL_TOKENS) {
      continue
    }
    const bucket = byHash.get(candidate.structuralHash)
    const previous = bucket?.find(
      (entity) =>
        entity.kind === candidate.kind &&
        unmatchedOld.has(entity) &&
        bodyHash(entity) === bodyHash(candidate),
    )
    if (previous === undefined) {
      continue
    }
    const change = createChange({
      type: previous.name === candidate.name ? 'moved' : 'renamed',
      previous,
      candidate,
    })
    recordRename({phase, pair: {previous, candidate, change}})
  }
}

// Last resort: an entity that was renamed *and* edited. Each new entity takes
// its single best-scoring partner, so one old entity cannot be claimed twice.
function matchByTokens(phase: RenamePhase): void {
  const {unmatchedOld, unmatchedNew} = phase
  if (
    unmatchedOld.size > MAX_FUZZY_CANDIDATES ||
    unmatchedNew.size > MAX_FUZZY_CANDIDATES ||
    countWorstCaseFuzzyTokenReads({unmatchedOld, unmatchedNew}) > MAX_FUZZY_TOKEN_READS
  ) {
    return
  }

  // Same as above: the members that a renamed container claims are not visited.
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
    const change = createChange({
      type: best.name === candidate.name ? 'moved' : 'renamed',
      previous: best,
      candidate,
      similarity: Number(bestScore.toFixed(3)),
      bodyChanged: bodyHash(best) !== bodyHash(candidate),
    })
    recordRename({phase, pair: {previous: best, candidate, change}})
  }
}

interface CountWorstCaseFuzzyTokenReadsParams {
  unmatchedOld: ReadonlySet<CodeEntity>
  unmatchedNew: ReadonlySet<CodeEntity>
}

function countWorstCaseFuzzyTokenReads({
  unmatchedOld,
  unmatchedNew,
}: CountWorstCaseFuzzyTokenReadsParams): number {
  const oldTotals = totalTokensByKind(unmatchedOld)
  const newTotals = totalTokensByKind(unmatchedNew)
  let reads = 0
  for (const [kind, old] of oldTotals) {
    const next = newTotals.get(kind)
    if (next !== undefined) {
      reads += next.entities * old.tokens + old.entities * next.tokens
    }
  }
  return reads
}

interface TokenTotal {
  readonly entities: number
  readonly tokens: number
}

function totalTokensByKind(entities: ReadonlySet<CodeEntity>): Map<EntityKind, TokenTotal> {
  const totals = new Map<EntityKind, TokenTotal>()
  for (const entity of entities) {
    const total = totals.get(entity.kind) ?? {entities: 0, tokens: 0}
    totals.set(entity.kind, {
      entities: total.entities + 1,
      tokens: total.tokens + entity.tokens.length,
    })
  }
  return totals
}

interface CreateChangeParams {
  type: EntityChange['type']
  previous: CodeEntity
  candidate: CodeEntity
  similarity?: number
  bodyChanged?: boolean
  detail?: SequenceDetail
}

function createChange({
  type,
  previous,
  candidate,
  similarity,
  bodyChanged = false,
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
    ...(bodyChanged ? {bodyChanged} : {}),
    ...(detail === undefined ? {} : {detail}),
  }
}

// Entities are immutable, so the hash of each one is computed once.
const bodyHashes = new WeakMap<CodeEntity, string>()

// The hash of an entity's tokens without its own name: two bodies that hash
// alike differ only in the name.
function bodyHash(entity: CodeEntity): string {
  const cached = bodyHashes.get(entity)
  if (cached !== undefined) {
    return cached
  }
  const hash = hashString(withoutName(entity).join('\0'))
  bodyHashes.set(entity, hash)
  return hash
}

// A name is often more than one token (`.card` is `.` and `card`, `Fix #12` is
// `Fix` and `#12`), and a JSON key token keeps the quotes that its name drops.
// So a token that is the whole name is removed. If no token is, the first
// tokens, in order, that spell the name without its white space are removed.
function withoutName(entity: CodeEntity): readonly string[] {
  const name = compact(entity.name)
  const whole = entity.tokens.findIndex((token) => tokenForms(token).includes(name))
  if (whole !== -1) {
    return entity.tokens.toSpliced(whole, 1)
  }
  let spelled = 0
  return entity.tokens.filter((token) => {
    const form = tokenForms(token).find(
      (text) => text !== '' && spelled < name.length && name.startsWith(text, spelled),
    )
    if (form === undefined) {
      return true
    }
    spelled += form.length
    return false
  })
}

function tokenForms(token: string): readonly string[] {
  const text = compact(token)
  return [text, text.replaceAll(/^["']|["']$/gu, '')]
}

function compact(text: string): string {
  return text.replaceAll(/\s+/gu, '')
}

interface BaseKeyParams {
  kind: EntityKind
  path: string
}

// Kind is part of identity: replacing a `function` with a `class` of the same
// name is a rewrite, not a modification.
function baseKey({kind, path}: BaseKeyParams): string {
  return `${kind}\0${path}`
}
