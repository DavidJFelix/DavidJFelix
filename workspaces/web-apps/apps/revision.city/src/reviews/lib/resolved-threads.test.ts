// cSpell:ignore revisioncity -- the GitHub App's slug
import {expect, test, vi} from 'vitest'
import {z} from 'zod'
import {GitHubApiError, type GitHubRequest} from './github-api'
import {
  countOpenAppThreads,
  listResolvedFingerprints,
  syncCheckRunWithThreads,
} from './resolved-threads'

const repository = {owner: 'acme', name: 'repo'}
const headSha = 'a'.repeat(40)

interface RecordedRequest {
  method: string
  path: string
  body?: unknown
}

type Route = (call: RecordedRequest) => unknown

const PULL = 'GET /repos/acme/repo/pulls/7'
const CHECK_RUNS = `GET /repos/acme/repo/commits/${headSha}/check-runs?check_name=Revision%20City&filter=latest`
const CHECK_RUN = 'PATCH /repos/acme/repo/check-runs/31'
const GRAPHQL = 'POST /graphql'

function fakeGitHub(routes: Record<string, Route>) {
  const calls: RecordedRequest[] = []
  const request: GitHubRequest = async ({method = 'GET', path, body, schema}) => {
    const call = {method, path, ...(body === undefined ? {} : {body})}
    calls.push(call)
    const route = routes[`${method} ${path}`]
    if (route === undefined) {
      throw new Error(`Unexpected request: ${method} ${path}`)
    }
    return schema.parse(await route(call))
  }
  const sent = (route: string) => calls.filter(({method, path}) => `${method} ${path}` === route)
  return {request, sent}
}

interface ThreadParams {
  isResolved?: boolean
  isOutdated?: boolean
  resolver?: string
  author?: {login?: string} | null
}

const thread = ({
  isResolved = false,
  isOutdated = false,
  resolver = 'maintainer',
  author = {login: 'revisioncity'},
}: ThreadParams = {}) => ({
  isResolved,
  isOutdated,
  resolvedBy: isResolved ? {login: resolver} : null,
  comments: {nodes: [{author}]},
})

const PERMISSION = (login: string) => `GET /repos/acme/repo/collaborators/${login}/permission`

const permissions = {
  [PERMISSION('maintainer')]: () => ({permission: 'write'}),
  [PERMISSION('author')]: () => ({permission: 'read'}),
  [PERMISSION('stranger')]: () => {
    throw new GitHubApiError(404, 'Not Found')
  },
}

const threadsPage = (nodes: object[], endCursor: string | null = null) => ({
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {pageInfo: {hasNextPage: endCursor !== null, endCursor}, nodes},
      },
    },
  },
})

const pull = (request: GitHubRequest) => ({request, repository, pullNumber: 7})

test('countOpenAppThreads counts only open threads that the app started on current lines', async () => {
  const github = fakeGitHub({
    ...permissions,
    [GRAPHQL]: () =>
      threadsPage([
        thread(),
        thread({isResolved: true}),
        thread({isOutdated: true}),
        // A user's login is not read, so a user named like the app does not count.
        thread({author: {}}),
        thread({author: {login: 'other-app'}}),
        thread({author: null}),
      ]),
  })

  expect(await countOpenAppThreads(pull(github.request))).toBe(1)
  expect(github.sent(GRAPHQL)[0].body).toMatchObject({
    variables: {owner: 'acme', name: 'repo', number: 7, after: null},
  })
})

test('countOpenAppThreads reads every page', async () => {
  const github = fakeGitHub({
    ...permissions,
    [GRAPHQL]: ({body}) =>
      z.object({variables: z.object({after: z.string().nullable()})}).parse(body).variables
        .after === null
        ? threadsPage([thread()], 'next')
        : threadsPage([thread(), thread({isResolved: true})]),
  })

  expect(await countOpenAppThreads(pull(github.request))).toBe(2)
  expect(github.sent(GRAPHQL)).toHaveLength(2)
})

