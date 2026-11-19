import {expect, test, vi} from 'vitest'

import {
  type GitHubSessionContext,
  githubSessionLogic,
  githubSessionStore,
} from './github-session-store'

type Status = GitHubSessionContext['status']
type EventType = 'requested' | 'signedIn' | 'signedOut' | 'failed'

const VISITOR = {login: 'reviewer', avatarUrl: 'https://example.com/avatar.png'}

const CONTEXTS: Record<Status, GitHubSessionContext> = {
  idle: {status: 'idle'},
  loading: {status: 'loading'},
  authenticated: {status: 'authenticated', ...VISITOR},
  anonymous: {status: 'anonymous'},
  unknown: {status: 'unknown'},
}

const EVENTS = {
  requested: {type: 'requested'},
  signedIn: {type: 'signedIn', ...VISITOR},
  signedOut: {type: 'signedOut'},
  failed: {type: 'failed'},
} satisfies Record<EventType, {type: EventType}>

interface LegalTransition {
  from: Status
  type: EventType
  to: Status
  effectCount: number
}

const LEGAL: readonly LegalTransition[] = [
  {from: 'idle', type: 'requested', to: 'loading', effectCount: 1},
  {from: 'unknown', type: 'requested', to: 'loading', effectCount: 1},
  {from: 'loading', type: 'signedIn', to: 'authenticated', effectCount: 0},
  {from: 'loading', type: 'signedOut', to: 'anonymous', effectCount: 0},
  {from: 'loading', type: 'failed', to: 'unknown', effectCount: 1},
]

const ILLEGAL = Object.values(CONTEXTS).flatMap((context) =>
  Object.values(EVENTS)
    .filter(
      (event) => !LEGAL.some(({from, type}) => from === context.status && type === event.type),
    )
    .map((event): [Status, EventType] => [context.status, event.type]),
)

function transitionFrom(status: Status, type: EventType) {
  const snapshot = {...githubSessionStore.getInitialSnapshot(), context: CONTEXTS[status]}
  const [next, effects] = githubSessionStore.transition(snapshot, EVENTS[type])
  return {snapshot, next, effects}
}

function stubFetch(answer: () => Promise<Response>) {
  const fetchSession = vi.fn<() => Promise<Response>>(answer)
  vi.stubGlobal('fetch', fetchSession)
  return fetchSession
}

function requestSettled() {
  const store = githubSessionLogic.createStore()
  store.trigger.requested()
  return vi.waitFor(() => {
    expect(store.getSnapshot().context.status).not.toBe('loading')
    return store
  })
}

test.each(LEGAL)(
  '$from + $type goes to $to with $effectCount effects',
  ({from, type, to, effectCount}) => {
    const {next, effects} = transitionFrom(from, type)

    expect(next.context.status).toBe(to)
    expect(effects).toHaveLength(effectCount)
  },
)

test('signedIn keeps the login and the avatar', () => {
  const {next} = transitionFrom('loading', 'signedIn')

  expect(next.context).toEqual({status: 'authenticated', ...VISITOR})
})

test.each(ILLEGAL)('%s ignores %s', (from, type) => {
  const {snapshot, next, effects} = transitionFrom(from, type)

  expect(next).toBe(snapshot)
  expect(effects).toEqual([])
})

test('a signed-in answer authenticates, and a second request does not fetch again', async () => {
  const fetchSession = stubFetch(async () => Response.json({authenticated: true, ...VISITOR}))

  const store = await requestSettled()
  store.trigger.requested()

  expect(store.getSnapshot().context).toEqual({status: 'authenticated', ...VISITOR})
  expect(store.can.requested()).toBe(false)
  expect(fetchSession).toHaveBeenCalledTimes(1)
  expect(fetchSession).toHaveBeenCalledWith('/api/auth/github/session', {cache: 'no-store'})
})

test.each([
  ['a signed-out answer', {authenticated: false}],
  ['an answer without a login', {authenticated: true}],
  ['an answer that is not an object', null],
])('%s is anonymous', async (_name, body) => {
  stubFetch(async () => Response.json(body))

  const store = await requestSettled()

  expect(store.getSnapshot().context).toEqual({status: 'anonymous'})
})

test('an avatar that is not a string is dropped', async () => {
  stubFetch(async () => Response.json({authenticated: true, login: 'reviewer', avatarUrl: 7}))

  const store = await requestSettled()

  expect(store.getSnapshot().context).toEqual({
    status: 'authenticated',
    login: 'reviewer',
    avatarUrl: undefined,
  })
})

test.each([
  ['an error status', async () => Response.json({}, {status: 503})],
  ['a body that does not parse', async () => new Response('not json')],
  ['a network error', async () => Promise.reject(new TypeError('Failed to fetch'))],
])('%s is unknown, and a request asks again', async (_name, answer) => {
  vi.stubGlobal('window', new EventTarget())
  const fetchSession = stubFetch(answer)

  const store = await requestSettled()

  expect(store.getSnapshot().context).toEqual({status: 'unknown'})
  expect(store.can.requested()).toBe(true)
  expect(fetchSession).toHaveBeenCalledTimes(1)
})

test('after a failed lookup, the next window focus asks again once', async () => {
  const focusTarget = new EventTarget()
  vi.stubGlobal('window', focusTarget)
  const fetchSession = stubFetch(async () => Response.json({}, {status: 503}))
  const store = await requestSettled()
  fetchSession.mockImplementation(async () => Response.json({authenticated: true, ...VISITOR}))

  focusTarget.dispatchEvent(new Event('focus'))
  await vi.waitFor(() => {
    expect(store.getSnapshot().context.status).toBe('authenticated')
  })
  focusTarget.dispatchEvent(new Event('focus'))

  expect(fetchSession).toHaveBeenCalledTimes(2)
})
