import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {expect, type Mock, onTestFinished, test, vi} from 'vitest'

import {type PullRequestGroupsState, usePullRequestGroups} from './use-pull-request-groups'

const ENDPOINT = '/api/diffs/pull-requests'

const server = setupServer()
server.listen({onUnhandledRequest: 'error'})

type Respond = () => Response | Promise<Response>

// Answers each request to the endpoint with the next response in line, so a
// test scripts exactly the fetches it expects; anything past the script is an
// unhandled request.
function servePullRequests(...responses: Respond[]): Mock<Respond> {
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

function groups(pullRequestTitles: string[]): Response {
  return HttpResponse.json({
    groups: [
      {
        kind: 'assigned',
        pullRequests: pullRequestTitles.map((title, index) => ({
          owner: 'acme',
          repo: 'repo',
          number: index + 1,
          title,
        })),
        totalCount: pullRequestTitles.length,
      },
    ],
  })
}

async function mountLoaded() {
  const hook = renderHook(() => usePullRequestGroups(true))
  onTestFinished(cleanup)
  await waitFor(() => {
    expect(hook.result.current.status).toBe('loaded')
  })
  return hook
}

function refocusWindow(): void {
  act(() => {
    window.dispatchEvent(new Event('focus'))
  })
}

// Lets an in-flight response finish when the outcome under test is that
// nothing changes, which waitFor alone cannot wait for.
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

function titles(state: PullRequestGroupsState): string[] {
  return state.groups.flatMap((group) => group.pullRequests.map((pullRequest) => pullRequest.title))
}

test('loads pull request groups on mount', async () => {
  servePullRequests(() => groups(['first']))

  const {result} = await mountLoaded()

  expect(titles(result.current)).toEqual(['first'])
})

test('window refocus starts a refetch while presenting the stale groups', async () => {
  let finishRefetch!: (response: Response) => void
  const refetch = new Promise<Response>((resolve) => {
    finishRefetch = resolve
  })
  const respond = servePullRequests(
    () => groups(['first']),
    () => refetch,
  )
  const {result} = await mountLoaded()

  refocusWindow()

  await waitFor(() => {
    expect(respond).toHaveBeenCalledTimes(2)
  })
  expect(result.current.status).toBe('loaded')
  expect(titles(result.current)).toEqual(['first'])

  finishRefetch(groups(['second']))
  await waitFor(() => {
    expect(titles(result.current)).toEqual(['second'])
  })
})

test('a failed refocus refetch keeps the previously loaded groups', async () => {
  const respond = servePullRequests(
    () => groups(['first']),
    () => HttpResponse.json({}, {status: 500}),
  )
  const {result} = await mountLoaded()

  refocusWindow()

  await waitFor(() => {
    expect(respond).toHaveBeenCalledTimes(2)
  })
  await settle()
  expect(result.current.status).toBe('loaded')
  expect(titles(result.current)).toEqual(['first'])
})

test('refocus while a refetch is in flight does not start another request', async () => {
  const respond = servePullRequests(
    () => groups(['first']),
    () => new Promise(() => {}),
  )
  await mountLoaded()

  refocusWindow()
  refocusWindow()

  await settle()
  expect(respond).toHaveBeenCalledTimes(2)
})
