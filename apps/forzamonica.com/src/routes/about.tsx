import {createFileRoute, Link} from '@tanstack/react-router'

import {css, cx} from 'styled-system/css'
import {button} from 'styled-system/recipes'

export const Route = createFileRoute('/about')({
  head: () => ({meta: [{title: 'About — forzamonica art'}]}),
  component: AboutPage,
})

function AboutPage() {
  return (
    <section className={css({maxWidth: '780px', mx: 'auto', px: '6', pt: '14', pb: '6'})}>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: {base: '1fr', sm: '200px 1fr'},
          gap: '10',
          alignItems: 'start',
        })}
      >
        <div
          className={css({
            width: '200px',
            height: '200px',
            borderRadius: 'full',
            background:
              'repeating-linear-gradient(45deg, token(colors.paper.shade) 0 10px, #e4eaee 10px 20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <span
            className={css({
              fontFamily: 'mono',
              fontSize: '12px',
              color: 'ink.muted',
              bg: 'paper',
              px: '2.5',
              py: '1',
              borderRadius: '6px',
            })}
          >
            photo of Monica
          </span>
        </div>
        <div className={css({display: 'flex', flexDirection: 'column', gap: '4'})}>
          <h1 className={css({textStyle: 'displayXl', color: 'ink'})}>Hi, I'm Monica</h1>
          <p className={css({fontSize: '16px', lineHeight: '1.6', color: 'ink.muted'})}>
            I'm a watercolor painter, and this shop is my studio's front door. Everything in it is
            painted, scanned, printed, and packed by me.
          </p>
          <p className={css({fontSize: '16px', lineHeight: '1.6', color: 'ink.muted'})}>
            Prints are made on archival cotton paper. Originals are one-of-one and ship with a
            certificate and a handwritten note.
          </p>
          <Link
            to="/commissions"
            className={cx(button({visual: 'secondary'}), css({alignSelf: 'flex-start'}))}
          >
            Ask about a commission
          </Link>
        </div>
      </div>
    </section>
  )
}
