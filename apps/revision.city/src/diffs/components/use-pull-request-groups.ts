import {useEffect, useState} from 'react'

import type {
  PullRequestGroup,
  PullRequestGroupKind,
  PullRequestSummary,
} from '@/diffs/lib/github-pull-requests'

const PULL_REQUESTS_ENDPOINT = '/api/diffs/pull-requests'
const GROUP_KINDS: ReadonlySet<string> = new Set(['assigned', 'owned', 'member', 'watched'])

export type PullRequestGroupsStatus = 'idle' | 'loading' | 'error' | 'loaded'

export interface PullRequestGroupsState {
  status: PullRequestGroupsStatus
  groups: PullRequestGroup[]
}

const IDLE_STATE: PullRequestGroupsState = {status: 'idle', groups: []}
const LOADING_STATE: PullRequestGroupsState = {status: 'loading', groups: []}
const ERROR_STATE: PullRequestGroupsState = {status: 'error', groups: []}

// Loads the signed-in visitor's open pull requests once per mount. `enabled`
// keeps the request from firing before the GitHub session is known, so
// signed-out visitors never hit the endpoint.
export function usePullRequestGroups(enabled: boolean): PullRequestGroupsState {
  const [state, setState] = useState<PullRequestGroupsState>(IDLE_STATE)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    setState(LOADING_STATE)
    void fetchPullRequestGroups().then((loaded) => {
      if (!cancelled) {
        setState(loaded)
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}

async function fetchPullRequestGroups(): Promise<PullRequestGroupsState> {
  try {
    const response = await fetch(PULL_REQUESTS_ENDPOINT, {cache: 'no-store'})
    if (!response.ok) {
      return ERROR_STATE
    }

    const data: unknown = await response.json()
    if (!isRecord(data) || !Array.isArray(data.groups)) {
      return ERROR_STATE
    }
    return {
      status: 'loaded',
      groups: data.groups
        .map((group) => parseGroup(group))
        .filter((group): group is PullRequestGroup => group !== undefined),
    }
  } catch {
    return ERROR_STATE
  }
}

function parseGroup(value: unknown): PullRequestGroup | undefined {
  if (
    !isRecord(value) ||
    typeof value.kind !== 'string' ||
    !GROUP_KINDS.has(value.kind) ||
    !Array.isArray(value.pullRequests)
  ) {
    return undefined
  }
  return {
    kind: value.kind as PullRequestGroupKind,
    pullRequests: value.pullRequests
      .map((pullRequest) => parseSummary(pullRequest))
      .filter((pullRequest): pullRequest is PullRequestSummary => pullRequest !== undefined),
    totalCount: typeof value.totalCount === 'number' ? value.totalCount : 0,
    truncated: value.truncated === true ? true : undefined,
  }
}

function parseSummary(value: unknown): PullRequestSummary | undefined {
  if (
    !isRecord(value) ||
    typeof value.owner !== 'string' ||
    typeof value.repo !== 'string' ||
    typeof value.number !== 'number' ||
    typeof value.title !== 'string'
  ) {
    return undefined
  }
  return {
    owner: value.owner,
    repo: value.repo,
    number: value.number,
    title: value.title,
    author: typeof value.author === 'string' ? value.author : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    draft: value.draft === true,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
