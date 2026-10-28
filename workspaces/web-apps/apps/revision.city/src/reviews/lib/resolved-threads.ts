import {z} from 'zod'
import {getPullRequest, type PullRequestParams, repositoryPath} from './github-api'
import {APP_SLUG, CHECK_RUN_NAME, completeCheckRun} from './publish-review'
import type {CheckRunOutput} from './review-markdown'

// A check run that failed only on findings has this external id. When every
// thread that the app started on the pull request is resolved, the check run
// passes. A failed chunk review has no thread, so it keeps the check red.
export const RESOLVABLE_EXTERNAL_ID = 'resolvable-findings'

const RESOLVED_TITLE_PREFIX = 'Resolved: '

const RESOLVED_SUMMARY_NOTE =
  'Every current Revision City thread on this pull request is resolved, so this check passes.'

export function resolvedOutput({title, summary, text}: CheckRunOutput): CheckRunOutput {
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

// Counts the open threads that the app started on lines that the head still
// has. An outdated thread is about code that a push changed, and a review of
// the new code posts the finding again when it is still there.
export function countOpenAppThreads(pull: PullRequestParams): Promise<number> {
  return countOpenAppThreadsFrom({...pull, after: null, page: 1})
}

interface ThreadPageParams extends PullRequestParams {
  after: string | null
  page: number
}

async function countOpenAppThreadsFrom({
  request,
  repository,
  pullNumber,
  after,
  page,
}: ThreadPageParams): Promise<number> {
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
  // GitHub App without the "[bot]" suffix.
  const open = nodes.filter(
    ({isResolved, isOutdated, comments}) =>
      !isResolved && !isOutdated && comments.nodes[0]?.author?.login === APP_SLUG,
  ).length
  if (!pageInfo.hasNextPage) {
    return open
  }
  // Past the last page, count one more open thread, so that the check stays red.
  if (page >= MAX_THREAD_PAGES) {
    return open + 1
  }
  return (
    open +
    (await countOpenAppThreadsFrom({
      request,
      repository,
      pullNumber,
      after: pageInfo.endCursor,
      page: page + 1,
    }))
  )
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
