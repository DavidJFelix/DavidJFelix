import {createFileRoute} from '@tanstack/react-router'

import {css} from 'styled-system/css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className={css({minHeight: '100vh', display: 'grid', placeItems: 'center'})}>
      <h1 className={css({fontSize: '5xl', fontWeight: 'bold', letterSpacing: 'tight'})}>
        revision.city
      </h1>
    </main>
  )
}
