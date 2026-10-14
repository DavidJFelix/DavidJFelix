import type {EntityChange, EntityDiff, EntityDiffSummary} from './entity'
import {extractEntities} from './extract-entities'
import {detectLanguage} from './language-registry'
import {matchEntities} from './match-entities'

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

// Entity-level diff of one file. If no entity changed, for example after a
// formatting pass or a comment edit, the change list is empty and the language
// is still named. A side too large to extract also gives the empty list.
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
  const oldExtraction = extractEntities({source: oldSource, parser})
  const newExtraction = extractEntities({source: newSource, parser})

  if (oldExtraction.tooLarge || newExtraction.tooLarge) {
    return {path, language: language.id, changes: [], summary: createSummary([])}
  }

  const changes = matchEntities({
    oldEntities: oldExtraction.entities,
    newEntities: newExtraction.entities,
  }).toSorted(compareChanges)
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
