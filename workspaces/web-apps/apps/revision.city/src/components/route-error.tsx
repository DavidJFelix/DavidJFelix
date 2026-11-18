import {IconCiWarningFill} from '@pierre/icons'
import {type ErrorComponentProps, useRouter} from '@tanstack/react-router'

import {css} from 'styled-system/css'
import {Button} from '@/diffs/components/ui/button'

// The panel must not read data: an error here falls through to the router's
// stock panel. It also does not show the error text, which is for Sentry.
export function RouteError({reset}: ErrorComponentProps) {
  const router = useRouter()
  const tryAgain = () => {
    reset()
    void router.invalidate()
  }

  return (
    <div
      className={css({
        display: 'flex',
        minH: '[100dvh]',
        alignItems: 'center',
        justifyContent: 'center',
        p: '6',
        bg: 'diffs.background',
      })}
    >
      <section
        role="alert"
        className={css({
          w: 'full',
          maxW: 'md',
          p: '5',
          textAlign: 'center',
        })}
      >
        <IconCiWarningFill
          aria-hidden="true"
          className={css({
            color: 'diffs.muted.foreground',
            mx: 'auto',
            mb: '3',
            w: '5',
            h: '5',
          })}
        />
        <h2
          className={css({
            color: 'diffs.foreground',
            fontSize: 'sm',
            lineHeight: '[1.25rem]',
            fontWeight: 'medium',
          })}
        >
          Couldn’t show this page
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
          Part of the page stopped working. Try again, or reload the page if it keeps happening.
        </p>
        <div className={css({mt: '4', display: 'flex', justifyContent: 'center'})}>
          <Button type="button" onClick={tryAgain}>
            Try again
          </Button>
        </div>
      </section>
    </div>
  )
}
