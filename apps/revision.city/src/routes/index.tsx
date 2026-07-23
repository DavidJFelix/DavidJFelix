import {createFileRoute, Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const title = 'revision.city'
  const tag = 'version control'
  const eyebrow = 'Reviews + diffs'
  const heading = 'Version control, centered on review.'
  const description = 'A centralized home for managing reviews and diffs as first-class objects.'

  const features = [
    {
      name: 'Reviews',
      body: 'Manage reviews as first-class objects, not afterthoughts.',
      href: undefined,
    },
    {name: 'Diffs', body: 'See and discuss changes with clarity.', href: '/diffs'},
  ] as const

  return (
    <div className={css({minHeight: '100dvh', display: 'flex', flexDirection: 'column'})}>
      <header
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: {base: '6', md: '8'},
          py: '5',
          borderBottomWidth: '1px',
          borderColor: 'neutral.200',
        })}
      >
        <span className={css({fontWeight: 'semibold', fontSize: 'lg', letterSpacing: 'tight'})}>
          {title}
        </span>
        <span className={css({fontSize: 'sm', color: 'neutral.500'})}>{tag}</span>
      </header>

      <main
        className={css({
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: 'full',
          maxWidth: '4xl',
          mx: 'auto',
          px: {base: '6', md: '8'},
          py: {base: '16', md: '24'},
        })}
      >
        <p
          className={css({
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'neutral.500',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
          })}
        >
          {eyebrow}
        </p>
        <h1
          className={css({
            mt: '4',
            fontSize: {base: '4xl', md: '6xl'},
            fontWeight: 'bold',
            letterSpacing: 'tight',
            lineHeight: 'tight',
          })}
        >
          {heading}
        </h1>
        <p
          className={css({
            mt: '6',
            fontSize: {base: 'lg', md: 'xl'},
            color: 'neutral.600',
            maxWidth: '2xl',
            lineHeight: 'relaxed',
          })}
        >
          {description}
        </p>

        <ul
          className={css({
            mt: '12',
            display: 'grid',
            gridTemplateColumns: {base: '1fr', sm: 'repeat(2, 1fr)'},
            gap: '6',
            listStyleType: 'none',
            p: '0',
          })}
        >
          {features.map((f) => {
            const card = (
              <>
                <h2 className={css({fontSize: 'lg', fontWeight: 'semibold'})}>{f.name}</h2>
                <p
                  className={css({
                    mt: '2',
                    fontSize: 'sm',
                    color: 'neutral.600',
                    lineHeight: 'relaxed',
                  })}
                >
                  {f.body}
                </p>
              </>
            )
            const cardStyle = css({
              display: 'block',
              borderWidth: '1px',
              borderColor: 'neutral.200',
              rounded: 'xl',
              p: '6',
            })
            return (
              <li key={f.name}>
                {f.href ? (
                  <Link
                    to={f.href}
                    className={css({
                      display: 'block',
                      borderWidth: '1px',
                      borderColor: 'neutral.200',
                      rounded: 'xl',
                      p: '6',
                      transition: 'border-color 150ms ease',
                      _hover: {borderColor: 'neutral.400'},
                    })}
                  >
                    {card}
                  </Link>
                ) : (
                  <div className={cardStyle}>{card}</div>
                )}
              </li>
            )
          })}
        </ul>
      </main>

      <footer
        className={css({
          px: {base: '6', md: '8'},
          py: '6',
          borderTopWidth: '1px',
          borderColor: 'neutral.200',
          fontSize: 'sm',
          color: 'neutral.500',
        })}
      >
        © 2026 {title}
      </footer>
    </div>
  )
}
