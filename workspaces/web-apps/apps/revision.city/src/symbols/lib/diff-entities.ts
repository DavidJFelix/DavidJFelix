import type {EntityChange, EntityDiff, EntityDiffSummary} from './entity'
import {extractEntities} from './extract-entities'
import {detectLanguage} from './language-registry'
import {matchEntities} from './match-entities'

// A generated file (a lockfile, a bundled asset) can hold tens of thousands of
// nodes. Parsing is fine; reporting every one is not, so oversized files are
// reported as unsupported rather than silently truncated.
const MAX_ENTITIES_PER_FILE = 2000

// Report order: the buckets a reviewer scans first, and within a bucket the
// order the symbols appear in the new file.
const CHANGE_TYPE_ORDER: Record<EntityChange['type'], number> = {
  added: 0,
  modified: 1,
  renamed: 2,
  moved: 3,
  deleted: 4,
}

export interface DiffEntitiesParams {
  path: string
  oldSource: string
  newSource: string
}

// Entity-level diff of one file. Returns an empty change list (with the language
// still named) when the file parses but nothing semantic moved -- a formatting
// pass, or a change confined to statements inside a body.
export async function diffEntities({
  path,
  oldSource,
  newSource,
}: DiffEntitiesParams): Promise<EntityDiff> {
  const language = detectLanguage(path)
  if (language === undefined) {
    return {path, language: null, changes: [], summary: createSummary([])}
  }

  const parser = await language.loadParser()
  const oldEntities = extractEntities({source: oldSource, parser})
  const newEntities = extractEntities({source: newSource, parser})

  if (oldEntities.length > MAX_ENTITIES_PER_FILE || newEntities.length > MAX_ENTITIES_PER_FILE) {
    return {path, language: language.id, changes: [], summary: createSummary([])}
  }

  const changes = matchEntities({oldEntities, newEntities}).toSorted(compareChanges)
  return {path, language: language.id, changes, summary: createSummary(changes)}
}

function compareChanges(left: EntityChange, right: EntityChange): number {
  const byType = CHANGE_TYPE_ORDER[left.type] - CHANGE_TYPE_ORDER[right.type]
  if (byType !== 0) {
    return byType
  }
  const leftLine = left.newRange?.startLine ?? left.oldRange?.startLine ?? 0
  const rightLine = right.newRange?.startLine ?? right.oldRange?.startLine ?? 0
  return leftLine - rightLine
}

function createSummary(changes: readonly EntityChange[]): EntityDiffSummary {
  return {
    added: countOf(changes, 'added'),
    deleted: countOf(changes, 'deleted'),
    modified: countOf(changes, 'modified'),
    moved: countOf(changes, 'moved'),
    renamed: countOf(changes, 'renamed'),
  }
}

function countOf(changes: readonly EntityChange[], type: EntityChange['type']): number {
  return changes.filter((change) => change.type === type).length
}
