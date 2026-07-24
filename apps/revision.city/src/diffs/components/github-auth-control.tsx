import {IconBrandGithub} from '@pierre/icons'
import {memo} from 'react'

import {css, cx} from 'styled-system/css'

import {Button} from '@/diffs/components/button'
import {
  getGitHubLoginURL,
  getGitHubLogoutURL,
  useGitHubSession,
} from '@/diffs/components/use-github-session'

interface GitHubAuthControlProps {
  className?: string
  title?: string
}

// Sign-in state for the GitHub App session. Sign-in and sign-out are
// full-page navigations through the auth routes, so the diff reloads with the
// new session applied.
export const GitHubAuthControl = memo(function GitHubAuthControl({
  className,
  title = 'GitHub Account',
}: GitHubAuthControlProps) {
  const session = useGitHubSession()
  const authenticated = session.status === 'authenticated'

  return (
    <section className={cx(css({px: '2', py: '1.5'}), className)} aria-label={title}>
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '1.5',
          fontSize: 'sm',
          lineHeight: '1.25rem',
          fontWeight: 'medium',
        })}
      >
        <IconBrandGithub className={css({w: '4', h: '4'})} />
        <span className={css({minW: '0', flex: '1'})}>{title}</span>
        <span
          className={cx(
            css({
              rounded: 'full',
              borderWidth: '1px',
              px: '1.5',
              py: '0.5',
              fontSize: '10px',
              lineHeight: '1',
              letterSpacing: 'wide',
              textTransform: 'uppercase',
            }),
            authenticated
              ? css({
                  borderColor: 'green.600',
                  bg: 'green.500',
                  color: 'white',
                  _dark: {
                    borderColor: 'green.500',
                    bg: 'green.400',
                    color: 'black',
                  },
                })
              : css({
                  color: 'diffs.muted.foreground',
                  borderColor: 'color-mix(in oklab, currentcolor 20%, transparent)',
                }),
          )}
        >
          {authenticated ? 'Signed in' : 'Optional'}
        </span>
      </div>
      {authenticated ? (
        <>
          <p
            className={css({
              color: 'diffs.muted.foreground',
              mt: '1',
              maxW: '31rem',
              fontSize: '13px',
              textWrap: 'pretty',
            })}
          >
            Signed in as <strong>{session.login}</strong>. Private diffs and file expansion use your
            GitHub access.
          </p>
          <div className={css({mt: '2', display: 'flex', alignItems: 'center', gap: '2'})}>
            <Button type="button" variant="outline" size="sm" onClick={navigateToLogout}>
              Sign out
            </Button>
          </div>
        </>
      ) : (
        <>
          <p
            className={css({
              color: 'diffs.muted.foreground',
              mt: '1',
              maxW: '31rem',
              fontSize: '13px',
              textWrap: 'pretty',
            })}
          >
            Sign in with GitHub to view private diffs, expand collapsed context, and raise rate
            limits. Access stays in a secure cookie in this browser.
          </p>
          <div className={css({mt: '2', display: 'flex', alignItems: 'center', gap: '2'})}>
            <Button
              type="button"
              size="sm"
              disabled={session.status === 'loading'}
              onClick={navigateToLogin}
            >
              <IconBrandGithub className={css({w: '3.5', h: '3.5', mr: '1.5'})} />
              Sign in with GitHub
            </Button>
          </div>
        </>
      )}
    </section>
  )
})

function navigateToLogin(): void {
  window.location.assign(getGitHubLoginURL(getCurrentReturnPath()))
}

function navigateToLogout(): void {
  window.location.assign(getGitHubLogoutURL(getCurrentReturnPath()))
}

// The hash never reaches the server, so the round-trip lands on the same
// path and search; line-hash targets are simply dropped.
function getCurrentReturnPath(): string {
  return `${window.location.pathname}${window.location.search}`
}
