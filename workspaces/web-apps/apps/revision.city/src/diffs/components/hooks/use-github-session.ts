import {shallowEqual, useSelector} from '@xstate/store-react'
import {useEffect} from 'react'
import {type GitHubSessionContext, githubSessionStore} from '@/diffs/state/github-session-store'

const LOGIN_ENDPOINT = '/api/auth/github/login'
const LOGOUT_ENDPOINT = '/api/auth/github/logout'
// Resolves to a GitHub URL server-side, since which page to land on depends on
// installations only the session's token can read.
export const GITHUB_MANAGE_ACCESS_ENDPOINT = '/api/auth/github/installations'

export type GitHubSessionStatus = 'loading' | 'anonymous' | 'authenticated'

export interface GitHubSession {
  status: GitHubSessionStatus
  login?: string
  avatarUrl?: string
}

const LOADING_SESSION: GitHubSession = {status: 'loading'}
const ANONYMOUS_SESSION: GitHubSession = {status: 'anonymous'}

// Reports whether the browser holds a GitHub session cookie. The token itself
// is HttpOnly and never reaches this code; server routes read it directly.
export function useGitHubSession(): GitHubSession {
  return useSessionFromStore(toLatestSession)
}

export function useFirstGitHubSession(): GitHubSession {
  return useSessionFromStore(toFirstSession)
}

function useSessionFromStore(
  toSession: (context: GitHubSessionContext) => GitHubSession,
): GitHubSession {
  const session = useSelector(
    githubSessionStore,
    (snapshot) => toSession(snapshot.context),
    shallowEqual,
  )
  // Effects do not run on the server, so a server render gives `loading` and
  // does not touch the store.
  useEffect(() => {
    githubSessionStore.trigger.requested()
  }, [])
  return session
}

// The callers know only `GitHubSessionStatus`, so a failed lookup and its retry
// show as `anonymous`.
const SESSION_BY_STATUS: Record<
  Exclude<GitHubSessionContext['status'], 'authenticated'>,
  GitHubSession
> = {
  idle: LOADING_SESSION,
  loading: LOADING_SESSION,
  anonymous: ANONYMOUS_SESSION,
  unknown: ANONYMOUS_SESSION,
  retrying: ANONYMOUS_SESSION,
}

function toLatestSession(context: GitHubSessionContext): GitHubSession {
  return context.status === 'authenticated'
    ? {status: 'authenticated', login: context.login, avatarUrl: context.avatarUrl}
    : SESSION_BY_STATUS[context.status]
}

function toFirstSession(context: GitHubSessionContext): GitHubSession {
  return 'firstAnswer' in context ? context.firstAnswer : LOADING_SESSION
}

export function getGitHubLoginURL(returnTo: string): string {
  return `${LOGIN_ENDPOINT}?${new URLSearchParams({returnTo})}`
}

export function getGitHubLogoutURL(returnTo: string): string {
  return `${LOGOUT_ENDPOINT}?${new URLSearchParams({returnTo})}`
}

// The hash never reaches the server, so an auth round-trip lands on the same
// path and search; line-hash targets are simply dropped.
export function getCurrentReturnPath(): string {
  return `${window.location.pathname}${window.location.search}`
}
