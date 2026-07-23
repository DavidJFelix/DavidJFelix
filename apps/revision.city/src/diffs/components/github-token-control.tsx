// cSpell:ignore lpignore -- LastPass form-fill opt-out attribute
import {IconBrandGithub} from '@pierre/icons'
import {type FormEvent, memo, useState} from 'react'

import {css, cx} from 'styled-system/css'

import {Button} from '@/diffs/components/button'
import {Input} from '@/diffs/components/input'

export const CREATE_TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new?name=Diffs%20Private%20Repo%20Read%20Access&description=Read+private+PRs+and+expand+collapsed+hunks&expires_in=90&contents=read&pull_requests=read&issues=read'

export const CLASSIC_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Diffs%20Private%20Repo%20Read%20Access&scopes=repo&default_expires_at=90'

interface GitHubTokenControlProps {
  active: boolean
  className?: string
  onClear(): void
  onSave(token: string): void
  title?: string
}

export const GitHubTokenControl = memo(function GitHubTokenControl({
  active,
  className,
  onClear,
  onSave,
  title = 'GitHub Token',
}: GitHubTokenControlProps) {
  const [draftToken, setDraftToken] = useState('')
  const canSave = draftToken.trim() !== ''
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) {
      return
    }
    onSave(draftToken)
    setDraftToken('')
  }

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
            active
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
          {active ? 'Active' : 'Optional'}
        </span>
      </div>
      {active ? (
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
            Using your PAT from localStorage. Clear it to create a new one.
          </p>
          <div
            className={css({
              mt: '2',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            })}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraftToken('')
                onClear()
              }}
            >
              Clear saved token
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
            <a
              className="inline-link"
              href={CREATE_TOKEN_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Create a fine-grained PAT
            </a>{' '}
            on GitHub to view private diffs, or{' '}
            <a
              className="inline-link"
              href={CLASSIC_TOKEN_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              a classic token
            </a>{' '}
            with repo scope. Saved only in localStorage.
          </p>
          <form className={css({mt: '2', display: 'flex', gap: '1.5'})} onSubmit={handleSubmit}>
            <Input
              className={css({bg: 'diffs.background', flex: '1'})}
              inputSize="sm"
              type="password"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              placeholder="Paste token"
              value={draftToken}
              onChange={({currentTarget}) => setDraftToken(currentTarget.value)}
            />
            <Button type="submit" size="sm" disabled={!canSave}>
              Save
            </Button>
          </form>
        </>
      )}
    </section>
  )
})
