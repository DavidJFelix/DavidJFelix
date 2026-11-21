import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'
import {isRecord} from '@/lib/json-read'

const SESSION_ENDPOINT = '/api/auth/github/session'

const signedInVisitorShape = {
  login: z.string(),
  avatarUrl: z.optional(z.string()),
}

const signedInVisitorSchema = z.readonly(z.object(signedInVisitorShape))

const githubSessionAnswerSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({status: z.literal('authenticated'), ...signedInVisitorShape}),
    z.object({status: z.literal('anonymous')}),
  ]),
)

// No event changes `firstAnswer` after the first lookup ends. A failed first
// lookup counts as `anonymous`.
const afterFirstLookupShape = {firstAnswer: githubSessionAnswerSchema}

// `unknown` follows a failed lookup, so the visitor can be signed in or signed out.
const githubSessionContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({status: z.literal('idle')}),
    z.object({status: z.literal('loading')}),
    z.object({
      status: z.literal('authenticated'),
      ...signedInVisitorShape,
      ...afterFirstLookupShape,
    }),
    z.object({status: z.literal('anonymous'), ...afterFirstLookupShape}),
    z.object({status: z.literal('unknown'), ...afterFirstLookupShape}),
    z.object({status: z.literal('retrying'), ...afterFirstLookupShape}),
  ]),
)

const githubSessionEventSchemas = {
  requested: z.object({}),
  signedIn: signedInVisitorSchema,
  signedOut: z.object({}),
  failed: z.object({}),
}

export type SignedInVisitor = z.infer<typeof signedInVisitorSchema>

export type GitHubSessionAnswer = z.infer<typeof githubSessionAnswerSchema>

export type GitHubSessionContext = z.infer<typeof githubSessionContextSchema>

type LookupResult = GitHubSessionAnswer | {status: 'unknown'}

const ANONYMOUS_ANSWER: GitHubSessionAnswer = {status: 'anonymous'}

// Signing in or out reloads the page, so one lookup per page load is enough.
// After a failed lookup, the next hook mount asks again.
export const githubSessionLogic = createStoreLogic({
  schemas: {context: githubSessionContextSchema, events: githubSessionEventSchemas},
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
      return context.status === 'idle'
        ? {status: 'loading'}
        : {status: 'retrying', firstAnswer: context.firstAnswer}
    },
    signedIn: (context, visitor) =>
      settle(context, {
        status: 'authenticated',
        login: visitor.login,
        avatarUrl: visitor.avatarUrl,
      }),
    signedOut: (context) => settle(context, ANONYMOUS_ANSWER),
    failed: (context) => settle(context, {status: 'unknown'}),
  },
})

// The server shares this module across visitors, so trigger events only from browser code.
export const githubSessionStore = githubSessionLogic.createStore()

function settle(
  context: GitHubSessionContext,
  result: LookupResult,
): GitHubSessionContext | undefined {
  if (context.status === 'loading') {
    return {...result, firstAnswer: result.status === 'unknown' ? ANONYMOUS_ANSWER : result}
  }
  if (context.status === 'retrying') {
    return {...result, firstAnswer: context.firstAnswer}
  }
  return undefined
}

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
