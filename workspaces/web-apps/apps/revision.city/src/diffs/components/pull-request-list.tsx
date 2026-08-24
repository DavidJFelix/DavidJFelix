import {IconArrowRightShort} from '@pierre/icons'
import {Link} from '@tanstack/react-router'
import {memo} from 'react'

import {css} from 'styled-system/css'

import {useGitHubSession} from '@/diffs/components/hooks/use-github-session'
import {usePullRequestGroups} from '@/diffs/components/hooks/use-pull-request-groups'
import type {
  PullRequestGroup,
  PullRequestGroupKind,
  PullRequestSummary,
} from '@/diffs/lib/github-pull-requests'

const GROUP_TITLES: Record<PullRequestGroupKind, string> = {
  assigned: 'Assigned to you',
  owned: 'In your repositories',
  member: 'In repositories you belong to',
  watched: 'In repositories you watch',
}

const mutedTextClass = css({
  color: 'diffs.muted.foreground',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
})

// The signed-in visitor's open pull requests, grouped by why they can reach
// them. Renders nothing for signed-out visitors, so the home page stays
// unchanged until a session exists.
export const PullRequestList = memo(function PullRequestList() {
  const session = useGitHubSession()
  const state = usePullRequestGroups(session.status === 'authenticated')
  if (session.status !== 'authenticated' || state.status === 'idle') {
    return null
  }

  if (state.status === 'loading') {
    return <p className={mutedTextClass}>Loading your open pull requests…</p>
  }

  if (state.status === 'error') {
    return <p className={mutedTextClass}>GitHub could not list your pull requests just now.</p>
  }

  const groups = state.groups.filter((group) => group.pullRequests.length > 0)
  if (groups.length === 0) {
    return <p className={mutedTextClass}>No open pull requests in your reach right now.</p>
  }

  return (
    <div className={css({'& > * + *': {mt: '3'}})}>
      {groups.map((group) => (
        <PullRequestGroupSection key={group.kind} group={group} />
      ))}
    </div>
  )
})

function PullRequestGroupSection({group}: {group: PullRequestGroup}) {
  return (
    <section aria-label={GROUP_TITLES[group.kind]} className={css({'& > * + *': {mt: '2'}})}>
      <h3
        className={css({
          color: 'diffs.muted.foreground',
          fontSize: 'sm',
          lineHeight: '[1.25rem]',
          fontWeight: 'normal',
        })}
      >
        {GROUP_TITLES[group.kind]}
        {group.totalCount > group.pullRequests.length ? (
          <span className={css({opacity: '0.7'})}>
            {' '}
            · {group.pullRequests.length} of {group.totalCount}
          </span>
        ) : null}
      </h3>
      <ul
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
          fontSize: 'sm',
          lineHeight: '[1.25rem]',
        })}
      >
        {group.pullRequests.map((pullRequest) => (
          <PullRequestRow
            key={`${pullRequest.owner}/${pullRequest.repo}#${pullRequest.number}`}
            pullRequest={pullRequest}
          />
        ))}
      </ul>
    </section>
  )
}

function DraftBadge() {
  return (
    <span
      className={css({
        color: 'diffs.muted.foreground',
        rounded: 'full',
        borderWidth: '1px',
        borderColor: '[color-mix(in oklab, currentcolor 20%, transparent)]',
        px: '1.5',
        py: '0.5',
        fontSize: '[10px]',
        lineHeight: 'none',
        letterSpacing: 'wide',
        textTransform: 'uppercase',
        verticalAlign: 'middle',
      })}
    >
      Draft
    </span>
  )
}

function PullRequestRow({pullRequest}: {pullRequest: PullRequestSummary}) {
  return (
    <li
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: '1',
      })}
    >
      <IconArrowRightShort className={css({mt: '0.5', flexShrink: '0', opacity: '0.5'})} />
      <div className={css({minW: '0'})}>
        <Link
          to="/diffs/$"
          params={{_splat: `${pullRequest.owner}/${pullRequest.repo}/pull/${pullRequest.number}`}}
          className="inline-link"
        >
          {pullRequest.title}
        </Link>{' '}
        {pullRequest.draft ? <DraftBadge /> : null}
        <span
          className={css({
            color: 'diffs.muted.foreground',
            display: 'block',
            fontFamily: 'diffs.mono',
            fontSize: 'xs',
            lineHeight: '[1rem]',
            letterSpacing: 'tight',
            truncate: true,
          })}
        >
          {pullRequest.owner}/{pullRequest.repo}#{pullRequest.number}
        </span>
      </div>
    </li>
  )
}
