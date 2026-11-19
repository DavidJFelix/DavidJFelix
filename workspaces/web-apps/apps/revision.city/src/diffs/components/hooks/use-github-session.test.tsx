import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {renderToString} from 'react-dom/server'
import {expect, type Mock, onTestFinished, test, vi} from 'vitest'

import type {GitHubSession, GitHubSessionStatus} from './use-github-session'

const ENDPOINT = '/api/auth/github/session'

const server = setupServer()
server.listen({onUnhandledFrame: 'error'})

type Respond = () => Response | Promise<Response>

// Answers each request to the endpoint with the next response in line, so a
// test scripts exactly the fetches it expects; anything past the script is an
// unhandled request.
function serveSession(...responses: Respond[]): Mock<Respond> {
  const respond = vi.fn<Respond>()
  for (const response of responses) {
    respond.mockImplementationOnce(response)
  }
  server.use(http.get(ENDPOINT, () => respond()))
  onTestFinished(() => {
    server.resetHandlers()
  })
  return respond
}

// The session store is module state, so each test imports fresh copies of the
// modules to start with an idle store.
async function importFreshHook(): Promise<() => GitHubSession> {
  vi.resetModules()
  const module = await import('./use-github-session')
  return module.useGitHubSession
}

async function mountSettled(useGitHubSession: () => GitHubSession): Promise<GitHubSession> {
  const hook = renderHook(() => useGitHubSession())
  onTestFinished(cleanup)
  await waitFor(() => {
    expect(hook.result.current.status).not.toBe('loading')
  })
  return hook.result.current
}

// A mount during a retry shows `anonymous` until the retry answers.
async function mountUntil(
  useGitHubSession: () => GitHubSession,
  status: GitHubSessionStatus,
): Promise<GitHubSession> {
  const hook = renderHook(() => useGitHubSession())
  onTestFinished(cleanup)
  await waitFor(() => {
    expect(hook.result.current.status).toBe(status)
  })
  return hook.result.current
}

function withoutRepeats(statuses: readonly GitHubSessionStatus[]): GitHubSessionStatus[] {
  return statuses.filter((status, index) => status !== statuses[index - 1])
}

const LOGIN = 'reviewer'

const SIGNED_IN = {
  authenticated: true,
  login: LOGIN,
  avatarUrl: 'https://example.com/avatar.png',
}

test('a signed-in answer is fetched once and shared by later mounts', async () => {
  const respond = serveSession(() => HttpResponse.json(SIGNED_IN))
  const useGitHubSession = await importFreshHook()

  const first = await mountSettled(useGitHubSession)
  const second = await mountSettled(useGitHubSession)

  expect(first).toEqual({
    status: 'authenticated',
    login: LOGIN,
    avatarUrl: 'https://example.com/avatar.png',
  })
  expect(second).toEqual(first)
  expect(respond).toHaveBeenCalledTimes(1)
})

test('a signed-out answer is kept for later mounts', async () => {
  const respond = serveSession(() => HttpResponse.json({authenticated: false}))
  const useGitHubSession = await importFreshHook()

  const first = await mountSettled(useGitHubSession)
  const second = await mountSettled(useGitHubSession)

  expect(first.status).toBe('anonymous')
  expect(second.status).toBe('anonymous')
  expect(respond).toHaveBeenCalledTimes(1)
})

test('a failed status shows anonymous and the next mount asks again', async () => {
  const respond = serveSession(
    () => HttpResponse.json({}, {status: 503}),
    () => HttpResponse.json(SIGNED_IN),
  )
  const useGitHubSession = await importFreshHook()

  const first = await mountSettled(useGitHubSession)
  const second = await mountUntil(useGitHubSession, 'authenticated')

  expect(first.status).toBe('anonymous')
  expect(second.status).toBe('authenticated')
  expect(respond).toHaveBeenCalledTimes(2)
})

test('a network error shows anonymous and the next mount asks again', async () => {
  const respond = serveSession(
    () => HttpResponse.error(),
    () => HttpResponse.json(SIGNED_IN),
  )
  const useGitHubSession = await importFreshHook()

  const first = await mountSettled(useGitHubSession)
  const second = await mountUntil(useGitHubSession, 'authenticated')

  expect(first.status).toBe('anonymous')
  expect(second.status).toBe('authenticated')
  expect(respond).toHaveBeenCalledTimes(2)
})

test('a retry does not show loading again, and the first session keeps the first answer', async () => {
  serveSession(
    () => HttpResponse.error(),
    () => HttpResponse.json(SIGNED_IN),
  )
  const useGitHubSession = await importFreshHook()
  const {useFirstGitHubSession} = await import('./use-github-session')
  const latestStatuses: GitHubSessionStatus[] = []
  const firstStatuses: GitHubSessionStatus[] = []
  const mounted = renderHook(() => {
    const sessions = {latest: useGitHubSession(), first: useFirstGitHubSession()}
    latestStatuses.push(sessions.latest.status)
    firstStatuses.push(sessions.first.status)
    return sessions
  })
  onTestFinished(cleanup)
  await waitFor(() => {
    expect(mounted.result.current.first.status).toBe('anonymous')
  })

  await mountUntil(useGitHubSession, 'authenticated')

  expect(mounted.result.current.latest.status).toBe('authenticated')
  expect(mounted.result.current.first).toEqual({status: 'anonymous'})
  expect(withoutRepeats(latestStatuses)).toEqual(['loading', 'anonymous', 'authenticated'])
  expect(withoutRepeats(firstStatuses)).toEqual(['loading', 'anonymous'])
})

test('a server render gives loading and leaves the shared store idle', async () => {
  const useGitHubSession = await importFreshHook()
  const {useFirstGitHubSession} = await import('./use-github-session')
  const {githubSessionStore} = await import('@/diffs/state/github-session-store')
  function SessionStatus() {
    return `${useGitHubSession().status} ${useFirstGitHubSession().status}`
  }

  const html = renderToString(<SessionStatus />)

  expect(html).toBe('loading loading')
  expect(githubSessionStore.getSnapshot().context.status).toBe('idle')
})
