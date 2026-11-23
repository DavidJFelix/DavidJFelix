import type {GitStatus} from '@pierre/trees'
import {expect, test} from 'vitest'

import {type SidebarTab, sidebarLogic} from './sidebar-store'

function createSidebarStore() {
  return sidebarLogic.createStore()
}

function createFilteredStore(statuses: readonly GitStatus[]) {
  const store = createSidebarStore()
  for (const gitStatus of statuses) {
    store.trigger.statusToggled({gitStatus})
  }
  return store
}

test('the sidebar starts on the files tab with the diff stats open and no filter', () => {
  expect(createSidebarStore().getSnapshot().context).toEqual({
    activeTab: 'files',
    selectedStatusPanel: 'diffStats',
    selectedStatuses: new Set(),
    status: 'symbolsUnopened',
  })
})

test('opening the comments tab does not start the symbol reads', () => {
  const store = createSidebarStore()

  store.trigger.tabOpened({tab: 'comments'})

  expect(store.getSnapshot().context).toMatchObject({
    activeTab: 'comments',
    status: 'symbolsUnopened',
  })
})

test('the first open of the symbols tab starts the symbol reads', () => {
  const store = createSidebarStore()

  store.trigger.tabOpened({tab: 'symbols'})

  expect(store.getSnapshot().context).toMatchObject({activeTab: 'symbols', status: 'symbolsOpened'})
})

test.each<{name: string; tab: SidebarTab}>([
  {name: 'files', tab: 'files'},
  {name: 'comments', tab: 'comments'},
])('opening the $name tab after the symbols tab keeps the symbol reads on', ({tab}) => {
  const store = createSidebarStore()
  store.trigger.tabOpened({tab: 'symbols'})

  store.trigger.tabOpened({tab})

  expect(store.getSnapshot().context).toMatchObject({activeTab: tab, status: 'symbolsOpened'})
})

test.each<{name: string; opened: readonly SidebarTab[]; tab: SidebarTab}>([
  {name: 'the files tab at the start', opened: [], tab: 'files'},
  {name: 'the symbols tab', opened: ['symbols'], tab: 'symbols'},
  {
    name: 'the comments tab after the symbols tab',
    opened: ['symbols', 'comments'],
    tab: 'comments',
  },
])('opening $name again changes nothing', ({opened, tab}) => {
  const store = createSidebarStore()
  for (const openedTab of opened) {
    store.trigger.tabOpened({tab: openedTab})
  }

  expect(store.can.tabOpened({tab})).toBe(false)
})

test('a click on the open status panel closes it, and a second click opens it again', () => {
  const store = createSidebarStore()

  store.trigger.statusPanelToggled({panel: 'diffStats'})
  expect(store.getSnapshot().context.selectedStatusPanel).toBeNull()

  store.trigger.statusPanelToggled({panel: 'diffStats'})
  expect(store.getSnapshot().context.selectedStatusPanel).toBe('diffStats')
})

test('a click on a closed status panel opens it in place of the open one', () => {
  const store = createSidebarStore()

  store.trigger.statusPanelToggled({panel: 'systemMonitor'})

  expect(store.getSnapshot().context.selectedStatusPanel).toBe('systemMonitor')
})

test('a status toggle adds the status to the filter, and a second toggle removes it', () => {
  const store = createFilteredStore(['added', 'deleted'])
  expect(store.getSnapshot().context.selectedStatuses).toEqual(new Set(['added', 'deleted']))

  store.trigger.statusToggled({gitStatus: 'added'})

  expect(store.getSnapshot().context.selectedStatuses).toEqual(new Set(['deleted']))
})

test.each<{name: string; from: readonly GitStatus[]; to: readonly GitStatus[]}>([
  {name: 'no filter to only that status', from: [], to: ['deleted']},
  {name: 'other statuses to only that status', from: ['added', 'deleted'], to: ['deleted']},
  {name: 'only that status to no filter', from: ['deleted'], to: []},
])('an isolate changes $name', ({from, to}) => {
  const store = createFilteredStore(from)

  store.trigger.statusIsolated({gitStatus: 'deleted'})

  expect(store.getSnapshot().context.selectedStatuses).toEqual(new Set(to))
})

test('a clear removes the filter, and a clear with no filter is not allowed', () => {
  const store = createFilteredStore(['added', 'renamed'])

  store.trigger.statusFilterCleared()

  expect(store.getSnapshot().context.selectedStatuses).toEqual(new Set())
  expect(store.can.statusFilterCleared()).toBe(false)
})

test('a tab switch keeps the filter and the status panel', () => {
  const store = createFilteredStore(['modified'])
  store.trigger.statusPanelToggled({panel: 'systemMonitor'})

  store.trigger.tabOpened({tab: 'comments'})
  store.trigger.tabOpened({tab: 'files'})

  expect(store.getSnapshot().context).toMatchObject({
    selectedStatusPanel: 'systemMonitor',
    selectedStatuses: new Set(['modified']),
  })
})
