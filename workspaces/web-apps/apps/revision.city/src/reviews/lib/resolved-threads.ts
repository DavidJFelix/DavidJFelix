import {z} from 'zod'
import {checkRunLogic, decodeCheckRun} from '../state/check-run-store'
import {
  GitHubApiError,
  type GitHubRepository,
  type GitHubRequest,
  getPullRequest,
  type PullRequestParams,
  repositoryPath,
} from './github-api'
import {APP_SLUG, CHECK_RUN_NAME, updateCheckRun} from './publish-review'
import {readFingerprint} from './review-markdown'

const THREADS_QUERY = `query ($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved
          isOutdated
          resolvedBy { login }
          comments(first: 1) { nodes { body author { ... on Bot { login } } } }
        }
      }
    }
  }
}`

const threadsPageSchema = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        reviewThreads: z.object({
          pageInfo: z.object({hasNextPage: z.boolean(), endCursor: z.string().nullable()}),
          nodes: z.array(
            z.object({
              isResolved: z.boolean(),
              isOutdated: z.boolean(),
              resolvedBy: z.object({login: z.string()}).nullable(),
              comments: z.object({
                nodes: z.array(
                  z.object({
                    body: z.string().optional(),
                    author: z.object({login: z.string().optional()}).nullable(),
                  }),
                ),
              }),
            }),
          ),
        }),
      }),
    }),
  }),
})

// Reads at most 3000 threads. On a pull request with more, the check stays red.
const MAX_THREAD_PAGES = 30

// The author of a pull request can resolve its threads. Only a resolve by a
// user who can push to the repository closes a thread, so that an author
// without that access cannot clear the check.
const TRUSTED_PERMISSIONS = new Set(['admin', 'write'])

interface AppThread {
  // The login of the user who resolved the thread, or null when it is open.
  resolvedBy: string | null
  isOutdated: boolean
  // The fingerprint of the finding in the first comment, when it has one.
  fingerprint?: string
}

interface ResolvedThread extends AppThread {
  // True when a user who can push resolved the thread.
  isResolved: boolean
}

async function listResolvedAppThreads(pull: PullRequestParams): Promise<ResolvedThread[]> {
  const threads = await listAppThreadsFrom({...pull, after: null, page: 1})
  const resolvers = [...new Set(threads.flatMap(({resolvedBy}) => resolvedBy ?? []))]
  const trusted = new Set(
    (
      await Promise.all(
        resolvers.map(async (login) => ((await canPush({...pull, login})) ? [login] : [])),
      )
    ).flat(),
  )
  return threads.map((thread) => ({
    ...thread,
    isResolved: thread.resolvedBy !== null && trusted.has(thread.resolvedBy),
  }))
}

// Counts the open threads that the app started on lines that the head still
// has. An outdated thread is about code that a push changed, and a review of
// the new code posts the finding again when it is still there.
export async function countOpenAppThreads(pull: PullRequestParams): Promise<number> {
  const threads = await listResolvedAppThreads(pull)
  return threads.filter(({isOutdated, isResolved}) => !isOutdated && !isResolved).length
}

// The fingerprints of the findings whose app threads are all resolved, also
// outdated threads. A finding can have a thread on each line that a run posted
// it on.
export async function listResolvedFingerprints(pull: PullRequestParams): Promise<string[]> {
  const resolvedByFingerprint = new Map<string, boolean>()
  for (const {fingerprint, isResolved} of await listResolvedAppThreads(pull)) {
    if (fingerprint !== undefined) {
      resolvedByFingerprint.set(
        fingerprint,
        (resolvedByFingerprint.get(fingerprint) ?? true) && isResolved,
      )
    }
  }
  return [...resolvedByFingerprint].flatMap(([fingerprint, resolved]) =>
    resolved ? [fingerprint] : [],
  )
}

interface ThreadPageParams extends PullRequestParams {
  after: string | null
  page: number
}

