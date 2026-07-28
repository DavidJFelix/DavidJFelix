import {createFileRoute} from '@tanstack/react-router'
import {useState} from 'react'

import {css, cx} from 'styled-system/css'
import {button, field} from 'styled-system/recipes'

import {Button} from '@/components/Button.tsx'
import {subscribeToNewsletter} from '@/lib/newsletter.ts'

export const Route = createFileRoute('/')({
  component: ComingSoonPage,
})

const dot = css({width: '3', height: '3', borderRadius: 'full'})

// A quiet nod to the design system's pigment tray.
const PIGMENT_DOTS = [
  cx(dot, css({bg: 'pigment.rose'})),
  cx(dot, css({bg: 'pigment.butter'})),
  cx(dot, css({bg: 'pigment.sage'})),
  cx(dot, css({bg: 'pigment.sky'})),
]

const SOCIAL_LINKS = [
  ['Follow on Instagram', 'https://www.instagram.com/forzamonica', InstagramIcon],
  ['Follow on Facebook', 'https://www.facebook.com/forzamonica', FacebookIcon],
] as const

const socialLink = css({
  display: 'inline-flex',
  p: '2.5',
  color: 'ink.muted',
  transition: 'color token(durations.quick) token(easings.out)',
  _hover: {color: 'ink'},
})

// Pre-launch landing: the brand mark, ways to follow along, the current shop,
// and the mailing list, in the shop's theme. The storefront itself lives at
// /monica until launch.
function ComingSoonPage() {
  return (
    <section
      className={css({
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6',
        px: '6',
        py: '16',
        textAlign: 'center',
      })}
    >
      <h1 className={css({textStyle: 'displayXl', color: 'ink'})}>
        forzamonica <span className={css({fontStyle: 'normal', fontWeight: 'normal'})}>art</span>
      </h1>
      <nav aria-label="Follow Monica" className={css({display: 'flex', gap: '1'})}>
        {SOCIAL_LINKS.map(([label, href, Icon]) => (
          <a key={href} href={href} aria-label={label} className={socialLink}>
            <Icon />
          </a>
        ))}
      </nav>
      <a href="https://www.forzamonica.shop/" className={button()}>
        Shop the current collection
      </a>
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3',
          mt: '4',
          width: 'full',
        })}
      >
        <p className={css({fontSize: '16px', color: 'ink.muted'})}>
          Watercolors by Monica Felix — coming soon.
        </p>
        <NewsletterSignup />
      </div>
      <div className={css({display: 'flex', gap: '2.5', mt: '4'})}>
        {PIGMENT_DOTS.map((dotClass) => (
          <span key={dotClass} className={dotClass} />
        ))}
      </div>
    </section>
  )
}

type SignupStatus = 'idle' | 'sending' | 'subscribed' | 'error'

// Reads as a continuation of the coming-soon line above it. The submit runs
// through the newsletter server function (Loops API, key server-side) and
// fails soft into the error state until the key is configured -- see
// src/lib/newsletter.ts.
function NewsletterSignup() {
  const [status, setStatus] = useState<SignupStatus>('idle')
  const fieldClasses = field()

  return (
    <div
      aria-live="polite"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
        alignItems: 'center',
        width: 'full',
        maxWidth: '420px',
      })}
    >
      <p className={css({fontSize: '15px', color: 'ink.muted'})}>
        Subscribe to my mailing list to hear about upcoming shows and new paintings.
      </p>
      {status === 'subscribed' ? (
        <p className={css({fontSize: '15px', fontWeight: 'bold', color: 'success'})}>
          Thank you — you're on the list.
        </p>
      ) : (
        <form
          className={css({display: 'flex', flexDirection: 'column', gap: '2.5', width: 'full'})}
          onSubmit={(event) => {
            event.preventDefault()
            const email = new FormData(event.currentTarget).get('email')
            if (typeof email !== 'string' || email === '') return
            setStatus('sending')
            void subscribeToNewsletter({data: {email}}).then((subscribed) =>
              setStatus(subscribed ? 'subscribed' : 'error'),
            )
          }}
        >
          <div
            className={css({
              display: 'flex',
              flexDirection: {base: 'column', sm: 'row'},
              alignItems: 'stretch',
              gap: '2.5',
              width: 'full',
            })}
          >
            <input
              type="email"
              name="email"
              required
              aria-label="Email address"
              placeholder="you@example.com"
              className={cx(fieldClasses.control, css({flex: '1'}))}
            />
            <Button type="submit" disabled={status === 'sending'}>
              Subscribe
            </Button>
          </div>
          {status === 'error' ? (
            <p className={css({fontSize: '13px', color: 'error'})}>
              Something went wrong — please try again in a moment.
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}

// Feather-style outline marks (MIT) drawn inline; currentColor keeps them in
// the link's ink.
function InstagramIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}
