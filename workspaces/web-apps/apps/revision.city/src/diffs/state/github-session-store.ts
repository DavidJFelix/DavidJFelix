import {createStoreLogic} from '@xstate/store'
import {isRecord} from '@/lib/json-read'

const SESSION_ENDPOINT = '/api/auth/github/session'

export interface SignedInVisitor {
  login: string
  avatarUrl?: string
}

// `unknown` follows a failed lookup, so the visitor can be signed in or signed out.
export type GitHubSessionContext =
  | {status: 'idle'}
  | {status: 'loading'}
  | ({status: 'authenticated'} & SignedInVisitor)
  | {status: 'anonymous'}
  | {status: 'unknown'}

// Signing in or out reloads the page, so one lookup per page load is enough.
// After a failed lookup, the next hook mount or window focus asks again.
export const githubSessionLogic = createStoreLogic({
  context: (): GitHubSessionContext => ({status: 'idle'}),
  on: {
    requested: (context, _event, enqueue) => {
      if (context.status !== 'idle' && context.status !== 'unknown') {
        return undefined
      }
      enqueue.effect(({trigger}) => {
        void fetchSignedInVisitor().then(
          (visitor) => (visitor === undefined ? trigger.signedOut() : trigger.signedIn(visitor)),
          () => trigger.failed(),
        )
      })
      return {status: 'loading'}
    },
    signedIn: (context, visitor: SignedInVisitor) =>
      context.status === 'loading'
        ? {status: 'authenticated', login: visitor.login, avatarUrl: visitor.avatarUrl}
        : undefined,
    signedOut: (context) => (context.status === 'loading' ? {status: 'anonymous'} : undefined),
    failed: (context, _event, enqueue) => {
      if (context.status !== 'loading') {
        return undefined
      }
      enqueue.effect(({trigger}) => {
        window.addEventListener('focus', () => trigger.requested(), {once: true})
      })
      return {status: 'unknown'}
    },
  },
})

// The server shares this module across visitors, so trigger events only from browser code.
export const githubSessionStore = githubSessionLogic.createStore()

// The session route answers 200 for signed-in and signed-out visitors, so an
// error status is a failed lookup.
async function fetchSignedInVisitor(): Promise<SignedInVisitor | undefined> {
  const response = await fetch(SESSION_ENDPOINT, {cache: 'no-store'})
  if (!response.ok) {
    throw new Error(`GitHub session lookup failed with status ${response.status}`)
  }

  const data: unknown = await response.json()
  if (!isRecord(data) || data.authenticated !== true || typeof data.login !== 'string') {
    return undefined
  }
  return {
    login: data.login,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
  }
}
