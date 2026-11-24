import {IconBrandGithub} from '@pierre/icons'
import {Link} from '@tanstack/react-router'
import {type ReactNode, useMemo, useSyncExternalStore} from 'react'

import {css, cx} from 'styled-system/css'

import {SiteMark} from '@/components/site-mark'
import {
  type GitHubSession,
  getCurrentReturnPath,
  getGitHubLoginURL,
  useGitHubSession,
} from '@/diffs/components/hooks/use-github-session'
import {Button} from '@/diffs/components/ui/button'
import {type InboxItemsState, useInboxItems} from '@/inbox/components/hooks/use-inbox-items'

import {InboxList, InboxSkeleton, listSurfaceClass} from './inbox-list'

const pageClass = css({display: 'flex', minH: 'svh', flexDirection: 'column', alignItems: 'center'})

const mainClass = css({w: '4xl', maxW: 'screen', px: '6', py: '8'})

const headerClass = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: '6',
  rowGap: '2',
  mb: '6',
})

const headingClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1.5',
  fontSize: '2xl',
  lineHeight: '[2rem]',
  fontWeight: 'semibold',
  letterSpacing: 'tight',
})

const headerLinksClass = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  columnGap: '4',
  rowGap: '1',
  color: 'diffs.muted.foreground',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
})

const summaryClass = css({
  display: 'block',
  mb: '3',
  minH: '[1.25rem]',
  color: 'diffs.muted.foreground',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
  textWrap: '[pretty]',
})

const panelClass = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '1',
  px: '4',
  py: '5',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
})

const panelTitleClass = css({fontWeight: 'medium', textWrap: '[pretty]'})

const panelTextClass = css({
  maxW: '[65ch]',
  color: 'diffs.muted.foreground',
  textWrap: '[pretty]',
})

const panelActionClass = css({mt: '3'})

// The page updates the times of the rows at this interval, also when the list does not load again.
const CLOCK_TICK_MS = 30_000

export function InboxPage() {
  const session = useGitHubSession()
  const inbox = useInboxItems(session.status === 'authenticated')
  const clockTime = useSyncExternalStore(subscribeToClock, readClock, readClock)
  const now = useMemo(() => new Date(clockTime), [clockTime])
  return <InboxView session={session} inbox={inbox} now={now} />
}

function subscribeToClock(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, CLOCK_TICK_MS)
  return () => {
    window.clearInterval(timer)
  }
}

// Whole seconds, so that the reads in one render give the same value, except at the start of a new
// second.
function readClock(): number {
  return Math.floor(Date.now() / 1000) * 1000
}

interface InboxViewProps {
  session: GitHubSession
  inbox: InboxItemsState
  now: Date
}

export function InboxView({session, inbox, now}: InboxViewProps) {
  return (
    <div className={pageClass}>
      <main className={mainClass}>
        <header className={headerClass}>
          <h1 className={headingClass}>
            <SiteMark />
            Inbox
          </h1>
          <div className={headerLinksClass}>
            <Link to="/diffs" className="inline-link">
              Open a diff URL
            </Link>
            {session.status === 'authenticated' ? (
              <span>
                <span className={css({srOnly: true})}>Signed in as </span>
                {session.login}
              </span>
            ) : null}
          </div>
        </header>
        <InboxContent session={session} inbox={inbox} now={now} />
      </main>
    </div>
  )
}

function InboxContent({session, inbox, now}: InboxViewProps) {
  if (session.status === 'anonymous') {
    return <SignedOutPanel />
  }
  if (session.status === 'loading' || inbox.status === 'idle' || inbox.status === 'loading') {
    return (
      <>
        <output className={summaryClass}>
          <span className={css({srOnly: true})}>Loading your open pull requests</span>
        </output>
        <InboxSkeleton />
      </>
    )
  }
  if (inbox.status === 'sign-in-again') {
    return (
      <Panel title="GitHub rejected your sign-in. Sign in again.">
        <Button type="button" size="sm" className={panelActionClass} onClick={navigateToLogin}>
          <IconBrandGithub className={css({w: '3.5', h: '3.5', mr: '1.5'})} />
          Sign in again
        </Button>
      </Panel>
    )
  }
  if (inbox.status === 'error') {
    return (
      <Panel title="GitHub could not list your pull requests just now.">
        <p className={panelTextClass}>Come back to this tab after a minute to try again.</p>
      </Panel>
    )
  }
  if (inbox.items.length === 0) {
    return (
      <Panel title="No open pull requests">
        <p className={panelTextClass}>
          Right now no pull request is assigned to you or open in your repositories, your
          organizations or the repositories you watch.
        </p>
        <Button asChild variant="outline" size="sm" className={panelActionClass}>
          <Link to="/diffs">Open a diff URL</Link>
        </Button>
      </Panel>
    )
  }
  return (
    <>
      <output className={summaryClass}>{readSummary(inbox)}</output>
      <InboxList items={inbox.items} now={now} />
    </>
  )
}

function readSummary({items, isTruncated}: InboxItemsState): string {
  const count = items.length === 1 ? '1 open pull request' : `${items.length} open pull requests`
  return isTruncated
    ? `${count}. GitHub has more, so the list shows the most recently updated.`
    : count
}

function SignedOutPanel() {
  return (
    <Panel title="Sign in to see your inbox">
      <p className={panelTextClass}>
        The inbox lists the open pull requests that are assigned to you or that are in your
        repositories, your organizations and the repositories you watch.
      </p>
      <Button type="button" size="sm" className={panelActionClass} onClick={navigateToLogin}>
        <IconBrandGithub className={css({w: '3.5', h: '3.5', mr: '1.5'})} />
        Sign in with GitHub
      </Button>
    </Panel>
  )
}

interface PanelProps {
  title: string
  children: ReactNode
}

function Panel({title, children}: PanelProps) {
  return (
    <section className={cx(listSurfaceClass, panelClass)}>
      <p className={panelTitleClass}>{title}</p>
      {children}
    </section>
  )
}

function navigateToLogin(): void {
  window.location.assign(getGitHubLoginURL(getCurrentReturnPath()))
}
