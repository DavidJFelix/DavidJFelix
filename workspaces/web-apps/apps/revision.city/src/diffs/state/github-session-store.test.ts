import {expect, test, vi} from 'vitest'

import {
  type GitHubSessionAnswer,
  type GitHubSessionContext,
  githubSessionLogic,
  githubSessionStore,
} from './github-session-store'

type Status = GitHubSessionContext['status']
type EventType = 'requested' | 'signedIn' | 'signedOut' | 'failed'
type SessionStore = ReturnType<typeof githubSessionLogic.createStore>

const VISITOR = {login: 'reviewer', avatarUrl: 'https://example.com/avatar.png'}
const SIGNED_IN: GitHubSessionAnswer = {status: 'authenticated', ...VISITOR}
const ANONYMOUS: GitHubSessionAnswer = {status: 'anonymous'}

const CONTEXTS: Record<Status, GitHubSessionContext> = {
  idle: {status: 'idle'},
  loading: {status: 'loading'},
  authenticated: {...SIGNED_IN, firstAnswer: SIGNED_IN},
  anonymous: {status: 'anonymous', firstAnswer: ANONYMOUS},
  unknown: {status: 'unknown', firstAnswer: ANONYMOUS},
  retrying: {status: 'retrying', firstAnswer: ANONYMOUS},
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
  firstAnswer: GitHubSessionAnswer | undefined
}

const LEGAL: readonly LegalTransition[] = [
  {from: 'idle', type: 'requested', to: 'loading', effectCount: 1, firstAnswer: undefined},
  {from: 'unknown', type: 'requested', to: 'retrying', effectCount: 1, firstAnswer: ANONYMOUS},
  {from: 'loading', type: 'signedIn', to: 'authenticated', effectCount: 0, firstAnswer: SIGNED_IN},
  {from: 'loading', type: 'signedOut', to: 'anonymous', effectCount: 0, firstAnswer: ANONYMOUS},
  {from: 'loading', type: 'failed', to: 'unknown', effectCount: 0, firstAnswer: ANONYMOUS},
  {from: 'retrying', type: 'signedIn', to: 'authenticated', effectCount: 0, firstAnswer: ANONYMOUS},
  {from: 'retrying', type: 'signedOut', to: 'anonymous', effectCount: 0, firstAnswer: ANONYMOUS},
  {from: 'retrying', type: 'failed', to: 'unknown', effectCount: 0, firstAnswer: ANONYMOUS},
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

function firstAnswerOf(context: GitHubSessionContext): GitHubSessionAnswer | undefined {
  return 'firstAnswer' in context ? context.firstAnswer : undefined
}

function stubFetch(answer: () => Promise<Response>) {
  const fetchSession = vi.fn<() => Promise<Response>>(answer)
  vi.stubGlobal('fetch', fetchSession)
  return fetchSession
}

function requestSettled(store: SessionStore = githubSessionLogic.createStore()) {
  store.trigger.requested()
  return vi.waitFor(() => {
    expect(['loading', 'retrying']).not.toContain(store.getSnapshot().context.status)
    return store
  })
}

test.each(LEGAL)(
  '$from + $type goes to $to and sets the first answer',
  ({from, type, to, effectCount, firstAnswer}) => {
    const {next, effects} = transitionFrom(from, type)

    expect(next.context.status).toBe(to)
    expect(firstAnswerOf(next.context)).toEqual(firstAnswer)
    expect(effects).toHaveLength(effectCount)
  },
)

test('signedIn keeps the login and the avatar', () => {
  const {next} = transitionFrom('loading', 'signedIn')

  expect(next.context).toEqual({...SIGNED_IN, firstAnswer: SIGNED_IN})
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

  expect(store.getSnapshot().context).toEqual({...SIGNED_IN, firstAnswer: SIGNED_IN})
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

  expect(store.getSnapshot().context).toEqual({status: 'anonymous', firstAnswer: ANONYMOUS})
})

test('an avatar that is not a string is dropped', async () => {
  stubFetch(async () => Response.json({authenticated: true, login: 'reviewer', avatarUrl: 7}))

  const store = await requestSettled()

  const answer = {status: 'authenticated', login: 'reviewer', avatarUrl: undefined}
  expect(store.getSnapshot().context).toEqual({...answer, firstAnswer: answer})
})

test.each([
  ['an error status', async () => Response.json({}, {status: 503})],
  ['a body that does not parse', async () => new Response('not json')],
  ['a network error', async () => Promise.reject(new TypeError('Failed to fetch'))],
])('%s is unknown with an anonymous first answer', async (_name, answer) => {
  const fetchSession = stubFetch(answer)

  const store = await requestSettled()

  expect(store.getSnapshot().context).toEqual({status: 'unknown', firstAnswer: ANONYMOUS})
  expect(store.can.requested()).toBe(true)
  expect(fetchSession).toHaveBeenCalledTimes(1)
})

test('a retry that signs in changes the latest answer and keeps the first answer', async () => {
  const fetchSession = stubFetch(async () => Response.json({}, {status: 503}))
  const store = await requestSettled()
  fetchSession.mockImplementation(async () => Response.json({authenticated: true, ...VISITOR}))

  await requestSettled(store)

  expect(store.getSnapshot().context).toEqual({...SIGNED_IN, firstAnswer: ANONYMOUS})
  expect(store.can.requested()).toBe(false)
  expect(fetchSession).toHaveBeenCalledTimes(2)
})
