import {useMemo} from 'react'

import {usePullRequestGroups} from '@/diffs/components/hooks/use-pull-request-groups'
import {SEARCH_PAGE_SIZE} from '@/diffs/lib/github-pull-request-search'
import type {PullRequestGroup} from '@/diffs/lib/github-pull-requests'
import {INBOX_REASONS, type InboxItem, type InboxReason} from '@/inbox/lib/inbox-item'

export type InboxItemsStatus = 'idle' | 'loading' | 'error' | 'sign-in-again' | 'loaded'

export interface InboxItemsState {
  status: InboxItemsStatus
  // Each open pull request occurs one time, and the most recent update is first.
  items: InboxItem[]
  // True when GitHub has more open pull requests than the items.
  truncated: boolean
}

// The inbox of the signed-in visitor. While `enabled` is false, the hook sends no request, so the
// page can wait until it knows the GitHub session.
export function useInboxItems(enabled: boolean): InboxItemsState {
  const {status, groups} = usePullRequestGroups(enabled)
  return useMemo(
    () => ({status, items: readInboxItems(groups), truncated: groups.some(isGroupTruncated)}),
    [status, groups],
  )
}

function readInboxItems(groups: readonly PullRequestGroup[]): InboxItem[] {
  const items = new Map<string, InboxItem>()
  for (const group of groups) {
    for (const pullRequest of group.pullRequests) {
      const key = `${pullRequest.owner.toLowerCase()}/${pullRequest.repo.toLowerCase()}#${pullRequest.number}`
      const reasons = [...(items.get(key)?.reasons ?? []), group.kind]
      items.set(key, {...pullRequest, assignees: [], reasons: sortReasons(reasons)})
    }
  }
  return [...items.values()].toSorted(
    (first, second) => readUpdateTime(second) - readUpdateTime(first),
  )
}

function sortReasons(reasons: readonly InboxReason[]): InboxReason[] {
  return INBOX_REASONS.filter((reason) => reasons.includes(reason))
}

// An item with no update time goes after the items that have one.
function readUpdateTime(item: InboxItem): number {
  const time = item.updatedAt === undefined ? Number.NaN : Date.parse(item.updatedAt)
  return Number.isNaN(time) ? 0 : time
}

// A group drops the rows of an earlier group, but its `totalCount` still counts them. So only a
// count above one search page shows that GitHub has more.
function isGroupTruncated(group: PullRequestGroup): boolean {
  return group.truncated === true || group.totalCount > SEARCH_PAGE_SIZE
}