test('countOpenAppThreads counts a thread as open when its resolver cannot push', async () => {
  const github = fakeGitHub({
    ...permissions,
    [GRAPHQL]: () =>
      threadsPage([
        thread({isResolved: true, resolver: 'maintainer'}),
        thread({isResolved: true, resolver: 'author'}),
        thread({isResolved: true, resolver: 'stranger'}),
        thread({isResolved: true, resolver: 'author'}),
      ]),
  })

  expect(await countOpenAppThreads(pull(github.request))).toBe(3)
  // One permission read for each resolver.
  expect(github.sent(PERMISSION('author'))).toHaveLength(1)
})

test('countOpenAppThreads stops at 30 pages and counts one more open thread', async () => {
  const github = fakeGitHub({[GRAPHQL]: () => threadsPage([], 'next')})

  expect(await countOpenAppThreads(pull(github.request))).toBe(1)
  expect(github.sent(GRAPHQL)).toHaveLength(30)
})

test('countOpenAppThreads counts a resolved thread without a resolver as open', async () => {
  const github = fakeGitHub({
    [GRAPHQL]: () => threadsPage([{...thread({isResolved: true}), resolvedBy: null}]),
  })

  expect(await countOpenAppThreads(pull(github.request))).toBe(1)
})

test('countOpenAppThreads throws when GitHub cannot answer for a resolver', async () => {
  const github = fakeGitHub({
    [GRAPHQL]: () => threadsPage([thread({isResolved: true})]),
    [PERMISSION('maintainer')]: () => {
      throw new GitHubApiError(500, 'Server Error')
    },
  })

  await expect(countOpenAppThreads(pull(github.request))).rejects.toThrow('Server Error')
})

interface CheckRunParams {
  conclusion?: string
  status?: string
  externalId?: string | null
  slug?: string
  title?: string
  summary?: string
}

const checkRun = ({
  conclusion = 'failure',
  status = 'completed',
  externalId = 'resolvable-findings',
  slug = 'revisioncity',
  title = '1 finding',
  summary = 'Cost $0.01.',
}: CheckRunParams = {}) => ({
  id: 31,
  status,
  conclusion,
  external_id: externalId,
  app: {slug},
  output: {title, summary, text: '### Findings'},
})

type CheckRun = ReturnType<typeof checkRun>

interface SyncSetupParams {
  run?: CheckRun
  threads?: object[]
  state?: string
  // The check run when the sync reads it again after the count.
  reread?: CheckRun
  routes?: Record<string, Route>
}

const updateSchema = z.object({
  conclusion: z.string(),
  external_id: z.string().optional(),
  output: z.object({title: z.string(), summary: z.string(), text: z.string().optional()}),
})

// Each read of the check run shows its last update. GitHub keeps the external
// id when an update does not send one.
function syncSetup({
  run = checkRun(),
  threads = [],
  state = 'open',
  reread,
  routes = {},
}: SyncSetupParams = {}) {
  let latest = run
  return fakeGitHub({
    ...permissions,
    [PULL]: () => ({state, head: {sha: headSha}}),
    [CHECK_RUNS]: () => ({check_runs: [latest]}),
    [GRAPHQL]: () => threadsPage(threads),
    'GET /repos/acme/repo/check-runs/31': () => reread ?? latest,
    [CHECK_RUN]: ({body}) => {
      const {conclusion, external_id: externalId, output} = updateSchema.parse(body)
      latest = {
        ...latest,
        conclusion,
        external_id: externalId ?? latest.external_id,
        output: {...output, text: output.text ?? latest.output.text},
      }
      return {}
    },
    ...routes,
  })
}

const conclusionOf = (body: unknown) => z.object({conclusion: z.string()}).parse(body).conclusion

test('syncCheckRunWithThreads passes a failed check when every thread is resolved', async () => {
  const github = syncSetup({threads: [thread({isResolved: true})]})

  expect(await syncCheckRunWithThreads(pull(github.request))).toBe('resolved')
  expect(github.sent(CHECK_RUN)).toHaveLength(1)
  expect(github.sent(CHECK_RUN)[0].body).toEqual({
    status: 'completed',
    conclusion: 'success',
    external_id: 'resolvable-findings',
    actions: [],
    output: {
      title: 'Resolved: 1 finding',
      summary:
        'Every current Revision City thread on this pull request is resolved, so this check passes. Cost $0.01.',
      text: '### Findings',
    },
  })
})

