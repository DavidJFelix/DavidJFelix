import {insertCommentInLineOrder} from './insert-comment-in-line-order'
import {isNullish} from './nullish'
import type {
  DiffsCommentFileByItemId,
  DiffsSavedCommentEntry,
  DiffsSavedCommentEvent,
  DiffsSavedCommentItem,
} from './types'

export function upsertSavedCommentSidebarEntry(
  sections: readonly DiffsSavedCommentItem[],
  commentFileByItemId: DiffsCommentFileByItemId | null,
  entry: DiffsSavedCommentEvent,
): DiffsSavedCommentItem[] {
  const file = commentFileByItemId?.get(entry.itemId)
  if (isNullish(file)) {
    return [...sections]
  }

  const nextEntry: DiffsSavedCommentEntry = {
    author: entry.author,
    itemId: entry.itemId,
    key: entry.key,
    lineNumber: entry.lineNumber,
    lineType: entry.lineType,
    message: entry.message,
    range: entry.range,
    side: entry.side,
  }

  const nextSections = [...sections]
  let sectionIndex = -1
  for (let index = 0; index < nextSections.length; index++) {
    if (nextSections[index]?.itemId === entry.itemId) {
      sectionIndex = index
      break
    }
  }

  if (sectionIndex === -1) {
    const nextSection: DiffsSavedCommentItem = {
      comments: [nextEntry],
      fileOrder: file.fileOrder,
      itemId: entry.itemId,
      path: file.path,
    }

    let insertIndex = nextSections.length
    for (let index = 0; index < nextSections.length; index++) {
      const section = nextSections[index]
      if (!isNullish(section) && file.fileOrder < section.fileOrder) {
        insertIndex = index
        break
      }
    }

    nextSections.splice(insertIndex, 0, nextSection)
    return nextSections
  }

  const section = nextSections[sectionIndex]
  if (isNullish(section)) {
    return sections.slice()
  }

  nextSections[sectionIndex] = {
    ...section,
    comments: insertCommentInLineOrder(section.comments, nextEntry),
  }
  return nextSections
}
