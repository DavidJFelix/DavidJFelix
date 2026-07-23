import {IconArrow, IconArrowRightShort} from '@pierre/icons'
import {createFileRoute, Link} from '@tanstack/react-router'
import {memo} from 'react'

import {css, cx} from 'styled-system/css'

import {Button} from '@/diffs/components/Button'
import {DiffUrlForm} from '@/diffs/components/DiffUrlForm'
import {GitHubTokenControl} from '@/diffs/components/GitHubTokenControl'
import {useGitHubToken} from '@/diffs/components/use-github-token'

export const Route = createFileRoute('/diffs/')({
  component: DiffsHomePage,
})

const diffLineBadge = css.raw({
  display: 'inline-flex',
  roundedRight: '0.25rem',
  py: '0.0625rem',
  pr: '1.5',
  pl: '1.5',
})

const deletedBadgeClass = css(diffLineBadge, {
  bg: 'rgb(255 103 98 / 0.15)',
  color: '#ff2e3f',
  _dark: {bg: 'rgb(255 103 98 / 0.1)', color: '#ff6762'},
})

const addedBadgeClass = css(diffLineBadge, {
  bg: 'rgb(7 196 128 / 0.15)',
  color: '#18a46c',
  _dark: {bg: 'rgb(7 196 128 / 0.1)', color: '#07c480'},
})

function Divider() {
  return <hr className={css({my: '8', maxW: '80px', opacity: '0.5'})} />
}

const EXAMPLE_URLS = [
  'oven-sh/bun/pull/30412',
  'nodejs/node/pull/59805',
  'ghostty-org/ghostty/pull/12291',
] as const

