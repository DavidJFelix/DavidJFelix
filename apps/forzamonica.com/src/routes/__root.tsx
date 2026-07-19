import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, Link, Outlet, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'

import {css} from 'styled-system/css'
import {button} from 'styled-system/recipes'

import {SiteFooter} from '@/components/SiteFooter.tsx'
import {SiteHeader} from '@/components/SiteHeader.tsx'
import {fetchCartQuantity} from '@/lib/shopify/cart.ts'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {title: 'forzamonica art'},
      {
        name: 'description',
        content: 'Original watercolors and archival prints by Monica Felix.',
      },
    ],
    // Fonts are self-hosted (see src/styles.css), so appCss is the only
    // stylesheet and no visitor request leaves the site's origin for type.
    links: [{rel: 'stylesheet', href: appCss}],
  }),
  // Re-runs on every navigation, keeping the header badge in sync with cart
  // mutations (which all end in router.invalidate()).
  loader: () => fetchCartQuantity(),
  component: RootLayout,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootLayout() {
  const cartQuantity = Route.useLoaderData()
  // Pages bring their own width containers (the gallery, cart, and commission
  // layouts each set different maximums), so <main> only fills the column.
  return (
    <>
      <SiteHeader cartQuantity={cartQuantity} />
      <main className={css({width: 'full', flex: '1'})}>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}

function NotFound() {
  return (
    <section
      className={css({
        maxWidth: 'page',
        mx: 'auto',
        px: '6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4',
        py: '20',
      })}
    >
      <p className={css({textStyle: 'overline', color: 'ink.muted'})}>404</p>
      <h1 className={css({textStyle: 'displayLg', color: 'ink'})}>This page took a wrong turn</h1>
      <p className={css({color: 'ink.muted', maxWidth: 'prose'})}>
        The page you are looking for does not exist or has moved.
      </p>
      <Link to="/" className={button()}>
        Back to the gallery
      </Link>
    </section>
  )
}

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className={css({
          bg: 'paper',
          color: 'ink',
          fontFamily: 'sans',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        })}
      >
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
