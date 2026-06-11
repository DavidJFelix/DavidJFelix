import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'

import {css} from 'styled-system/css'

import {SiteHeader} from '@/components/SiteHeader.tsx'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {title: 'Forza Monica'},
      {name: 'description', content: 'Forza Monica — the official shop.'},
    ],
    links: [{rel: 'stylesheet', href: appCss}],
  }),
  shellComponent: RootDocument,
})

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className={css({bg: 'canvas', color: 'fg', fontFamily: 'sans'})}>
        <SiteHeader />
        <main className={css({maxWidth: '5xl', mx: 'auto', px: '4', pb: '16'})}>{children}</main>
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
