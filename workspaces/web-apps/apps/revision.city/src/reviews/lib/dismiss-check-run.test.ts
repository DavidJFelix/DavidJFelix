// cSpell:ignore revisioncity -- the GitHub App's slug
import {expect, test} from 'vitest'
import {dismissCheckRun} from './dismiss-check-run'
import {GitHubApiError, type GitHubRequest} from './github-api'

const repository = {owner: 'acme', name: 'repo'}

interface RecordedRequest {
  method: string
  path: string
  body?: unknown
}

type Route = (call: RecordedRequest) => unknown

const CHECK_RUN = '/repos/acme/repo/check-runs/31'
const permission = (login: string) => `GET /repos/acme/repo/collaborators/${login}/permission`

interface SetupParams {
  conclusion?: string
  slug?: string
}

function fakeGitHub({conclusion = 'failure', slug = 'revisioncity'}: SetupParams = {}) {
  const routes: Record<string, Route> = {
    [permission('maintainer')]: () => ({permission: 'write'}),
    [permission('author')]: () => ({permission: 'read'}),
    [permission('stranger')]: () => {
      throw new GitHubApiError(404, 'Not Found')
    },
    [`GET ${CHECK_RUN}`]: () => ({
      conclusion,
      app: {slug},
      output: {title: '2 failed chunk reviews', summary: 'Cost $0.01.', text: '### Failed'},
    }),
    [`PATCH ${CHECK_RUN}`]: () => ({}),
  }
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
  const patches = () => calls.filter(({method}) => method === 'PATCH')
  return {request, patches}
}

test('dismissCheckRun passes a failed check run for a user who can push', async () => {
  const github = fakeGitHub()

  expect(
    await dismissCheckRun({
      request: github.request,
      repository,
      checkRunId: 31,
      login: 'maintainer',
    }),
  ).toBe('dismissed')
  expect(github.patches()[0].body).toEqual({
    status: 'completed',
    conclusion: 'success',
    actions: [],
    external_id: 'dismissed',
    output: {
      title: 'Dismissed: 2 failed chunk reviews',
      summary: 'maintainer dismissed the findings, so this check passes. Cost $0.01.',
      text: '### Failed',
    },
  })
})

test.each(['author', 'stranger'])(
  'dismissCheckRun refuses a user who cannot push (%s)',
  async (login) => {
    const github = fakeGitHub()

    expect(
      await dismissCheckRun({request: github.request, repository, checkRunId: 31, login}),
    ).toBe('refused')
    expect(github.patches()).toEqual([])
  },
)

test.each([
  {name: 'the check run passes', setup: {conclusion: 'success'}},
  {name: 'another app made the check run', setup: {slug: 'other-app'}},
])('dismissCheckRun changes nothing when $name', async ({setup}) => {
  const github = fakeGitHub(setup)

  expect(
    await dismissCheckRun({
      request: github.request,
      repository,
      checkRunId: 31,
      login: 'maintainer',
    }),
  ).toBe('unchanged')
  expect(github.patches()).toEqual([])
})
