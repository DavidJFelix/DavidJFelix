import {createFileRoute, Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'
import {button} from 'styled-system/recipes'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <section
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6',
        py: '20',
      })}
    >
      <h1
        className={css({
          fontSize: '5xl',
          fontWeight: 'bold',
          letterSpacing: 'tight',
          lineHeight: 'tight',
        })}
      >
        Forza Monica
      </h1>
      <p className={css({fontSize: 'xl', color: 'fg.muted', maxWidth: 'prose'})}>
        The official shop. Built for speed.
      </p>
      <Link to="/products" className={button({size: 'md'})}>
        Shop the collection
      </Link>
    </section>
  )
}
