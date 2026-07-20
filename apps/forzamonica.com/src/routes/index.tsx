import {createFileRoute} from '@tanstack/react-router'

import {css, cx} from 'styled-system/css'

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

// Pre-launch landing: just the brand mark and a note, in the shop's theme. The
// storefront itself lives at /monica until launch.
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
        textAlign: 'center',
      })}
    >
      <h1 className={css({textStyle: 'displayXl', color: 'ink'})}>
        forzamonica <span className={css({fontStyle: 'normal', fontWeight: 'normal'})}>art</span>
      </h1>
      <p className={css({fontSize: '16px', color: 'ink.muted'})}>
        Watercolors by Monica Felix — coming soon.
      </p>
      <div className={css({display: 'flex', gap: '2.5'})}>
        {PIGMENT_DOTS.map((dotClass) => (
          <span key={dotClass} className={dotClass} />
        ))}
      </div>
    </section>
  )
}
