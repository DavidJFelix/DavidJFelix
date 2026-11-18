import type {GitHubAuthOptions} from '@/diffs/lib/github-auth'
import {
  type PullRequestSearchResult,
  searchPullRequests,
} from '@/diffs/lib/github-pull-request-search'
import {
  createPullRequestKey,
  handlePullRequestSearchRequest,
  searchPullRequestGroups,
  type VisitorSearchParams,
} from '@/diffs/lib/github-pull-requests'
import {isNullish} from '@/diffs/lib/nullish'

import {INBOX_REASONS, type InboxItem, type InboxReason} from './inbox-item'

export interface InboxListBody {
  items: InboxItem[]
  // True when the list can miss pull requests: a list of organizations or repositories was cut
  // before its search, or GitHub has more pull requests than a search gave.
  truncated: boolean
}

type InboxSearches = Readonly<Record<InboxReason, PullRequestSearchResult>>

// Lists the open pull requests of the signed-in visitor, each one time with all its reasons, the
// newest update first. The error statuses are the same as for the pull request list.
export function handleInboxListRequest(
  request: Request,
  options: GitHubAuthOptions = {},
): Promise<Response> {
  return handlePullRequestSearchRequest({list: listInbox, options, request})
}

// GitHub lets one user do 30 searches a minute. One inbox load does at most 8: at most 7 for the
// groups of the pull request list, and 1 for the review requests.
async function listInbox(params: VisitorSearchParams): Promise<InboxListBody> {
  const [groups, reviewRequested] = await Promise.all([
    searchPullRequestGroups(params),
    // GitHub also finds a request to a team of the visitor, and drops a request after the visitor
    // reviews: https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests
    searchPullRequests({
      fetcher: params.fetcher,
      qualifiers: ['review-requested:@me'],
      token: params.token,
    }),
  ])
  const searches: InboxSearches = {'review-requested': reviewRequested, ...groups}
  return {
    items: mergeInboxItems(searches),
    truncated: Object.values(searches).some((search) => isSearchCut(search)),
  }
}

function mergeInboxItems(searches: InboxSearches): InboxItem[] {
  const items = new Map<string, InboxItem>()
  for (const reason of INBOX_REASONS) {
    for (const pullRequest of searches[reason].items) {
      const key = createPullRequestKey(pullRequest)
      const item = items.get(key)
      items.set(
        key,
        isNullish(item)
          ? {...pullRequest, reasons: [reason]}
          : {...item, reasons: [...item.reasons, reason]},
      )
    }
  }
  return [...items.values()].toSorted((a, b) => readSortTime(b).localeCompare(readSortTime(a)))
}

// An empty time is less than every ISO 8601 time, so the pull requests with no time come last.
function readSortTime(item: InboxItem): string {
  return item.updatedAt ?? ''
}

function isSearchCut(search: PullRequestSearchResult): boolean {
  return search.truncated === true || search.totalCount > search.items.length
}