function DiffsHomePage() {
  return (
    <div
      className={css({
        display: 'flex',
        minH: '100svh',
        minW: '100vw',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bg: {md: 'var(--diffs-sidebar-bg)'},
        py: {md: '12'},
      })}
    >
      <section
        className={css({
          position: 'relative',
          display: {base: 'flex', md: 'block'},
          minH: {base: '100svh', md: '0'},
          w: '2xl',
          maxW: '100vw',
          flexDirection: 'column',
          justifyContent: 'center',
          '& > * + *': {mt: '4'},
          px: '6',
          pt: '8',
          fontSize: 'sm',
          lineHeight: '1.25rem',
          '@media (min-width: 340px)': {fontSize: 'base', lineHeight: '1.5rem'},
        })}
      >
        <h2
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '1.5',
            fontSize: '2xl',
            lineHeight: '2rem',
            fontWeight: 'semibold',
            letterSpacing: 'tight',
          })}
        >
          Diffs
        </h2>
        <p className={css({color: 'diffs.muted.foreground', textWrap: 'pretty'})}>
          View code changes from any public GitHub diff—PRs, comparisons,
          commits, diffs, and patches—with a super-freaking-fast, beautiful, and
          virtualized interface by putting <code>revision.city/diffs/</code> in
          front of any <code>github.com</code> path.
        </p>
        <div
          className={css({
            color: 'diffs.muted.foreground',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontFamily: 'diffs.mono',
            lineHeight: '22px',
            letterSpacing: 'tight',
          })}
        >
          <code
            className={cx(
              'diffs-border-deleted',
              css({roundedLeft: '0.25rem', fontWeight: 'normal', color: 'inherit'}),
            )}
          >
            <span className={css({minW: '0', truncate: true})}>
              <code className={deletedBadgeClass}>- github</code>
              .com/org/repo/pull/number
            </span>
          </code>
          <code
            className={css({
              truncate: true,
              roundedLeft: '0.25rem',
              borderLeftWidth: '4px',
              borderColor: '#07c480',
              fontWeight: 'normal',
              color: 'inherit',
            })}
          >
            <code className={addedBadgeClass}>+ revision.city/diffs</code>
            /org/repo/pull/number
          </code>
        </div>
        <div
          className={css({
            bg: {base: 'diffs.accent', md: 'diffs.background'},
            overflow: 'hidden',
            rounded: 'diffs.lg',
            borderWidth: '1px',
            my: {md: '6'},
          })}
        >
          <HomeFetchForm />
          <HomeGitHubTokenForm />
        </div>
        <div className={css({'& > * + *': {mt: '2'}})}>
          <h3
            className={css({
              color: 'diffs.muted.foreground',
              fontSize: 'sm',
              lineHeight: '1.25rem',
              fontWeight: 'normal',
            })}
          >
            Enter a URL above, or use one of these:
          </h3>
          <ul
            className={css({
              mb: '5',
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
              fontSize: 'sm',
              lineHeight: '1.25rem',
            })}
          >
            {EXAMPLE_URLS.map((url) => (
              <li
                key={url}
                className={css({
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  gap: '1',
                })}
              >
                <IconArrowRightShort
                  className={css({mt: '0.5', flexShrink: '0', opacity: '0.5'})}
                />
                <div>
                  <Link to="/diffs/$" params={{_splat: url}} className="inline-link">
                    <span className={css({display: {base: 'none', md: 'inline'}})}>
                      https://github.com/
                    </span>
                    {url}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <p
            className={css({
              color: 'diffs.muted.foreground',
              display: {base: 'none', md: 'block'},
              fontSize: 'sm',
              lineHeight: '1.25rem',
            })}
          >
            You can also compare millions of lines with ease, like{' '}
            <Link
              to="/diffs/$"
              params={{_splat: 'torvalds/linux/compare/v6.0...v7.0'}}
              className="inline-link"
            >
              v6...v7 of Linux
            </Link>
            . This sometimes crashes mobile browsers, and GitHub unreliably
            serves diffs over 100k lines with a delayed first byte.
          </p>
        </div>
      </section>
      <section
        id="home-more"
        className={css({
          w: '2xl',
          maxW: '100vw',
          '& > * + *': {mt: '4'},
          px: '5',
          pb: '8',
        })}
      >
        <Divider />
        <p
          className={css({
            color: 'diffs.muted.foreground',
            fontSize: 'sm',
            lineHeight: '1.25rem',
            textWrap: 'pretty',
          })}
        >
          Powered by Pierre&apos;s open source{' '}
          <a
            href="https://trees.software/docs#react-api-filetree"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-link"
          >
            FileTree
          </a>{' '}
          and{' '}
          <a
            href="https://diffs.com/docs#codeview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-link"
          >
            CodeView
          </a>{' '}
          components.
        </p>
      </section>
    </div>
  )
}

// Submitting the home form should move to the shareable viewer URL first. The
// viewer route owns fetching and renders its own loading state there.
const HomeFetchForm = memo(function HomeFetchForm() {
  return (
    <div className={css({px: '4'})}>
      <DiffUrlForm
        placeholder="https://github.com/org/repo/123"
        inputClassName={css({
          fontSize: '1rem',
          h: '12',
          w: 'full',
          textAlign: 'start',
        })}
      >
        {(isPending, url) => (
          <Button
            type="submit"
            variant="ghost"
            size="icon-md"
            disabled={isPending || url.length === 0}
            aria-label={isPending ? 'Fetching…' : 'Fetch'}
            className={css({
              mr: '-2',
              '&[data-slot="button"]': {
                _hover: {color: 'diffs.muted.foreground', bg: 'transparent'},
              },
            })}
          >
            <IconArrow
              className={css({w: '4', h: '4', transform: 'rotate(180deg)'})}
            />
          </Button>
        )}
      </DiffUrlForm>
    </div>
  )
})

const HomeGitHubTokenForm = memo(function HomeGitHubTokenForm() {
  const {clearToken, hasToken, setToken} = useGitHubToken()
  return (
    <GitHubTokenControl
      active={hasToken}
      className={css({
        borderColor: 'diffs.border/70',
        borderTopWidth: '1px',
        px: '4',
        py: '3',
      })}
      onClear={clearToken}
      onSave={setToken}
      title="Private GitHub access"
    />
  )
})
