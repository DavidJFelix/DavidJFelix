import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, ScriptOnce, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'

import {css} from 'styled-system/css'

import {themeBootstrapScript} from '@/diffs/lib/theme-bootstrap'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {title: 'revision.city'},
      {name: 'description', content: 'revision.city'},
    ],
    links: [
      // Declared on the root route so every page inherits it; child routes
      // override title/description but never the mark.
      {rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg'},
      {rel: 'stylesheet', href: appCss},
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className={css({bg: 'white', color: 'neutral.900', fontFamily: 'sans'})}>
        {/* Resolves the persisted (or OS) color scheme before first paint.
            Every page shares the diffs theme, so the scheme is applied once
            here on the shell rather than by per-route head scripts. */}
        <ScriptOnce>{themeBootstrapScript}</ScriptOnce>
        {children}
        <TanStackDevtools
          config={{position: 'bottom-right'}}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
