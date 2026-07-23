import {IconCiWarningFill, IconRefresh} from '@pierre/icons'

import {css, cx} from 'styled-system/css'
import {Button} from '@/diffs/components/Button'
import {isNullish} from '@/diffs/lib/nullish'
import {diffsChromeMapping} from '@/diffs/lib/theme/diffs-chrome-mapping'
import type {ViewerLoadState} from '@/diffs/lib/types'
import {useChromeThemeProps} from './use-chrome-theme-props'

interface DiffsStatusPanelProps {
  errorMessage: string | null
  onRetry(): void
  state: ViewerLoadState
}

export function DiffsStatusPanel({errorMessage, onRetry, state}: DiffsStatusPanelProps) {
  // Mirror the rest of the diffs chrome so the loading screen sits on the
  // active Shiki theme's surface instead of the global light/dark palette.
  // Mounted before the viewer is available, so we lean on the same provider
  // useChromeThemeProps the header/sidebar use — the controller source keeps the
  // last-resolved theme, so this stays on-palette without flashing the default.
  const {style: chromeStyle} = useChromeThemeProps(diffsChromeMapping)
  const themeChromeStyle = Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined
  const isError = state === 'error'
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
              animation: 'spin 1s linear infinite reverse',
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
            lineHeight: '1.25rem',
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
            lineHeight: '1.25rem',
            textWrap: 'pretty',
          })}
        >
          {message}
        </p>
        {isError && (
          <Button type="button" className={css({mt: '4'})} onClick={onRetry}>
            Try again
          </Button>
        )}
      </section>
    </div>
  )
}
