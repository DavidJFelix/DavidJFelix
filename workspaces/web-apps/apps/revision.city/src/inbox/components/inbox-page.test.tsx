import '@testing-library/jest-dom/vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {cleanup, render, screen} from '@testing-library/react'
import type {ComponentProps} from 'react'
import {expect, onTestFinished, test, vi} from 'vitest'

import type {GitHubSession} from '@/diffs/components/hooks/use-github-session'
import type {InboxItemsState} from '@/inbox/components/hooks/use-inbox-items'
import type {InboxItem} from '@/inbox/lib/inbox-item'

import {InboxView} from './inbox-page'

const NOW = Date.parse('2026-11-18T12:00:00Z')
const SIGNED_IN: GitHubSession = {status: 'authenticated', login: 'maintainer'}

function item(fields: Partial<InboxItem> = {}): InboxItem {
  return {
    owner: 'acme',
    repo: 'web',
    number: 42,
    title: 'Add the inbox page',
    draft: false,
    assignees: [],
    reasons: ['assigned'],
    ...fields,
  }
}

function loaded(items: InboxItem[], truncated = false): InboxItemsState {
  return {status: 'loaded', items, truncated}
}

// Renders the view on /inbox in a router that has the paths its links point to.
async function renderInbox(props: ComponentProps<typeof InboxView>): Promise<void> {
  const rootRoute = createRootRoute()
  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/inbox',
      component: () => <InboxView {...props} />,
    }),
    createRoute({getParentRoute: () => rootRoute, path: '/diffs'}),
    createRoute({getParentRoute: () => rootRoute, path: '/diffs/$'}),
  ])
  // The router restores the scroll position after a navigation, and jsdom has no scrolling.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({initialEntries: ['/inbox']}),
  })
  render(<RouterProvider router={router} />)
  onTestFinished(cleanup)
  await screen.findByRole('heading', {level: 1, name: 'Inbox'})
}

test.each([
  {
    name: 'the session is loading',
    session: {status: 'loading'},
    inbox: {status: 'idle', items: [], truncated: false},
    words: 'Loading your open pull requests',
  },
  {
    name: 'the list is loading',
    session: SIGNED_IN,
    inbox: {status: 'loading', items: [], truncated: false},
    words: 'Loading your open pull requests',
  },
  {
    name: 'the visitor is signed out',
    session: {status: 'anonymous'},
    inbox: {status: 'idle', items: [], truncated: false},
    words: 'Sign in to see your inbox',
  },
  {
    name: 'GitHub rejected the sign-in',
    session: SIGNED_IN,
    inbox: {status: 'sign-in-again', items: [], truncated: false},
    words: 'GitHub rejected your sign-in. Sign in again.',
  },
  {
    name: 'GitHub could not list the pull requests',
    session: SIGNED_IN,
    inbox: {status: 'error', items: [], truncated: false},
    words: 'GitHub could not list your pull requests just now.',
  },
  {
    name: 'the list is empty',
    session: SIGNED_IN,
    inbox: loaded([]),
    words: 'No open pull requests',
  },
  {
    name: 'the list has one pull request',
    session: SIGNED_IN,
    inbox: loaded([item()]),
    words: '1 open pull request',
  },
  {
    name: 'the list is truncated',
    session: SIGNED_IN,
    inbox: loaded([item(), item({number: 43})], true),
    words: '2 open pull requests. GitHub has more, so the list shows the most recently updated.',
  },
] satisfies Array<{name: string; session: GitHubSession; inbox: InboxItemsState; words: string}>)(
  'when $name, the page says "$words"',
  async ({session, inbox, words}) => {
    await renderInbox({session, inbox, now: NOW})

    expect(screen.getByText(words)).toBeInTheDocument()
  },
)

test.each([
  {
    name: 'signed-out',
    session: {status: 'anonymous'},
    inbox: {status: 'idle', items: [], truncated: false},
    button: 'Sign in with GitHub',
  },
  {
    name: 'rejected',
    session: SIGNED_IN,
    inbox: {status: 'sign-in-again', items: [], truncated: false},
    button: 'Sign in again',
  },
] satisfies Array<{name: string; session: GitHubSession; inbox: InboxItemsState; button: string}>)(
  'a $name visitor gets the "$button" button',
  async ({session, inbox, button}) => {
    await renderInbox({session, inbox, now: NOW})

    expect(screen.getByRole('button', {name: button})).toBeInTheDocument()
  },
)

test('the skeleton rows are hidden from screen readers', async () => {
  await renderInbox({session: {status: 'loading'}, inbox: loaded([]), now: NOW})

  expect(screen.getByRole('status')).toHaveTextContent('Loading your open pull requests')
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('the empty inbox links to the page that opens any diff URL', async () => {
  await renderInbox({session: SIGNED_IN, inbox: loaded([]), now: NOW})

  const links = screen.getAllByRole('link', {name: 'Open a diff URL'})
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/diffs', '/diffs'])
})

test('the header shows the login of the signed-in visitor', async () => {
  await renderInbox({session: SIGNED_IN, inbox: loaded([]), now: NOW})

  expect(screen.getByText('maintainer')).toHaveTextContent('Signed in as maintainer')
})
