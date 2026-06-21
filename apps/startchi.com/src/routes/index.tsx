import {createFileRoute} from '@tanstack/react-router'

import {css} from 'styled-system/css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const title = 'startchi.com'
  const description =
    'A directory, a signal boost, and a home for startups in Chicago and the greater Midwest.'

  const features = [
    {name: 'Directory', body: "Who's building what, near Chicago."},
    {name: 'Signal boost', body: 'Surface and amplify what these startups are doing.'},
    {name: 'Org hub', body: 'A place the scene can organize around.'},
    {name: 'Identity', body: 'A banner for Midwestern startups.'},
  ]

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
        <span className={css({fontSize: 'sm', color: 'neutral.500'})}>chicago startups</span>
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
          Chicago + the Midwest
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
          The Midwest startup ecosystem.
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
          {features.map((f) => (
            <li
              key={f.name}
              className={css({
                borderWidth: '1px',
                borderColor: 'neutral.200',
                rounded: 'xl',
                p: '6',
              })}
            >
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
            </li>
          ))}
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
