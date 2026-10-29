import {z} from 'zod'
import {GitHubApiError, getPullRequest, type PullRequestParams, repositoryPath} from './github-api'
import {APP_SLUG, CHECK_RUN_NAME, completeCheckRun} from './publish-review'
import type {CheckRunOutput} from './review-markdown'

// A check run that failed only on findings has this external id. When every
// thread that the app started on lines that the head still has is resolved, the
// check run passes. A failed chunk review has no thread, so it keeps the check red.
export const RESOLVABLE_EXTERNAL_ID = 'resolvable-findings'

const RESOLVED_TITLE_PREFIX = 'Resolved: '

const RESOLVED_SUMMARY_NOTE =
  'Every current Revision City thread on this pull request is resolved, so this check passes.'

function resolvedOutput({title, summary, text}: CheckRunOutput): CheckRunOutput {
  return {
    title: `${RESOLVED_TITLE_PREFIX}${title}`,
    summary: `${RESOLVED_SUMMARY_NOTE} ${summary}`,
    ...(text === undefined ? {} : {text}),
  }
}

function reopenedOutput({title, summary, text}: CheckRunOutput): CheckRunOutput {
  return {
    title: title.startsWith(RESOLVED_TITLE_PREFIX)
      ? title.slice(RESOLVED_TITLE_PREFIX.length)
      : title,
    summary: summary.startsWith(`${RESOLVED_SUMMARY_NOTE} `)
      ? summary.slice(RESOLVED_SUMMARY_NOTE.length + 1)
      : summary,
    ...(text === undefined ? {} : {text}),
  }
}

const THREADS_QUERY = `query ($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved
          isOutdated
          resolvedBy { login }
          comments(first: 1) { nodes { author { ... on Bot { login } } } }
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
}

// Counts the open threads that the app started on lines that the head still
// has. An outdated thread is about code that a push changed, and a review of
// the new code posts the finding again when it is still there.
export async function countOpenAppThreads(pull: PullRequestParams): Promise<number> {
  const threads = await listAppThreadsFrom({...pull, after: null, page: 1})
  const resolvers = [...new Set(threads.flatMap(({resolvedBy}) => resolvedBy ?? []))]
  const trusted = new Set(
    (
      await Promise.all(
        resolvers.map(async (login) => ((await canPush({...pull, login})) ? [login] : [])),
      )
    ).flat(),
  )
  return threads.filter(({resolvedBy}) => resolvedBy === null || !trusted.has(resolvedBy)).length
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
    .filter(
      ({isOutdated, comments}) => !isOutdated && comments.nodes[0]?.author?.login === APP_SLUG,
    )
    .map(({isResolved, resolvedBy}) => ({
      resolvedBy: isResolved ? (resolvedBy?.login ?? '') : null,
    }))
  if (!pageInfo.hasNextPage) {
    return threads
  }
  // At the page limit, add one open thread, so that the check stays red.
  if (page >= MAX_THREAD_PAGES) {
    return [...threads, {resolvedBy: null}]
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

interface CanPushParams extends PullRequestParams {
  login: string
}

async function canPush({request, repository, login}: CanPushParams): Promise<boolean> {
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

const checkRunsSchema = z.object({
  check_runs: z.array(
    z.object({
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
    }),
  ),
})

export type SyncResult = 'resolved' | 'reopened' | 'unchanged'

// Makes the app's latest check run on the head agree with its threads: it
// passes when no thread is open, and fails again when one opens.
export async function syncCheckRunWithThreads(pull: PullRequestParams): Promise<SyncResult> {
  const {request, repository} = pull
  const state = await getPullRequest(pull)
  if (!state.open) {
    return 'unchanged'
  }
  const {check_runs: checkRuns} = await request({
    path: `${repositoryPath(repository)}/commits/${state.headSha}/check-runs?check_name=${encodeURIComponent(CHECK_RUN_NAME)}&filter=latest`,
    schema: checkRunsSchema,
  })
  const checkRun = checkRuns.find(({app}) => app?.slug === APP_SLUG)
  if (
    checkRun === undefined ||
    checkRun.status !== 'completed' ||
    checkRun.external_id !== RESOLVABLE_EXTERNAL_ID
  ) {
    return 'unchanged'
  }
  const resolved = (await countOpenAppThreads(pull)) === 0
  const output: CheckRunOutput = {
    title: checkRun.output.title ?? '',
    summary: checkRun.output.summary ?? '',
    ...(checkRun.output.text === null ? {} : {text: checkRun.output.text}),
  }
  const complete = (conclusion: 'success' | 'failure', nextOutput: CheckRunOutput) =>
    completeCheckRun({
      request,
      repository,
      checkRunId: checkRun.id,
      conclusion,
      output: nextOutput,
      externalId: RESOLVABLE_EXTERNAL_ID,
    })
  if (resolved && checkRun.conclusion === 'failure') {
    await complete('success', resolvedOutput(output))
    return 'resolved'
  }
  if (!resolved && checkRun.conclusion === 'success') {
    await complete('failure', reopenedOutput(output))
    return 'reopened'
  }
  return 'unchanged'
}
