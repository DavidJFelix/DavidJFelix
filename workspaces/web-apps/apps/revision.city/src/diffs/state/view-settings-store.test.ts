import {expect, test} from 'vitest'

import {
  type ViewSettingsContext,
  type ViewSettingsStore,
  viewSettingsLogic,
} from './view-settings-store'

type ViewSettingsEvent = Parameters<ViewSettingsStore['send']>[0]
type Status = ViewSettingsContext['status']

const reachStatus: Record<Status, (store: ViewSettingsStore) => void> = {
  closed: () => {},
  open: (store) => store.trigger.fileTreeOverlayToggled(),
  'forced-closed': (store) => store.trigger.viewportChanged({mobile: false}),
}

function createStoreIn(status: Status): ViewSettingsStore {
  const store = viewSettingsLogic.createStore()
  reachStatus[status](store)
  expect(store.getSnapshot().context.status).toBe(status)
  return store
}

test('a new store holds the viewer defaults with the file tree overlay closed', () => {
  const store = viewSettingsLogic.createStore()

  expect(store.getSnapshot().context).toEqual({
    collapseMode: 'expanded',
    diffIndicators: 'bars',
    diffStyle: 'split',
    lineNumbers: true,
    overflow: 'scroll',
    showBackgrounds: true,
    status: 'closed',
  })
})

interface SettingChange {
  event: ViewSettingsEvent
  change: Partial<ViewSettingsContext>
}

const settingChanges: SettingChange[] = [
  {
    event: {type: 'diffIndicatorsChanged', diffIndicators: 'classic'},
    change: {diffIndicators: 'classic'},
  },
  {event: {type: 'diffStyleChanged', diffStyle: 'unified'}, change: {diffStyle: 'unified'}},
  {event: {type: 'lineNumbersChanged', lineNumbers: false}, change: {lineNumbers: false}},
  {event: {type: 'overflowChanged', overflow: 'wrap'}, change: {overflow: 'wrap'}},
  {
    event: {type: 'showBackgroundsChanged', showBackgrounds: false},
    change: {showBackgrounds: false},
  },
]

test.each(settingChanges)('$event.type changes only its setting', ({event, change}) => {
  const store = viewSettingsLogic.createStore()
  const before = store.getSnapshot().context

  store.send(event)

  expect(store.getSnapshot().context).toEqual({...before, ...change})
})

test('the collapse toggle collapses every file, and a second toggle expands them', () => {
  const store = viewSettingsLogic.createStore()

  store.trigger.collapseModeToggled()
  expect(store.getSnapshot().context.collapseMode).toBe('collapsed')
  store.trigger.collapseModeToggled()

  expect(store.getSnapshot().context.collapseMode).toBe('expanded')
})

test('the toggle opens the overlay on a phone, and a second toggle closes it', () => {
  const store = createStoreIn('closed')

  store.trigger.fileTreeOverlayToggled()
  expect(store.getSnapshot().context.status).toBe('open')
  store.trigger.fileTreeOverlayToggled()

  expect(store.getSnapshot().context.status).toBe('closed')
})

test('a close in open closes the overlay', () => {
  const store = createStoreIn('open')

  store.trigger.fileTreeOverlayClosed()

  expect(store.getSnapshot().context.status).toBe('closed')
})

test('the toggle cannot open the overlay on a wide viewport, where it makes the page inert', () => {
  const store = createStoreIn('forced-closed')

  expect(store.can.fileTreeOverlayToggled()).toBe(false)
  store.trigger.fileTreeOverlayToggled()

  expect(store.getSnapshot().context.status).toBe('forced-closed')
})

const illegalEvents: [Status, ViewSettingsEvent][] = [
  ['closed', {type: 'fileTreeOverlayClosed'}],
  ['forced-closed', {type: 'fileTreeOverlayClosed'}],
  ['forced-closed', {type: 'fileTreeOverlayToggled'}],
]

test.each(illegalEvents)('in %s, %j changes nothing', (status, event) => {
  const store = createStoreIn(status)
  const before = store.getSnapshot()

  store.send(event)

  expect(store.getSnapshot()).toBe(before)
})

interface ViewportChange {
  from: Status
  mobile: boolean
  status: Status
  diffStyle: ViewSettingsContext['diffStyle']
}

const viewportChanges: ViewportChange[] = [
  {from: 'closed', mobile: false, status: 'forced-closed', diffStyle: 'split'},
  {from: 'open', mobile: false, status: 'forced-closed', diffStyle: 'split'},
  {from: 'forced-closed', mobile: false, status: 'forced-closed', diffStyle: 'split'},
  {from: 'closed', mobile: true, status: 'closed', diffStyle: 'unified'},
  {from: 'open', mobile: true, status: 'open', diffStyle: 'unified'},
  {from: 'forced-closed', mobile: true, status: 'closed', diffStyle: 'unified'},
]

test.each(viewportChanges)(
  'in $from, a viewport change with mobile $mobile moves to $status in the $diffStyle view',
  ({from, mobile, status, diffStyle}) => {
    const store = createStoreIn(from)

    store.trigger.viewportChanged({mobile})

    expect(store.getSnapshot().context).toMatchObject({status, diffStyle})
  },
)

test('a viewport change replaces the view that the visitor picked', () => {
  const store = createStoreIn('forced-closed')
  store.trigger.diffStyleChanged({diffStyle: 'unified'})

  store.trigger.viewportChanged({mobile: true})
  store.trigger.viewportChanged({mobile: false})

  expect(store.getSnapshot().context.diffStyle).toBe('split')
})
