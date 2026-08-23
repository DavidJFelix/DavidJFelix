import {IconBrandGithub, IconCiWarningFill, IconRefresh} from '@pierre/icons'
import {useEffect, useEffectEvent} from 'react'

import {css, cx} from 'styled-system/css'
import {Button} from '@/diffs/components/button'
import {getCurrentReturnPath, getGitHubLoginURL} from '@/diffs/components/use-github-session'
import type {GitHubAccessRemedy} from '@/diffs/lib/github-access-remedy'
import {isNullish} from '@/diffs/lib/nullish'
import {diffsChromeMapping} from '@/diffs/lib/theme/diffs-chrome-mapping'
import type {ViewerLoadState} from '@/diffs/lib/types'
import {useChromeThemeProps} from './use-chrome-theme-props'

interface DiffsStatusPanelProps {
  errorMessage: string | null
  // The one step that unblocks this failure, when the server could work one
  // out. Rendered as the panel's primary action.
  remedy: GitHubAccessRemedy | null
  onRetry(): void
  state: ViewerLoadState
}

export function DiffsStatusPanel({errorMessage, onRetry, remedy, state}: DiffsStatusPanelProps) {
  // Mirror the rest of the diffs chrome so the loading screen sits on the
  // active Shiki theme's surface instead of the global light/dark palette.
  // Mounted before the viewer is available, so we lean on the same provider
  // useChromeThemeProps the header/sidebar use — the controller source keeps the
  // last-resolved theme, so this stays on-palette without flashing the default.
  const {style: chromeStyle} = useChromeThemeProps(diffsChromeMapping)
  const themeChromeStyle = Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined
  const isError = state === 'error'
  const isGrantingAccess = isError && remedy?.kind === 'grant-repo-access'
  useReloadOnReturn({enabled: isGrantingAccess, onRetry})
  const title = isError
    ? 'Couldn’t load diff'
    : state === 'parsing'
      ? 'Preparing diff'
      : state === 'fetching'
        ? 'Fetching diff'
        : 'Streaming diff'

  const message = isError
    ? (errorMessage ?? 'Failed to fetch the diff, please try again.')
    : state === 'parsing'
      ? 'Parsing the patch and building the file tree…'
      : state === 'fetching'
        ? 'Fetching the patch from GitHub…'
        : 'Reading the patch and showing files as they arrive…'

  return (
    <div
      className={cx(
        css({
          gridColumn: '1 / -1',
          display: 'flex',
          minH: '0',
          alignItems: 'center',
          justifyContent: 'center',
          p: '6',
        }),
        isNullish(themeChromeStyle) && css({bg: 'diffs.background'}),
      )}
      style={themeChromeStyle}
    >
      <section
        role={isError ? 'alert' : 'status'}
        aria-live="polite"
        aria-busy={!isError || undefined}
        className={css({
          w: 'full',
          maxW: 'md',
          p: '5',
          textAlign: 'center',
        })}
      >
        {!isError ? (
          <IconRefresh
            aria-hidden="true"
            className={css({
              color: 'diffs.muted.foreground',
              mx: 'auto',
              mb: '3',
              w: '5',
              h: '5',
              transform: 'scaleX(-1)',
              animation: '[spin 1s linear infinite reverse]',
            })}
          />
        ) : (
          <IconCiWarningFill
            className={css({
              color: 'diffs.muted.foreground',
              mx: 'auto',
              mb: '3',
              w: '5',
              h: '5',
            })}
          />
        )}
        <h2
          className={css({
            color: 'diffs.foreground',
            fontSize: 'sm',
            lineHeight: '[1.25rem]',
            fontWeight: 'medium',
          })}
        >
          {title}
        </h2>
        <p
          className={css({
            color: 'diffs.muted.foreground',
            mt: '1',
            fontSize: 'sm',
            lineHeight: '[1.25rem]',
            textWrap: '[pretty]',
          })}
        >
          {message}
        </p>
        {isError && (
          <div
            className={css({
              mt: '4',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2',
            })}
          >
            <RemedyButton remedy={remedy} />
            <Button
              type="button"
              variant={isNullish(remedy) ? 'default' : 'outline'}
              onClick={onRetry}
            >
              Try again
            </Button>
          </div>
        )}
        {isGrantingAccess && (
          <p
            className={css({
              color: 'diffs.muted.foreground',
              mt: '3',
              fontSize: '[13px]',
              textWrap: '[pretty]',
            })}
          >
            Come back to this tab when you’re done — the diff reloads on its own.
          </p>
        )}
      </section>
    </div>
  )
}

function RemedyButton({remedy}: {remedy: GitHubAccessRemedy | null}) {
  if (isNullish(remedy)) {
    return null
  }

  if (remedy.kind === 'grant-repo-access') {
    // A new tab keeps the reader's place in the diff: granting access on GitHub
    // can take a detour through an owner approval, and coming back to a live
    // page beats coming back to a lost one.
    return (
      <Button asChild>
        <a href={remedy.url} target="_blank" rel="noreferrer">
          <IconBrandGithub className={css({w: '3.5', h: '3.5'})} />
          Grant access on GitHub
        </a>
      </Button>
    )
  }

  return (
    <Button type="button" onClick={navigateToLogin}>
      <IconBrandGithub className={css({w: '3.5', h: '3.5'})} />
      {remedy.kind === 'sign-in' ? 'Sign in with GitHub' : 'Sign in again'}
    </Button>
  )
}

// Granting access happens on github.com, in another tab, and GitHub has no way
// to tell this page when it is done. Coming back to the tab is the signal: the
// only reason to return to a blocked diff is to see whether it works now, so
// retry on the way in rather than making the reader ask twice.
function useReloadOnReturn({enabled, onRetry}: {enabled: boolean; onRetry(): void}): void {
  const retry = useEffectEvent(() => {
    onRetry()
  })
  // Whether the reader has left the tab is listener bookkeeping, not render
  // state: it lives in the effect closure and resets by construction whenever
  // the listener is torn down.
  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    let hasLeft = false
    const trackVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hasLeft = true
        return
      }
      if (hasLeft) {
        hasLeft = false
        retry()
      }
    }
    document.addEventListener('visibilitychange', trackVisibility)
    return () => {
      document.removeEventListener('visibilitychange', trackVisibility)
    }
  }, [enabled])
}

function navigateToLogin(): void {
  window.location.assign(getGitHubLoginURL(getCurrentReturnPath()))
}
