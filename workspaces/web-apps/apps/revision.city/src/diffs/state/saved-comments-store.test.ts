import {expect, test} from 'vitest'

import type {DiffsCommentFileByItemId, DiffsSavedCommentEvent} from '@/diffs/lib/types'
import {type SavedCommentsStore, savedCommentsLogic} from './saved-comments-store'

const files: DiffsCommentFileByItemId = new Map([
  ['file-a', {fileOrder: 0, path: 'a.ts'}],
  ['file-b', {fileOrder: 1, path: 'b.ts'}],
])

const noFiles: DiffsCommentFileByItemId = new Map()

function comment(itemId: string, key: string, lineNumber: number): DiffsSavedCommentEvent {
  return {
    author: 'ada',
    itemId,
    key,
    lineNumber,
    lineType: 'change',
    message: 'LGTM',
    range: {start: lineNumber, end: lineNumber},
    side: 'additions',
  }
}

function listedKeys(store: SavedCommentsStore) {
  return store
    .getSnapshot()
    .context.sections.map(({comments, path}) => ({keys: comments.map(({key}) => key), path}))
}

test('a new list has no comments', () => {
  expect(savedCommentsLogic.createStore().getSnapshot().context).toEqual({sections: []})
})

test('saved comments group by file in file order, and by line inside a file', () => {
  const store = savedCommentsLogic.createStore()

  store.trigger.commentSaved({comment: comment('file-b', 'b-1', 9), files})
  store.trigger.commentSaved({comment: comment('file-a', 'a-1', 7), files})
  store.trigger.commentSaved({comment: comment('file-a', 'a-2', 2), files})

  expect(listedKeys(store)).toEqual([
    {keys: ['a-2', 'a-1'], path: 'a.ts'},
    {keys: ['b-1'], path: 'b.ts'},
  ])
})

test.each([
  {name: 'before the file list is known', known: null},
  {name: 'on a file that the file list does not have', known: noFiles},
])('a comment saved $name changes nothing', ({known}) => {
  const store = savedCommentsLogic.createStore()

  expect(store.can.commentSaved({comment: comment('file-a', 'a-1', 7), files: known})).toBe(false)
})

test('a deleted comment leaves its file, and the last one removes the file', () => {
  const store = savedCommentsLogic.createStore()
  store.trigger.commentSaved({comment: comment('file-a', 'a-1', 7), files})
  store.trigger.commentSaved({comment: comment('file-a', 'a-2', 2), files})
  store.trigger.commentSaved({comment: comment('file-b', 'b-1', 9), files})

  store.trigger.commentDeleted({itemId: 'file-a', key: 'a-2'})
  store.trigger.commentDeleted({itemId: 'file-b', key: 'b-1'})

  expect(listedKeys(store)).toEqual([{keys: ['a-1'], path: 'a.ts'}])
})

test.each([
  {name: 'a key that is not listed', itemId: 'file-a', key: 'a-9'},
  {name: 'a file that is not listed', itemId: 'file-b', key: 'a-1'},
])('a delete of $name changes nothing', ({itemId, key}) => {
  const store = savedCommentsLogic.createStore()
  store.trigger.commentSaved({comment: comment('file-a', 'a-1', 7), files})

  expect(store.can.commentDeleted({itemId, key})).toBe(false)
})

test('a clear empties the list', () => {
  const store = savedCommentsLogic.createStore()
  store.trigger.commentSaved({comment: comment('file-a', 'a-1', 7), files})

  store.trigger.cleared()

  expect(store.getSnapshot().context).toEqual({sections: []})
})
