import {useEffect, useState} from 'react'

const SESSION_ENDPOINT = '/diffs/api/auth/session'
const LOGIN_ENDPOINT = '/diffs/api/auth/login'
const LOGOUT_ENDPOINT = '/diffs/api/auth/logout'

export type GitHubSessionStatus = 'loading' | 'anonymous' | 'authenticated'

export interface GitHubSession {
  status: GitHubSessionStatus
  login?: string
  avatarUrl?: string
}

const LOADING_SESSION: GitHubSession = {status: 'loading'}
const ANONYMOUS_SESSION: GitHubSession = {status: 'anonymous'}

// Sign-in and sign-out are full-page navigations, so the session cannot change
// within a page lifetime; a single fetch per load is shared by every hook
// instance.
let sessionPromise: Promise<GitHubSession> | undefined

// Reports whether the browser holds a GitHub session cookie. The token itself
// is HttpOnly and never reaches this code; server routes read it directly.
export function useGitHubSession(): GitHubSession {
  const [session, setSession] = useState<GitHubSession>(LOADING_SESSION)

  useEffect(() => {
    let cancelled = false
    void loadGitHubSession().then((loaded) => {
      if (!cancelled) {
        setSession(loaded)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return session
}

export function getGitHubLoginURL(returnTo: string): string {
  return `${LOGIN_ENDPOINT}?${new URLSearchParams({returnTo})}`
}

export function getGitHubLogoutURL(returnTo: string): string {
  return `${LOGOUT_ENDPOINT}?${new URLSearchParams({returnTo})}`
}

function loadGitHubSession(): Promise<GitHubSession> {
  sessionPromise ??= fetchGitHubSession()
  return sessionPromise
}

async function fetchGitHubSession(): Promise<GitHubSession> {
  try {
    const response = await fetch(SESSION_ENDPOINT, {cache: 'no-store'})
    if (!response.ok) {
      return ANONYMOUS_SESSION
    }

    const data: unknown = await response.json()
    if (!isRecord(data) || data.authenticated !== true || typeof data.login !== 'string') {
      return ANONYMOUS_SESSION
    }
    return {
      status: 'authenticated',
      login: data.login,
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
    }
  } catch {
    return ANONYMOUS_SESSION
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