test('syncCheckRunWithThreads fails a resolved check again when a thread opens', async () => {
  const github = syncSetup({
    run: checkRun({
      conclusion: 'success',
      title: 'Resolved: 1 finding',
      summary:
        'Every current Revision City thread on this pull request is resolved, so this check passes. Cost $0.01.',
    }),
    threads: [thread()],
  })

  expect(await syncCheckRunWithThreads(pull(github.request))).toBe('reopened')
  expect(github.sent(CHECK_RUN)[0].body).toMatchObject({
    conclusion: 'failure',
    output: {title: '1 finding', summary: 'Cost $0.01.'},
  })
})

test.each([
  {name: 'a failed chunk review failed the check', setup: {run: checkRun({externalId: null})}},
  {name: 'the review is running', setup: {run: checkRun({status: 'in_progress'})}},
  {name: 'another app made the check', setup: {run: checkRun({slug: 'other-app'})}},
  {name: 'a thread is still open', setup: {threads: [thread()]}},
  {name: 'the check already passes', setup: {run: checkRun({conclusion: 'success'})}},
  {name: 'the pull request is closed', setup: {state: 'closed'}},
  {
    name: 'a user dismissed the check while the threads were counted',
    setup: {reread: checkRun({conclusion: 'success', externalId: 'dismissed'})},
  },
])('syncCheckRunWithThreads changes nothing when $name', async ({setup}) => {
  const github = syncSetup(setup)

  expect(await syncCheckRunWithThreads(pull(github.request))).toBe('unchanged')
  expect(github.sent(CHECK_RUN)).toEqual([])
})

test('syncCheckRunWithThreads counts again after a write, so a thread that opens during the count keeps the check red', async () => {
  let finishFirstCount: (() => void) | undefined
  const firstCount = new Promise<void>((resolve) => {
    finishFirstCount = resolve
  })
  let counts = 0
  const github = syncSetup({
    routes: {
      // The first count reads the thread while it is resolved, and answers late.
      [GRAPHQL]: async () => {
        counts += 1
        if (counts > 1) {
          return threadsPage([thread()])
        }
        await firstCount
        return threadsPage([thread({isResolved: true})])
      },
    },
  })

  const resolving = syncCheckRunWithThreads(pull(github.request))
  await vi.waitFor(() => expect(counts).toBe(1))
  // The sync for the thread that opened reads a failed check run, so it changes nothing.
  expect(await syncCheckRunWithThreads(pull(github.request))).toBe('unchanged')
  finishFirstCount?.()

  expect(await resolving).toBe('reopened')
  expect(github.sent(CHECK_RUN).map(({body}) => conclusionOf(body))).toEqual(['success', 'failure'])
})

test('listResolvedFingerprints lists a finding only when a user who can push resolved all its threads', async () => {
  const withBody = (fingerprint: string, params: ThreadParams) => ({
    ...thread(params),
    comments: {
      nodes: [
        {body: `<!-- revision-city:${fingerprint} -->\n\nBody`, author: {login: 'revisioncity'}},
      ],
    },
  })
  const github = fakeGitHub({
    ...permissions,
    [GRAPHQL]: () =>
      threadsPage([
        withBody('aaaaaaaaaaaaaaaa', {isResolved: true}),
        withBody('aaaaaaaaaaaaaaaa', {isResolved: true, isOutdated: true}),
        withBody('bbbbbbbbbbbbbbbb', {isResolved: true}),
        withBody('bbbbbbbbbbbbbbbb', {}),
        withBody('cccccccccccccccc', {isResolved: true, resolver: 'author'}),
        thread({isResolved: true}),
      ]),
  })

  expect(await listResolvedFingerprints(pull(github.request))).toEqual(['aaaaaaaaaaaaaaaa'])
})
