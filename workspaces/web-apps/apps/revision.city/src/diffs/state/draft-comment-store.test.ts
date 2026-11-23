import type {CodeViewLineSelection, SelectedLineRange} from '@pierre/diffs'
import {expect, test} from 'vitest'

import type {AvatarName} from '@/diffs/lib/annotation'
import {draftCommentLogic} from './draft-comment-store'

type DraftCommentStore = ReturnType<typeof draftCommentLogic.createStore>
type DraftCommentEvent = Parameters<DraftCommentStore['send']>[0]

const range: SelectedLineRange = {start: 3, side: 'deletions', end: 5, endSide: 'additions'}
const selection: CodeViewLineSelection = {id: 'file-a', range}
const author: AvatarName = 'ada'

// The draft `draft-0` is open on `file-a`.
function createDraftingStore(): DraftCommentStore {
  const store = draftCommentLogic.createStore()
  store.trigger.gutterClicked({itemId: 'file-a', range})
  return store
}

function send(store: DraftCommentStore, event: DraftCommentEvent) {
  return store.transition(store.getSnapshot(), event)
}

test('a new store has no draft and no selection', () => {
  const store = draftCommentLogic.createStore()

  expect(store.getSnapshot().context).toEqual({draftCount: 0, selectedLines: null, status: 'idle'})
})

test.each([
  {name: 'selects its lines', from: null, to: selection},
  {name: 'clears its selected lines', from: {id: 'file-a', range: {...range}}, to: null},
  {name: 'selects its lines in place of others', from: {...selection, id: 'file-b'}, to: selection},
])('a click on a comment $name', ({from, to}) => {
  const store = draftCommentLogic.createStore()
  store.trigger.linesSelected({selection: from})

  store.trigger.commentClicked({selection})

  expect(store.getSnapshot().context.selectedLines).toBe(to)
})

test('a gutter click opens a draft on the last line and side of the range', () => {
  const store = draftCommentLogic.createStore()

  const [next, effects] = send(store, {type: 'gutterClicked', itemId: 'file-a', range})

  const draft = {itemId: 'file-a', key: 'draft-0', lineNumber: 5, range, side: 'additions'}
  expect(effects).toEqual([{type: 'draftOpened', ...draft}])
  expect(next.context).toEqual({draft, draftCount: 1, selectedLines: null, status: 'drafting'})
})

test('a gutter click uses the start side when the range has no end side', () => {
  const store = draftCommentLogic.createStore()

  store.trigger.gutterClicked({itemId: 'file-a', range: {start: 2, end: 2, side: 'deletions'}})

  expect(store.getSnapshot().context.draft?.side).toBe('deletions')
})

test('a gutter click on a range without a side opens no draft', () => {
  const store = draftCommentLogic.createStore()

  expect(store.can.gutterClicked({itemId: 'file-a', range: {start: 1, end: 1}})).toBe(false)
})

test('a new draft on another file discards the open draft first', () => {
  const [, effects] = send(createDraftingStore(), {type: 'gutterClicked', itemId: 'file-b', range})

  expect(effects).toEqual([
    {type: 'draftDiscarded', itemId: 'file-a', key: 'draft-0'},
    expect.objectContaining({type: 'draftOpened', itemId: 'file-b', key: 'draft-1'}),
  ])
})

test('a new draft on the same file only opens, because it replaces the drafts of that file', () => {
  const [, effects] = send(createDraftingStore(), {type: 'gutterClicked', itemId: 'file-a', range})

  expect(effects).toEqual([expect.objectContaining({type: 'draftOpened', key: 'draft-1'})])
})

test.each([
  {name: 'the open draft closes it', key: 'draft-0', status: 'idle'},
  {name: 'a saved comment keeps the open draft', key: 'saved-0', status: 'drafting'},
])('the removal of $name and clears the selection', ({key, status}) => {
  const store = createDraftingStore()
  store.trigger.linesSelected({selection})

  const [next, effects] = send(store, {type: 'removeRequested', itemId: 'file-a', key})

  expect(effects).toEqual([{type: 'commentRemoved', itemId: 'file-a', key}])
  expect(next.context).toMatchObject({draftCount: 1, selectedLines: null, status})
})

test('a save turns the open draft into a saved comment with the trimmed text', () => {
  const store = createDraftingStore()
  store.trigger.linesSelected({selection})

  const [next, effects] = send(store, {
    type: 'saveRequested',
    author,
    itemId: 'file-a',
    key: 'draft-0',
    message: ' LGTM \n',
  })

  expect(effects).toEqual([
    {
      type: 'draftSaved',
      author,
      itemId: 'file-a',
      key: 'draft-0',
      lineNumber: 5,
      message: 'LGTM',
      range,
      side: 'additions',
    },
  ])
  expect(next.context).toEqual({draftCount: 1, selectedLines: null, status: 'idle'})
})

test.each([
  {name: 'blank text', key: 'draft-0', message: ' \n '},
  {name: 'a key that is not the open draft', key: 'draft-9', message: 'LGTM'},
])('a save of $name changes nothing', ({key, message}) => {
  const store = createDraftingStore()

  expect(store.can.saveRequested({author, itemId: 'file-a', key, message})).toBe(false)
})

test('a second save of the same draft changes nothing', () => {
  const store = createDraftingStore()
  const save = {author, itemId: 'file-a', key: 'draft-0', message: 'LGTM'}
  store.trigger.saveRequested(save)

  expect(store.can.saveRequested(save)).toBe(false)
})
