import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {expect, onTestFinished, test} from 'vitest'

import {SEARCH_PAGE_SIZE} from '@/diffs/lib/github-pull-request-search'
import type {PullRequestGroup, PullRequestSummary} from '@/diffs/lib/github-pull-requests'

import {type InboxItemsState, useInboxItems} from './use-inbox-items'

const ENDPOINT = '/api/diffs/pull-requests'

const server = setupServer()
server.listen({onUnhandledFrame: 'error'})

function serveGroups(groups: PullRequestGroup[]): void {
  server.use(http.get(ENDPOINT, () => HttpResponse.json({groups})))
  onTestFinished(() => {
    server.resetHandlers()
  })
}

function pullRequest(number: number, fields: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {owner: 'acme', repo: 'web', number, title: `Change ${number}`, draft: false, ...fields}
}

function group(
  kind: PullRequestGroup['kind'],
  pullRequests: PullRequestSummary[],
  fields: Partial<PullRequestGroup> = {},
): PullRequestGroup {
  return {kind, pullRequests, totalCount: pullRequests.length, ...fields}
}

async function loadInbox(): Promise<InboxItemsState> {
  const {result} = renderHook(() => useInboxItems(true))
  onTestFinished(cleanup)
  await waitFor(() => {
    expect(['loaded', 'sign-in-again', 'error']).toContain(result.current.status)
  })
  return result.current
}

test('a pull request in two groups is one item with both reasons, most direct first', async () => {
  serveGroups([
    group('member', [pullRequest(1)]),
    group('assigned', [pullRequest(1, {owner: 'ACME'})]),
  ])

  const {items} = await loadInbox()

  expect(items).toHaveLength(1)
  expect(items[0]?.reasons).toEqual(['assigned', 'member'])
})

test('each group kind becomes the reason of the same name', async () => {
  serveGroups([
    group('assigned', [pullRequest(1)]),
    group('owned', [pullRequest(2)]),
    group('member', [pullRequest(3)]),
    group('watched', [pullRequest(4)]),
  ])

  const {items} = await loadInbox()

  expect(items.map(({number, reasons}) => ({number, reasons}))).toEqual([
    {number: 1, reasons: ['assigned']},
    {number: 2, reasons: ['owned']},
    {number: 3, reasons: ['member']},
    {number: 4, reasons: ['watched']},
  ])
})

test('an item keeps the fields of its pull request and has no assignees yet', async () => {
  const summary = pullRequest(7, {
    author: 'maintainer',
    draft: true,
    title: 'Add the inbox',
    updatedAt: '2026-11-18T10:00:00Z',
  })
  serveGroups([group('owned', [summary])])

  const {items} = await loadInbox()

  expect(items).toEqual([
    {
      owner: 'acme',
      repo: 'web',
      number: 7,
      title: 'Add the inbox',
      authorLogin: 'maintainer',
      updatedAt: new Date('2026-11-18T10:00:00Z'),
      draft: true,
      assigneeLogins: [],
      reasons: ['owned'],
    },
  ])
})

test('items are in the order of their last update, newest first, and an item with no time last', async () => {
  serveGroups([
    group('assigned', [pullRequest(1, {updatedAt: '2026-11-01T00:00:00Z'}), pullRequest(2)]),
    group('watched', [pullRequest(3, {updatedAt: '2026-11-18T00:00:00Z'})]),
    group('owned', [pullRequest(4, {updatedAt: '2026-11-10T00:00:00Z'})]),
  ])

  const {items} = await loadInbox()

  expect(items.map(({number}) => number)).toEqual([3, 4, 1, 2])
})

test.each([
  {name: 'every group is complete', fields: {}, truncated: false},
  {name: 'a group is truncated', fields: {truncated: true}, truncated: true},
  {
    name: 'GitHub counts more than one search page',
    fields: {totalCount: SEARCH_PAGE_SIZE + 1},
    truncated: true,
  },
  {
    name: 'GitHub counts one full search page',
    fields: {totalCount: SEARCH_PAGE_SIZE},
    truncated: false,
  },
  {
    name: 'a group counts a pull request of an earlier group',
    fields: {totalCount: 2},
    truncated: false,
  },
])('the list is truncated when $name: $truncated', async ({fields, truncated}) => {
  serveGroups([group('assigned', [pullRequest(1)]), group('watched', [pullRequest(2)], fields)])

  const inbox = await loadInbox()

  expect(inbox.isTruncated).toBe(truncated)
})

test('a rejected sign-in has no items', async () => {
  server.use(http.get(ENDPOINT, () => HttpResponse.json({}, {status: 401})))
  onTestFinished(() => {
    server.resetHandlers()
  })

  const inbox = await loadInbox()

  expect(inbox).toEqual({status: 'sign-in-again', items: [], isTruncated: false})
})

test('a disabled inbox stays idle', () => {
  const {result} = renderHook(() => useInboxItems(false))
  onTestFinished(cleanup)

  expect(result.current).toEqual({status: 'idle', items: [], isTruncated: false})
})