async function listAppThreadsFrom({
  request,
  repository,
  pullNumber,
  after,
  page,
}: ThreadPageParams): Promise<AppThread[]> {
  const {data} = await request({
    method: 'POST',
    path: '/graphql',
    body: {
      query: THREADS_QUERY,
      variables: {owner: repository.owner, name: repository.name, number: pullNumber, after},
    },
    schema: threadsPageSchema,
  })
  const {pageInfo, nodes} = data.repository.pullRequest.reviewThreads
  // The query reads the login only of a bot. GraphQL gives the login of a
  // GitHub App without the "[bot]" suffix. A resolved thread without a
  // resolver counts as open.
  const threads = nodes
    .filter(({comments}) => comments.nodes[0]?.author?.login === APP_SLUG)
    .map(({isResolved, isOutdated, resolvedBy, comments}): AppThread => {
      const fingerprint = readFingerprint(comments.nodes[0]?.body ?? '')
      return {
        resolvedBy: isResolved ? (resolvedBy?.login ?? '') : null,
        isOutdated,
        ...(fingerprint === undefined ? {} : {fingerprint}),
      }
    })
  if (!pageInfo.hasNextPage) {
    return threads
  }
  // At the page limit, add one open thread, so that the check stays red.
  if (page >= MAX_THREAD_PAGES) {
    return [...threads, {resolvedBy: null, isOutdated: false}]
  }
  return [
    ...threads,
    ...(await listAppThreadsFrom({
      request,
      repository,
      pullNumber,
      after: pageInfo.endCursor,
      page: page + 1,
    })),
  ]
}

export interface CanPushParams {
  request: GitHubRequest
  repository: GitHubRepository
  login: string
}

export async function canPush({request, repository, login}: CanPushParams): Promise<boolean> {
  if (login === '') {
    return false
  }
  const {permission} = await request({
    path: `${repositoryPath(repository)}/collaborators/${encodeURIComponent(login)}/permission`,
    schema: z.object({permission: z.string()}),
  }).catch((error: unknown) => {
    // GitHub answers 404 for a user who is not a collaborator.
    if (error instanceof GitHubApiError && error.status === 404) {
      return {permission: 'none'}
    }
    throw error
  })
  return TRUSTED_PERMISSIONS.has(permission)
}

const checkRunSchema = z.object({
  id: z.number(),
  status: z.string(),
  conclusion: z.string().nullable(),
  external_id: z.string().nullable(),
  app: z.object({slug: z.string()}).nullable(),
  output: z.object({
    title: z.string().nullable(),
    summary: z.string().nullable(),
    text: z.string().nullable(),
  }),
})

export type SyncResult = 'resolved' | 'reopened' | 'unchanged'

// Makes the app's latest check run on the head agree with its threads: it
// passes when no thread is open, and fails again when one opens.
export async function syncCheckRunWithThreads(pull: PullRequestParams): Promise<SyncResult> {
  const first = await syncCheckRunOnce(pull)
  if (first === 'unchanged') {
    return first
  }
  // A thread can change while the first sync counts. The sync for that change
  // can read the check run before the first write, and then change nothing.
  const second = await syncCheckRunOnce(pull)
  return second === 'unchanged' ? first : second
}

async function syncCheckRunOnce(pull: PullRequestParams): Promise<SyncResult> {
  const {request, repository} = pull
  const state = await getPullRequest(pull)
  if (!state.open) {
    return 'unchanged'
  }
  const {check_runs: checkRuns} = await request({
    path: `${repositoryPath(repository)}/commits/${state.headSha}/check-runs?check_name=${encodeURIComponent(CHECK_RUN_NAME)}&filter=latest`,
    schema: z.object({check_runs: z.array(checkRunSchema)}),
  })
  const checkRun = checkRuns.find(({app}) => app?.slug === APP_SLUG)
  if (checkRun === undefined) {
    return 'unchanged'
  }
  const latest = checkRunLogic.createStore(decodeCheckRun(checkRun))
  if (!latest.can.threadsResolved() && !latest.can.threadReopened()) {
    return 'unchanged'
  }
  const event = (await countOpenAppThreads(pull)) === 0 ? 'threadsResolved' : 'threadReopened'
  // Counting the threads takes time. A dismissal or another sync in that time
  // changes the check run, so the event must still be legal in a new read.
  const current = checkRunLogic.createStore(
    decodeCheckRun(
      await request({
        path: `${repositoryPath(repository)}/check-runs/${checkRun.id}`,
        schema: checkRunSchema,
      }),
    ),
  )
  if (!current.can[event]()) {
    return 'unchanged'
  }
  current.trigger[event]()
  await updateCheckRun({
    request,
    repository,
    checkRunId: checkRun.id,
    state: current.getSnapshot().context,
  })
  return event === 'threadsResolved' ? 'resolved' : 'reopened'
}
