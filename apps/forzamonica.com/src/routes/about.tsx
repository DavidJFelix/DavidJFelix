import {createFileRoute, Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'
import {button} from 'styled-system/recipes'

export const Route = createFileRoute('/about')({
  head: () => ({meta: [{title: 'About — Forza Monica'}]}),
  component: AboutPage,
})

// Placeholder brand story until the Forza Monica brand direction is decided
// (see docs/projects/forzamonica-com/plan.md, Phase 3).
function AboutPage() {
  return (
    <section
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '5',
        py: '12',
        maxWidth: 'prose',
      })}
    >
      <h1 className={css({fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight'})}>
        About Forza Monica
      </h1>
      <p className={css({color: 'fg.muted'})}>
        Forza Monica is the official shop. The full story — who we are, what we make, and why —
        lands here soon.
      </p>
      <p className={css({color: 'fg.muted'})}>
        In the meantime, the collection is open. Have a look around.
      </p>
      <Link to="/products" className={button({size: 'md'})}>
        Shop the collection
      </Link>
    </section>
  )
}
