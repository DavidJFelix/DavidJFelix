import '@testing-library/jest-dom/vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {cleanup, render, screen, waitFor, within} from '@testing-library/react'
import type {ReactNode} from 'react'
import {expect, onTestFinished, test, vi} from 'vitest'

import type {InboxItem} from '@/inbox/lib/inbox-item'

import {InboxList, InboxSkeleton} from './inbox-list'

const NOW = Date.parse('2026-11-18T12:00:00Z')

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

// Renders the content on /inbox in a router that has the path the rows link to.
function renderInRouter(content: ReactNode): void {
  const rootRoute = createRootRoute()
  const routeTree = rootRoute.addChildren([
    createRoute({getParentRoute: () => rootRoute, path: '/inbox', component: () => content}),
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
}

async function renderList(items: InboxItem[]): Promise<void> {
  renderInRouter(<InboxList items={items} now={NOW} />)
  await screen.findByRole('list')
}

test('each item is one row in the list', async () => {
  await renderList([item(), item({number: 43, title: 'Fix the inbox page'})])

  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
})

test('a row is one link to the pull request in the viewer', async () => {
  await renderList([item()])

  const row = screen.getByRole('link', {name: /Add the inbox page/})
  expect(row).toHaveAttribute('href', '/diffs/acme/web/pull/42')
  expect(row).toHaveTextContent('acme/web#42')
})

test('a draft has the draft badge and a ready pull request has none', async () => {
  await renderList([item({title: 'Ready'}), item({number: 43, title: 'Not ready', draft: true})])

  expect(within(screen.getByRole('link', {name: /Not ready/})).getByText('Draft')).toBeVisible()
  expect(within(screen.getByRole('link', {name: /^Ready/})).queryByText('Draft')).toBeNull()
})

test('a row names the author and each reason', async () => {
  await renderList([item({author: 'contributor', reasons: ['review-requested', 'member']})])

  const row = within(screen.getByRole('link', {name: /Add the inbox page/}))
  for (const words of ['by contributor', 'Review requested', 'Your organization']) {
    expect(row.getByText(words)).toBeInTheDocument()
  }
})

test('the time of the last update is a time element with the ISO time', async () => {
  const updatedAt = '2026-11-18T09:00:00Z'
  await renderList([item({updatedAt})])

  const time = screen.getByText('3 hours ago')
  expect(time.tagName).toBe('TIME')
  expect(time).toHaveAttribute('dateTime', updatedAt)
  expect(time.getAttribute('title')).toContain('2026')
})

test('a row with no update time has no time element', async () => {
  await renderList([item()])

  expect(document.querySelector('time')).toBeNull()
})

test('the skeleton rows are hidden from screen readers', async () => {
  renderInRouter(<InboxSkeleton />)

  await waitFor(() => {
    expect(document.querySelectorAll('li')).toHaveLength(6)
  })
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})
